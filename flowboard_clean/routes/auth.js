const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    db.run('INSERT INTO activity_log (user_id, action, entity_type) VALUES (?, ?, ?)', [user.id, 'Logged in', 'auth']);
    const { password: _, ...safeUser } = user;
    res.json({ token, user: { ...safeUser, must_change_password: user.must_change_password } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/me', authenticate, (req, res) => {
  const { password, ...user } = req.user;
  res.json(user);
});

module.exports = router;

// Change own password
router.put('/change-password', authenticate, (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const user = db.get('SELECT * FROM users WHERE id=?', [req.user.id]);
    if (!bcrypt.compareSync(current_password, user.password)) return res.status(401).json({ error: 'Current password is wrong' });
    const hashed = bcrypt.hashSync(new_password, 10);
    db.run('UPDATE users SET password=?, must_change_password=0 WHERE id=?', [hashed, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
