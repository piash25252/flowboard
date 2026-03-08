const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, (req, res) => {
  let projects;
  if (req.user.role === 'admin') {
    projects = db.all(`SELECT p.*, u.name as created_by_name, (SELECT COUNT(*) FROM tasks WHERE project_id=p.id) as task_count, (SELECT COUNT(*) FROM project_members WHERE project_id=p.id) as member_count FROM projects p JOIN users u ON p.created_by=u.id ORDER BY p.created_at DESC`);
  } else {
    projects = db.all(`SELECT DISTINCT p.*, u.name as created_by_name, (SELECT COUNT(*) FROM tasks WHERE project_id=p.id) as task_count, (SELECT COUNT(*) FROM project_members WHERE project_id=p.id) as member_count FROM projects p JOIN users u ON p.created_by=u.id LEFT JOIN project_members pm ON pm.project_id=p.id WHERE pm.user_id=? OR p.created_by=? ORDER BY p.created_at DESC`, [req.user.id, req.user.id]);
  }
  res.json(projects);
});

router.get('/:id', authenticate, (req, res) => {
  const project = db.get('SELECT p.*, u.name as created_by_name FROM projects p JOIN users u ON p.created_by=u.id WHERE p.id=?', [req.params.id]);
  if (!project) return res.status(404).json({ error: 'Not found' });
  const members = db.all('SELECT u.id, u.name, u.email, u.role FROM users u JOIN project_members pm ON pm.user_id=u.id WHERE pm.project_id=?', [req.params.id]);
  res.json({ ...project, members });
});

router.post('/', authenticate, requireRole('admin','project_manager'), (req, res) => {
  try {
    const { name, description, member_ids } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const r = db.run('INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)', [name, description||'', req.user.id]);
    const pid = r.lastID;
    db.run('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)', [pid, req.user.id]);
    if (Array.isArray(member_ids)) member_ids.forEach(uid => db.run('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)', [pid, uid]));
    db.run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)', [req.user.id, 'Created project', 'project', pid, name]);
    res.status(201).json({ id: pid, name });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, requireRole('admin','project_manager'), (req, res) => {
  const project = db.get('SELECT * FROM projects WHERE id=?', [req.params.id]);
  if (!project) return res.status(404).json({ error: 'Not found' });
  const { name, description, status, member_ids } = req.body;
  db.run('UPDATE projects SET name=?, description=?, status=? WHERE id=?', [name||project.name, description??project.description, status||project.status, req.params.id]);
  if (Array.isArray(member_ids)) {
    db.run('DELETE FROM project_members WHERE project_id=?', [req.params.id]);
    db.run('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)', [req.params.id, project.created_by]);
    member_ids.forEach(uid => db.run('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)', [req.params.id, uid]));
  }
  res.json({ message: 'Updated' });
});

router.delete('/:id', authenticate, requireRole('admin'), (req, res) => {
  db.run('DELETE FROM projects WHERE id=?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

router.get('/:id/stats', authenticate, (req, res) => {
  const stats = db.get(`SELECT COUNT(*) as total, SUM(CASE WHEN status='todo' THEN 1 ELSE 0 END) as todo, SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) as in_progress, SUM(CASE WHEN status='review' THEN 1 ELSE 0 END) as review, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) as done, SUM(CASE WHEN priority='critical' THEN 1 ELSE 0 END) as critical FROM tasks WHERE project_id=?`, [req.params.id]);
  res.json(stats || {});
});

module.exports = router;
