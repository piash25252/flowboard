const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'flowboard.db.json');

let db = null;

// Save DB to file
function saveDb() {
  if (!db) return;
  const data = db.export();
  const buf = Buffer.from(data);
  fs.writeFileSync(DB_FILE + '.bin', buf);
}

// Load DB from file
function loadDbData() {
  const binFile = DB_FILE + '.bin';
  if (fs.existsSync(binFile)) {
    return fs.readFileSync(binFile);
  }
  return null;
}

let dbReady = false;
let readyCallbacks = [];

async function initDb() {
  const SQL = await initSqlJs();
  const existing = loadDbData();
  if (existing) {
    db = new SQL.Database(existing);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL, must_change_password INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT DEFAULT '', status TEXT DEFAULT 'active', created_by INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS project_members (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, user_id INTEGER NOT NULL, UNIQUE(project_id, user_id))`);
  db.run(`CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT DEFAULT '', status TEXT DEFAULT 'todo', priority TEXT DEFAULT 'medium', type TEXT DEFAULT 'task', project_id INTEGER NOT NULL, assigned_to INTEGER, created_by INTEGER NOT NULL, due_date TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER NOT NULL, user_id INTEGER NOT NULL, content TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, action TEXT NOT NULL, entity_type TEXT, entity_id INTEGER, details TEXT, created_at TEXT DEFAULT (datetime('now')))`);

  saveDb();
  dbReady = true;
  readyCallbacks.forEach(cb => cb());
  
  // Auto-save every 30 seconds
  setInterval(saveDb, 30000);
  
  console.log('✅ Database ready');
}

initDb().catch(console.error);

function onReady(cb) {
  if (dbReady) cb();
  else readyCallbacks.push(cb);
}

// Sync query helpers (sql.js is synchronous)
const dbWrapper = {
  onReady,
  run(sql, params = []) {
    db.run(sql, params);
    saveDb();
    // Get last insert id
    const row = db.exec('SELECT last_insert_rowid() as id');
    return { lastID: row[0]?.values[0][0] || null };
  },
  get(sql, params = []) {
    const res = db.exec(sql, params);
    if (!res.length || !res[0].values.length) return null;
    const cols = res[0].columns;
    const vals = res[0].values[0];
    const obj = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    return obj;
  },
  all(sql, params = []) {
    const res = db.exec(sql, params);
    if (!res.length) return [];
    const cols = res[0].columns;
    return res[0].values.map(vals => {
      const obj = {};
      cols.forEach((c, i) => obj[c] = vals[i]);
      return obj;
    });
  }
};

module.exports = dbWrapper;
