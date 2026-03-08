const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, requireRole('admin','project_manager'), (req, res) => {
  res.json(db.all('SELECT id, name, email, role, created_at FROM users ORDER BY name'));
});

router.post('/', authenticate, requireRole('admin'), (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields required' });
    if (db.get('SELECT id FROM users WHERE email=?', [email])) return res.status(409).json({ error: 'Email exists' });
    const hashed = bcrypt.hashSync(password, 10);
    const r = db.run('INSERT INTO users (name, email, password, role, must_change_password) VALUES (?, ?, ?, ?)', [name, email, hashed, role, 1]);
    db.run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)', [req.user.id, 'Created user', 'user', r.lastID, `${name} (${role})`]);
    res.status(201).json({ id: r.lastID, name, email, role });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, requireRole('admin'), (req, res) => {
  try {
    const user = db.get('SELECT * FROM users WHERE id=?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { name, email, role, password } = req.body;
    const pw = password ? bcrypt.hashSync(password, 10) : user.password;
    db.run('UPDATE users SET name=?, email=?, role=?, password=? WHERE id=?', [name||user.name, email||user.email, role||user.role, pw, req.params.id]);
    res.json({ message: 'Updated' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, requireRole('admin'), (req, res) => {
  if (req.params.id == req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.run('DELETE FROM users WHERE id=?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

module.exports = router;
