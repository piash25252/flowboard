require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Create default admin after DB ready
db.onReady(() => {
  const existing = db.get('SELECT id FROM users WHERE role = "admin"');
  if (!existing) {
    const hashed = bcrypt.hashSync('admin123', 10);
    db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', ['System Admin', 'admin@flowboard.com', hashed, 'admin']);
    console.log('✅ Default admin: admin@flowboard.com / admin123');
  }
});

app.listen(PORT, () => console.log(`🚀 FlowBoard running at http://localhost:${PORT}`));
