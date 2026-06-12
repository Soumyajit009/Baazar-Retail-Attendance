const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Get all employees (admin only)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from('employees')
    .select('id, employee_id, name, department, joining_date, created_at')
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Add employee (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { employeeId, name, department, password, joiningDate } = req.body;

  if (!employeeId || !name || !department || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Check if employee ID already exists
  const { data: existing } = await supabase
    .from('employees')
    .select('id')
    .eq('employee_id', employeeId)
    .single();

  if (existing) {
    return res.status(400).json({ error: 'Employee ID already exists' });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('employees')
    .insert([{ employee_id: employeeId, name, department, password_hash, joining_date: joiningDate || null }])
    .select('id, employee_id, name, department, joining_date')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Update employee (admin only)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name, department, joiningDate } = req.body;
  const { id } = req.params;

  const { data, error } = await supabase
    .from('employees')
    .update({ name, department, joining_date: joiningDate || null })
    .eq('id', id)
    .select('id, employee_id, name, department, joining_date')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Reset password (admin only)
router.patch('/:id/reset-password', authMiddleware, adminOnly, async (req, res) => {
  const { password } = req.body;
  const { id } = req.params;

  if (!password) return res.status(400).json({ error: 'Password required' });

  const password_hash = await bcrypt.hash(password, 10);

  const { error } = await supabase
    .from('employees')
    .update({ password_hash })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Password updated successfully' });
});

// Delete employee (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Employee deleted successfully' });
});

module.exports = router;
