const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Get all departments
router.get('/', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Add department
// Add department (admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Department name required' });

  const { data: existingRows } = await supabase
    .from('departments')
    .select('id')
    .eq('name', name)
    .limit(1);

  if (existingRows && existingRows.length > 0) {
    return res.status(400).json({ error: 'Department already exists' });
  }

  const { data, error } = await supabase
    .from('departments')
    .insert([{ name }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Update department (admin only)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { name } = req.body;
  const { id } = req.params;

  const { data, error } = await supabase
    .from('departments')
    .update({ name })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Delete department (admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Department deleted' });
});

module.exports = router;