const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/activity/recent', authenticate, (req, res) => {
  res.json(db.all('SELECT al.*, u.name as user_name FROM activity_log al JOIN users u ON al.user_id=u.id ORDER BY al.created_at DESC LIMIT 20'));
});

router.get('/project/:projectId', authenticate, (req, res) => {
  const { status, assigned_to, priority, type } = req.query;
  let q = `SELECT t.*, u1.name as assigned_to_name, u2.name as created_by_name FROM tasks t LEFT JOIN users u1 ON t.assigned_to=u1.id LEFT JOIN users u2 ON t.created_by=u2.id WHERE t.project_id=?`;
  const p = [req.params.projectId];
  if (req.user.role === 'developer') { q += ' AND t.assigned_to=?'; p.push(req.user.id); }
  if (status) { q += ' AND t.status=?'; p.push(status); }
  if (assigned_to) { q += ' AND t.assigned_to=?'; p.push(assigned_to); }
  if (priority) { q += ' AND t.priority=?'; p.push(priority); }
  if (type) { q += ' AND t.type=?'; p.push(type); }
  q += ' ORDER BY CASE t.priority WHEN "critical" THEN 1 WHEN "high" THEN 2 WHEN "medium" THEN 3 ELSE 4 END, t.created_at DESC';
  res.json(db.all(q, p));
});

router.get('/:id', authenticate, (req, res) => {
  const task = db.get(`SELECT t.*, u1.name as assigned_to_name, u2.name as created_by_name FROM tasks t LEFT JOIN users u1 ON t.assigned_to=u1.id LEFT JOIN users u2 ON t.created_by=u2.id WHERE t.id=?`, [req.params.id]);
  if (!task) return res.status(404).json({ error: 'Not found' });
  const comments = db.all(`SELECT c.*, u.name as user_name, u.role as user_role FROM comments c JOIN users u ON c.user_id=u.id WHERE c.task_id=? ORDER BY c.created_at ASC`, [req.params.id]);
  res.json({ ...task, comments });
});

router.post('/', authenticate, requireRole('admin','project_manager'), (req, res) => {
  try {
    const { title, description, priority, type, project_id, assigned_to, due_date } = req.body;
    if (!title || !project_id) return res.status(400).json({ error: 'Title and project_id required' });
    const r = db.run('INSERT INTO tasks (title, description, priority, type, project_id, assigned_to, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description||'', priority||'medium', type||'task', project_id, assigned_to||null, due_date||null, req.user.id]);
    db.run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)', [req.user.id, 'Created task', 'task', r.lastID, title]);
    res.status(201).json({ id: r.lastID });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authenticate, (req, res) => {
  try {
    const task = db.get('SELECT * FROM tasks WHERE id=?', [req.params.id]);
    if (!task) return res.status(404).json({ error: 'Not found' });
    const { title, description, status, priority, type, assigned_to, due_date } = req.body;
    if (req.user.role === 'developer') {
      if (task.assigned_to !== req.user.id) return res.status(403).json({ error: 'Can only update your tasks' });
      db.run(`UPDATE tasks SET status=?, updated_at=datetime('now') WHERE id=?`, [status||task.status, req.params.id]);
    } else if (req.user.role === 'qa_tester') {
      db.run(`UPDATE tasks SET status=?, type=?, updated_at=datetime('now') WHERE id=?`, [status||task.status, type||task.type, req.params.id]);
    } else {
      db.run(`UPDATE tasks SET title=?, description=?, status=?, priority=?, type=?, assigned_to=?, due_date=?, updated_at=datetime('now') WHERE id=?`,
        [title||task.title, description??task.description, status||task.status, priority||task.priority, type||task.type,
         assigned_to!==undefined?assigned_to:task.assigned_to, due_date!==undefined?due_date:task.due_date, req.params.id]);
      db.run('INSERT INTO activity_log (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)', [req.user.id, 'Updated task', 'task', req.params.id, title||task.title]);
    }
    res.json({ message: 'Updated' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authenticate, requireRole('admin','project_manager'), (req, res) => {
  db.run('DELETE FROM tasks WHERE id=?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

router.post('/:id/comments', authenticate, (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content required' });
    const r = db.run('INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)', [req.params.id, req.user.id, content]);
    const comment = db.get('SELECT c.*, u.name as user_name, u.role as user_role FROM comments c JOIN users u ON c.user_id=u.id WHERE c.id=?', [r.lastID]);
    res.status(201).json(comment);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
