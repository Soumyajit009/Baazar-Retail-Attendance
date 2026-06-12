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

function getISTParts() {
  const now = new Date();
  const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
  return new Date(istString);
}

function getTodayIST() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const map = {};
  parts.forEach(p => map[p.type] = p.value);
  return `${map.year}-${map.month}-${map.day}`;
}

function getTimeStrIST() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(now);
  const map = {};
  parts.forEach(p => map[p.type] = p.value);
  return `${map.hour}:${map.minute}:${map.second}`;
}

// Auto-checkout logic: for records with checkin but no checkout,
// where the date is in the past OR today but past 7 PM, set checkout to 19:00:00
async function applyAutoCheckout(records) {
  const todayStr = getTodayIST();
  const ist = getISTParts();
  const nowMinutes = ist.getHours() * 60 + ist.getMinutes();
  const sevenPM = 19 * 60;

  const toUpdate = [];
  for (const r of records) {
    if (r.status === 'Present' && r.checkin_time && !r.checkout_time) {
      const isPast = r.date < todayStr;
      const isTodayPastSeven = r.date === todayStr && nowMinutes >= sevenPM;
      if (isPast || isTodayPastSeven) {
        r.checkout_time = '19:00:00';
        r.auto_checkout = true;
        toUpdate.push(r.id);
      }
    }
  }

  if (toUpdate.length > 0) {
    await supabase
      .from('attendance')
      .update({ checkout_time: '19:00:00' })
      .in('id', toUpdate);
  }

  return records;
}

// ============ EMPLOYEE ROUTES ============

// Check In (location required)
router.post('/checkin', authMiddleware, async (req, res) => {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ error: 'Employee access required' });
  }

  const { latitude, longitude } = req.body;
  const today = getTodayIST();
  const timeStr = getTimeStrIST();

  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Location access is required to Check In. Please enable GPS.' });
  }

  const officeLat = parseFloat(process.env.OFFICE_LAT);
  const officeLng = parseFloat(process.env.OFFICE_LNG);
  const allowedRadius = parseFloat(process.env.OFFICE_RADIUS_METERS);

  const distance = getDistanceMeters(latitude, longitude, officeLat, officeLng);

  if (distance > allowedRadius) {
    return res.status(403).json({
      error: `You are ${Math.round(distance)} meters away from the office. You must be within ${allowedRadius} meters to Check In.`
    });
  }

  // Check if already marked today
  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('employee_id', req.user.id)
    .eq('date', today)
    .limit(1);

  if (existing && existing.length > 0) {
    return res.status(400).json({ error: 'Attendance already marked today' });
  }

  const { data, error } = await supabase
    .from('attendance')
    .insert([{
      employee_id: req.user.id,
      employee_code: req.user.employeeId,
      employee_name: req.user.name,
      department: req.user.department,
      status: 'Present',
      date: today,
      time: timeStr,
      checkin_time: timeStr,
      latitude: latitude || null,
      longitude: longitude || null,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Check Out (no location required)
router.post('/checkout', authMiddleware, async (req, res) => {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ error: 'Employee access required' });
  }

  const today = getTodayIST();
  const timeStr = getTimeStrIST();

  const { data: existing, error: fetchError } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', req.user.id)
    .eq('date', today)
    .limit(1);

  if (fetchError) return res.status(500).json({ error: fetchError.message });

  if (!existing || existing.length === 0) {
    return res.status(400).json({ error: 'You have not checked in today' });
  }

  const record = existing[0];

  if (record.status !== 'Present') {
    return res.status(400).json({ error: 'Check Out is only available after Check In' });
  }

  if (record.checkout_time) {
    return res.status(400).json({ error: 'You have already checked out today' });
  }

  const { data, error } = await supabase
    .from('attendance')
    .update({ checkout_time: timeStr })
    .eq('id', record.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Mark Absent (no location required)
router.post('/absent', authMiddleware, async (req, res) => {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ error: 'Employee access required' });
  }

  const today = getTodayIST();
  const timeStr = getTimeStrIST();

  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('employee_id', req.user.id)
    .eq('date', today)
    .limit(1);

  if (existing && existing.length > 0) {
    return res.status(400).json({ error: 'Attendance already marked today' });
  }

  const { data, error } = await supabase
    .from('attendance')
    .insert([{
      employee_id: req.user.id,
      employee_code: req.user.employeeId,
      employee_name: req.user.name,
      department: req.user.department,
      status: 'Absent',
      date: today,
      time: timeStr,
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Get today's attendance status for employee
router.get('/today/me', authMiddleware, async (req, res) => {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ error: 'Employee access required' });
  }

  const today = getTodayIST();

  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', req.user.id)
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ error: error.message });
  }

  if (data) {
    const result = await applyAutoCheckout([data]);
    return res.json(result[0]);
  }

  res.json(data || null);
});

// Get summary for employee (weekly or monthly)
router.get('/summary/me', authMiddleware, async (req, res) => {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ error: 'Employee access required' });
  }

  const period = req.query.period === 'week' ? 'week' : 'month';
  const ist = getISTParts();
  let startDate;

  if (period === 'week') {
    const dayOfWeek = ist.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(ist);
    monday.setDate(ist.getDate() - diffToMonday);
    startDate = monday.toISOString().split('T')[0];
  } else {
    startDate = `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-01`;
  }

  const todayStr = getTodayIST();

  const { data, error } = await supabase
    .from('attendance')
    .select('date, status, checkin_time, checkout_time')
    .eq('employee_id', req.user.id)
    .gte('date', startDate)
    .lte('date', todayStr)
    .order('date', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const present = data.filter(r => r.status === 'Present').length;
  const absent = data.filter(r => r.status === 'Absent').length;
  const total = data.length;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  res.json({ period, startDate, endDate: todayStr, present, absent, total, percentage, records: data });
});

// ============ ADMIN ROUTES ============

// Get all attendance (admin) with filters
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  const { date, department, search } = req.query;

  let query = supabase.from('attendance').select('*').order('date', { ascending: false }).order('time', { ascending: false });

  if (date) query = query.eq('date', date);
  if (department) query = query.eq('department', department);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  let result = await applyAutoCheckout(data || []);

  if (search) {
    const s = search.toLowerCase();
    result = result.filter(r =>
      r.employee_code.toLowerCase().includes(s) ||
      r.employee_name.toLowerCase().includes(s)
    );
  }

  res.json(result);
});

// Get not-marked employees for today (admin)
router.get('/not-marked', authMiddleware, adminOnly, async (req, res) => {
  const today = getTodayIST();

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
  const exportDate = date || getTodayIST();

  const { data: attendanceDataRaw } = await supabase
    .from('attendance')
    .select('*')
    .eq('date', exportDate)
    .order('time', { ascending: true });

  const attendanceData = await applyAutoCheckout(attendanceDataRaw || []);

  const { data: allEmployees } = await supabase
    .from('employees')
    .select('id, employee_id, name, department');

  const markedIds = new Set((attendanceData || []).map(r => r.employee_id));
  const notMarked = (allEmployees || []).filter(e => !markedIds.has(e.id));

  const fmtTimeDisplay = (t) => {
    if (!t) return '';
    const [hh, mm] = t.split(':');
    const h = parseInt(hh);
    return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bazar Retail HR';
  workbook.created = new Date();

  const sheet1 = workbook.addWorksheet('Attendance Records');
  sheet1.columns = [
    { header: 'Employee ID', key: 'employee_code', width: 15 },
    { header: 'Employee Name', key: 'employee_name', width: 25 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Check In', key: 'checkin', width: 14 },
    { header: 'Check Out', key: 'checkout', width: 14 },
    { header: 'Date', key: 'date', width: 14 },
  ];

  sheet1.getRow(1).eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A56DB' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
  });

  (attendanceData || []).forEach(row => {
    const r = sheet1.addRow({
      employee_code: row.employee_code,
      employee_name: row.employee_name,
      department: row.department,
      status: row.status,
      checkin: fmtTimeDisplay(row.checkin_time),
      checkout: fmtTimeDisplay(row.checkout_time),
      date: row.date,
    });
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