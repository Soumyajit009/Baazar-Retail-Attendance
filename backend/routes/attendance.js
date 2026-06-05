const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const supabase = require('../config/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Haversine formula to calculate distance in meters
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Submit attendance (employee)
router.post('/submit', authMiddleware, async (req, res) => {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ error: 'Employee access required' });
  }

  const { status, latitude, longitude } = req.body;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  const timeStr = `${String(istTime.getHours()).padStart(2,'0')}:${String(istTime.getMinutes()).padStart(2,'0')}:${String(istTime.getSeconds()).padStart(2,'0')}`;

  if (!['Present', 'Absent'].includes(status)) {
    return res.status(400).json({ error: 'Status must be Present or Absent' });
  }
  // Time restriction for Present
  if (status === 'Present') {
    const nowIST = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
    const hours = nowIST.getHours();
    const minutes = nowIST.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const allowFrom = 8 * 60 + 30; // 8:30 AM
    
    if (totalMinutes < allowFrom) {
      return res.status(400).json({ error: 'Present can only be marked after 8:30 AM.' });
    }
  }

  // Location check only for Present
  if (status === 'Present') {
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Location access is required to mark Present. Please enable GPS.' });
    }

    const officeLat = parseFloat(process.env.OFFICE_LAT);
    const officeLng = parseFloat(process.env.OFFICE_LNG);
    const allowedRadius = parseFloat(process.env.OFFICE_RADIUS_METERS);

    const distance = getDistanceMeters(latitude, longitude, officeLat, officeLng);

    if (distance > allowedRadius) {
      return res.status(403).json({
        error: `You are ${Math.round(distance)} meters away from the office. You must be within ${allowedRadius} meters to mark Present.`
      });
    }
  }

  // Check if already submitted today
  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('employee_id', req.user.id)
    .eq('date', today)
    .limit(1);

  if (existing && existing.length > 0) {
    return res.status(400).json({ error: 'Attendance already submitted today' });
  }

  const { data, error } = await supabase
    .from('attendance')
    .insert([{
      employee_id: req.user.id,
      employee_code: req.user.employeeId,
      employee_name: req.user.name,
      department: req.user.department,
      status,
      date: today,
      time: timeStr,
      latitude: latitude || null,
      longitude: longitude || null,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Get today's attendance check for employee
router.get('/today/me', authMiddleware, async (req, res) => {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ error: 'Employee access required' });
  }

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', req.user.id)
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: error.message });
  }

  res.json(data || null);
});

// Get monthly summary for employee
router.get('/monthly/me', authMiddleware, async (req, res) => {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ error: 'Employee access required' });
  }

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('attendance')
    .select('status')
    .eq('employee_id', req.user.id)
    .gte('date', `${month}-01`)
    .lte('date', `${month}-31`);

  if (error) return res.status(500).json({ error: error.message });

  const present = data.filter(r => r.status === 'Present').length;
  const absent = data.filter(r => r.status === 'Absent').length;
  const total = data.length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  res.json({ present, absent, total, percentage });
});

// Get all attendance (admin) with filters
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  const { date, department, search } = req.query;

  let query = supabase.from('attendance').select('*').order('date', { ascending: false }).order('time', { ascending: false });

  if (date) query = query.eq('date', date);
  if (department) query = query.eq('department', department);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  let result = data;
  if (search) {
    const s = search.toLowerCase();
    result = data.filter(r =>
      r.employee_code.toLowerCase().includes(s) ||
      r.employee_name.toLowerCase().includes(s)
    );
  }

  res.json(result);
});

// Get not-marked employees for today (admin)
router.get('/not-marked', authMiddleware, adminOnly, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const { data: allEmployees } = await supabase
    .from('employees')
    .select('id, employee_id, name, department');

  const { data: markedToday } = await supabase
    .from('attendance')
    .select('employee_id')
    .eq('date', today);

  const markedIds = new Set((markedToday || []).map(r => r.employee_id));
  const notMarked = (allEmployees || []).filter(e => !markedIds.has(e.id));

  res.json(notMarked);
});

// Export Excel (admin)
router.get('/export', authMiddleware, adminOnly, async (req, res) => {
  const { date } = req.query;
  const exportDate = date || new Date().toISOString().split('T')[0];

  const { data: attendanceData } = await supabase
    .from('attendance')
    .select('*')
    .eq('date', exportDate)
    .order('time', { ascending: true });

  const { data: allEmployees } = await supabase
    .from('employees')
    .select('id, employee_id, name, department');

  const markedIds = new Set((attendanceData || []).map(r => r.employee_id));
  const notMarked = (allEmployees || []).filter(e => !markedIds.has(e.id));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bazar Retail HR';
  workbook.created = new Date();

  const sheet1 = workbook.addWorksheet('Attendance Records');
  sheet1.columns = [
    { header: 'Employee ID', key: 'employee_code', width: 15 },
    { header: 'Employee Name', key: 'employee_name', width: 25 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Time', key: 'time', width: 12 },
  ];

  sheet1.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A56DB' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
  });

  (attendanceData || []).forEach(row => {
    const r = sheet1.addRow(row);
    const statusCell = r.getCell('status');
    if (row.status === 'Present') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDEF7EC' } };
      statusCell.font = { color: { argb: 'FF0E9F6E' }, bold: true };
    } else {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8E8' } };
      statusCell.font = { color: { argb: 'FFE02424' }, bold: true };
    }
  });

  const sheet2 = workbook.addWorksheet('Not Marked');
  sheet2.columns = [
    { header: 'Employee ID', key: 'employee_id', width: 15 },
    { header: 'Employee Name', key: 'name', width: 25 },
    { header: 'Department', key: 'department', width: 18 },
  ];

  sheet2.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  notMarked.forEach(emp => sheet2.addRow(emp));

  const dateFormatted = exportDate.replace(/-/g, '_');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=Attendance_${dateFormatted}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
});

module.exports = router;