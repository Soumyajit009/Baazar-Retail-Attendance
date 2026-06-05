const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

// Admin Login
router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;

  if (
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const token = jwt.sign(
    { role: 'admin', username },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({ token, role: 'admin', username });
});

// Employee Login
router.post('/employee/login', async (req, res) => {
  const { employeeId, password } = req.body;

  const { data: employee, error } = await supabase
    .from('employees')
    .select('*')
    .eq('employee_id', employeeId)
    .single();

  if (error || !employee) {
    return res.status(401).json({ error: 'Invalid Employee ID or Password' });
  }

  const valid = await bcrypt.compare(password, employee.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid Employee ID or Password' });
  }

  const token = jwt.sign(
    {
      role: 'employee',
      id: employee.id,
      employeeId: employee.employee_id,
      name: employee.name,
      department: employee.department,
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    token,
    role: 'employee',
    employee: {
      id: employee.id,
      employeeId: employee.employee_id,
      name: employee.name,
      department: employee.department,
    },
  });
});

module.exports = router;
