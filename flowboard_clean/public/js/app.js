// ========================
// STATE
// ========================
const state = {
  token: localStorage.getItem('fb_token'),
  user: null,
  projects: [],
  currentProject: null,
  tasks: [],
  users: [],
  editingTaskId: null
};

const API = '';

// ========================
// API HELPER
// ========================
async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (state.token) opts.headers['Authorization'] = 'Bearer ' + state.token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + '/api' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ========================
// AUTH
// ========================
async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');

  try {
    const data = await api('/auth/login', 'POST', { email, password });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('fb_token', data.token);
    showApp();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  }
}

async function checkAuth() {
  if (!state.token) return showLogin();
  try {
    state.user = await api('/auth/me');
    showApp();
  } catch {
    logout();
  }
}

function logout() {
  localStorage.removeItem('fb_token');
  state.token = null;
  state.user = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-page').classList.remove('hidden');
}

// ========================
// SHOW/HIDE
// ========================
function showLogin() {
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  setupUI();
  navigateTo('dashboard');
}

function setupUI() {
  const u = state.user;
  document.getElementById('nav-name').textContent = u.name;
  document.getElementById('nav-role').textContent = formatRole(u.role);
  document.getElementById('nav-avatar').textContent = u.name[0].toUpperCase();
  document.getElementById('top-avatar').textContent = u.name[0].toUpperCase();

  // Show/hide role-specific elements
  const isAdmin = u.role === 'admin';
  const isPM = u.role === 'project_manager' || isAdmin;
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
  document.querySelectorAll('.pm-only').forEach(el => el.style.display = isPM ? '' : 'none');
}

function formatRole(role) {
  return { admin: 'Admin', project_manager: 'Project Manager', developer: 'Developer', qa_tester: 'QA Tester' }[role] || role;
}

// ========================
// NAVIGATION
// ========================
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  const titles = { dashboard: 'Dashboard', projects: 'Projects', board: 'Board', users: 'Team Members' };
  document.getElementById('page-title').textContent = titles[page] || page;

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');

  if (page === 'dashboard') loadDashboard();
  if (page === 'projects') loadProjects();
  if (page === 'users') loadUsers();
}

// ========================
// DASHBOARD
// ========================
async function loadDashboard() {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('dashboard-greeting').textContent = `${greet}, ${state.user.name}!`;

  try {
    const [projects, activity] = await Promise.all([
      api('/projects'),
      api('/tasks/activity/recent')
    ]);
    state.projects = projects;
    document.getElementById('stat-projects').textContent = projects.length;

    // Gather all tasks stats
    let done = 0, inprogress = 0, critical = 0;
    for (const p of projects) {
      try {
        const stats = await api(`/projects/${p.id}/stats`);
        done += stats.done || 0;
        inprogress += stats.in_progress || 0;
        critical += stats.critical || 0;
      } catch {}
    }
    document.getElementById('stat-done').textContent = done;
    document.getElementById('stat-inprogress').textContent = inprogress;
    document.getElementById('stat-critical').textContent = critical;

    // Activity
    const actEl = document.getElementById('activity-list');
    if (!activity.length) { actEl.innerHTML = '<div class="empty-state">No activity yet</div>'; return; }
    actEl.innerHTML = activity.map(a => `
      <div class="activity-item">
        <span class="activity-dot"></span>
        <span><strong>${a.user_name}</strong> ${a.action}${a.details ? `: <em>${a.details}</em>` : ''}</span>
        <span class="activity-time">${timeAgo(a.created_at)}</span>
      </div>
    `).join('');
  } catch (e) { console.error(e); }
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ========================
// PROJECTS
// ========================
async function loadProjects() {
  try {
    state.projects = await api('/projects');
    const grid = document.getElementById('project-grid');
    if (!state.projects.length) {
      grid.innerHTML = '<div class="empty-state">No projects yet. Create one to get started!</div>'; return;
    }
    grid.innerHTML = state.projects.map(p => `
      <div class="project-card" onclick="openBoard(${p.id})">
        <span class="project-status-badge status-${p.status}">${p.status.replace('_', ' ')}</span>
        <div class="project-card-name">${p.name}</div>
        <div class="project-card-desc">${p.description || 'No description'}</div>
        <div class="project-card-meta">
          <span>◉ ${p.task_count} tasks</span>
          <span>◎ ${p.member_count} members</span>
          <span>by ${p.created_by_name}</span>
        </div>
      </div>
    `).join('');
  } catch (e) { console.error(e); }
}

async function openNewProjectModal() {
  try {
    state.users = await api('/users');
    const box = document.getElementById('member-checkboxes');
    box.innerHTML = state.users.filter(u => u.id !== state.user.id).map(u => `
      <div class="member-check-item">
        <input type="checkbox" id="mc_${u.id}" value="${u.id}" />
        <label for="mc_${u.id}">${u.name} <span class="member-role-small">${formatRole(u.role)}</span></label>
      </div>
    `).join('');
  } catch {}
  document.getElementById('proj-name').value = '';
  document.getElementById('proj-desc').value = '';
  openModal('modal-project');
}

async function saveProject() {
  const name = document.getElementById('proj-name').value.trim();
  if (!name) return alert('Project name is required');
  const desc = document.getElementById('proj-desc').value;
  const member_ids = [...document.querySelectorAll('#member-checkboxes input:checked')].map(i => +i.value);
  try {
    await api('/projects', 'POST', { name, description: desc, member_ids });
    closeAllModals();
    loadProjects();
  } catch (e) { alert(e.message); }
}

// ========================
// BOARD
// ========================
async function openBoard(projectId) {
  state.currentProject = state.projects.find(p => p.id === projectId);
  document.getElementById('board-project-name').textContent = state.currentProject?.name || 'Board';
  document.getElementById('board-project-desc').textContent = state.currentProject?.description || '';
  document.getElementById('nav-board').style.display = '';

  // Load project members for filter
  try {
    const proj = await api(`/projects/${projectId}`);
    const filterUser = document.getElementById('board-filter-user');
    filterUser.innerHTML = '<option value="">All Members</option>' +
      proj.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  } catch {}

  navigateTo('board');
  loadBoard();
}

async function loadBoard() {
  if (!state.currentProject) return;
  const userFilter = document.getElementById('board-filter-user').value;
  const priorityFilter = document.getElementById('board-filter-priority').value;

  let url = `/tasks/project/${state.currentProject.id}`;
  const params = [];
  if (userFilter) params.push(`assigned_to=${userFilter}`);
  if (priorityFilter) params.push(`priority=${priorityFilter}`);
  if (params.length) url += '?' + params.join('&');

  try {
    state.tasks = await api(url);
    const cols = { todo: [], in_progress: [], review: [], done: [] };
    state.tasks.forEach(t => { if (cols[t.status]) cols[t.status].push(t); });

    const colMap = { todo: 'todo', in_progress: 'inprogress', review: 'review', done: 'done' };
    Object.entries(cols).forEach(([status, tasks]) => {
      const key = colMap[status];
      document.getElementById(`count-${key}`).textContent = tasks.length;
      document.getElementById(`cards-${key}`).innerHTML = tasks.length
        ? tasks.map(renderTaskCard).join('')
        : '<div style="color:#9ca3af;font-size:12px;text-align:center;padding:20px">Empty</div>';
    });
  } catch (e) { console.error(e); }
}

function renderTaskCard(t) {
  const due = t.due_date ? new Date(t.due_date) : null;
  const overdue = due && due < new Date() && t.status !== 'done';
  const dueStr = due ? due.toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) : '';
  return `
    <div class="task-card" onclick="openTaskDetail(${t.id})">
      <div class="task-card-top">
        <span class="task-type-badge type-${t.type}">${t.type === 'bug' ? '🐛' : t.type === 'feature' ? '⭐' : '📋'} ${t.type}</span>
        <span class="priority-dot p-${t.priority}" title="${t.priority}"></span>
      </div>
      <div class="task-card-title">${t.title}</div>
      <div class="task-card-footer">
        <div class="task-assignee-chip">
          ${t.assigned_to_name ? `<div class="chip-avatar">${t.assigned_to_name[0]}</div><span>${t.assigned_to_name}</span>` : '<span style="color:#9ca3af">Unassigned</span>'}
        </div>
        ${dueStr ? `<span class="task-due${overdue ? ' overdue' : ''}">${overdue ? '⚠ ' : ''}${dueStr}</span>` : ''}
      </div>
    </div>
  `;
}

// ========================
// TASK MODAL
// ========================
async function openNewTaskModal() {
  state.editingTaskId = null;
  document.getElementById('task-modal-title').textContent = 'New Task';
  document.getElementById('task-id').value = '';
  document.getElementById('task-title').value = '';
  document.getElementById('task-desc').value = '';
  document.getElementById('task-priority').value = 'medium';
  document.getElementById('task-type').value = 'task';
  document.getElementById('task-due').value = '';

  // Load project members for assignee
  try {
    const proj = await api(`/projects/${state.currentProject.id}`);
    document.getElementById('task-assignee').innerHTML =
      '<option value="">— Unassigned —</option>' +
      proj.members.map(m => `<option value="${m.id}">${m.name} (${formatRole(m.role)})</option>`).join('');
  } catch {}

  openModal('modal-task');
}

async function saveTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) return alert('Task title is required');
  const body = {
    title,
    description: document.getElementById('task-desc').value,
    priority: document.getElementById('task-priority').value,
    type: document.getElementById('task-type').value,
    assigned_to: document.getElementById('task-assignee').value || null,
    due_date: document.getElementById('task-due').value || null,
    project_id: state.currentProject.id
  };

  try {
    if (state.editingTaskId) {
      await api(`/tasks/${state.editingTaskId}`, 'PUT', body);
    } else {
      await api('/tasks', 'POST', body);
    }
    closeAllModals();
    loadBoard();
  } catch (e) { alert(e.message); }
}

// AI Task Description
async function generateAIDescription() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) return alert('Enter a task title first');
  const btn = document.getElementById('ai-gen-btn');
  const loading = document.getElementById('ai-loading');
  const textarea = document.getElementById('task-desc');

  btn.disabled = true;
  loading.classList.remove('hidden');
  textarea.value = '';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Write a clear, concise task description for a software project task titled: "${title}".
Project context: ${state.currentProject?.name || 'Software project'}.
Keep it 2-3 sentences. Include: what needs to be done, acceptance criteria, and any important notes.
Just write the description, no title or headers.`
        }]
      })
    });
    const data = await res.json();
    const text = data.content?.map(c => c.text || '').join('') || '';
    textarea.value = text.trim();
  } catch (e) {
    textarea.value = 'Could not generate description. Please check your connection.';
  }

  btn.disabled = false;
  loading.classList.add('hidden');
}

// ========================
// TASK DETAIL
// ========================
async function openTaskDetail(taskId) {
  try {
    const task = await api(`/tasks/${taskId}`);
    document.getElementById('detail-task-id').value = taskId;
    document.getElementById('detail-title').textContent = task.title;
    document.getElementById('detail-type-badge').textContent = task.type.toUpperCase();
    document.getElementById('detail-desc').textContent = task.description || 'No description provided.';
    document.getElementById('detail-status').value = task.status;
    document.getElementById('detail-assignee').textContent = task.assigned_to_name || '— Unassigned';
    document.getElementById('detail-created-by').textContent = task.created_by_name;
    document.getElementById('detail-due').textContent = task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB') : '— Not set';

    const pColors = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#059669' };
    document.getElementById('detail-priority').innerHTML = `<span style="color:${pColors[task.priority]}">● ${task.priority}</span>`;

    // Comments
    const commEl = document.getElementById('comments-list');
    commEl.innerHTML = task.comments?.length
      ? task.comments.map(c => `
          <div class="comment-item">
            <div class="comment-author">
              <div class="chip-avatar" style="width:22px;height:22px">${c.user_name[0]}</div>
              ${c.user_name} <span class="comment-role">${formatRole(c.user_role)}</span>
            </div>
            <div class="comment-text">${c.content}</div>
            <div class="comment-time">${timeAgo(c.created_at)}</div>
          </div>
        `).join('')
      : '<div style="color:#9ca3af;font-size:13px;text-align:center;padding:16px">No comments yet</div>';

    document.getElementById('comment-input').value = '';
    openModal('modal-task-detail');
  } catch (e) { alert(e.message); }
}

async function updateTaskStatus() {
  const id = document.getElementById('detail-task-id').value;
  const status = document.getElementById('detail-status').value;
  try {
    await api(`/tasks/${id}`, 'PUT', { status });
    loadBoard();
  } catch (e) { alert(e.message); }
}

async function addComment() {
  const id = document.getElementById('detail-task-id').value;
  const content = document.getElementById('comment-input').value.trim();
  if (!content) return;
  try {
    const comment = await api(`/tasks/${id}/comments`, 'POST', { content });
    const commEl = document.getElementById('comments-list');
    if (commEl.querySelector('[style*="text-align:center"]')) commEl.innerHTML = '';
    commEl.innerHTML += `
      <div class="comment-item">
        <div class="comment-author">
          <div class="chip-avatar" style="width:22px;height:22px">${comment.user_name[0]}</div>
          ${comment.user_name} <span class="comment-role">${formatRole(comment.user_role)}</span>
        </div>
        <div class="comment-text">${comment.content}</div>
        <div class="comment-time">just now</div>
      </div>
    `;
    document.getElementById('comment-input').value = '';
    commEl.scrollTop = commEl.scrollHeight;
  } catch (e) { alert(e.message); }
}

async function editTaskFromDetail() {
  const id = document.getElementById('detail-task-id').value;
  closeAllModals();
  state.editingTaskId = id;
  const task = await api(`/tasks/${id}`);

  document.getElementById('task-modal-title').textContent = 'Edit Task';
  document.getElementById('task-title').value = task.title;
  document.getElementById('task-desc').value = task.description || '';
  document.getElementById('task-priority').value = task.priority;
  document.getElementById('task-type').value = task.type;
  document.getElementById('task-due').value = task.due_date || '';

  const proj = await api(`/projects/${state.currentProject.id}`);
  document.getElementById('task-assignee').innerHTML =
    '<option value="">— Unassigned —</option>' +
    proj.members.map(m => `<option value="${m.id}" ${task.assigned_to == m.id ? 'selected' : ''}>${m.name} (${formatRole(m.role)})</option>`).join('');

  openModal('modal-task');
}

async function deleteTaskFromDetail() {
  if (!confirm('Delete this task?')) return;
  const id = document.getElementById('detail-task-id').value;
  try {
    await api(`/tasks/${id}`, 'DELETE');
    closeAllModals();
    loadBoard();
  } catch (e) { alert(e.message); }
}

// ========================
// USERS
// ========================
async function loadUsers() {
  try {
    state.users = await api('/users');
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = state.users.map(u => `
      <tr>
        <td><strong>${u.name}</strong></td>
        <td style="color:#6b7280">${u.email}</td>
        <td><span class="role-badge role-${u.role}">${formatRole(u.role)}</span></td>
        <td style="color:#9ca3af;font-size:12px">${new Date(u.created_at).toLocaleDateString()}</td>
        <td>
          <div class="table-actions">
            <button class="btn-ghost small" onclick="openEditUser(${u.id})">Edit</button>
            ${u.id !== state.user.id ? `<button class="btn-danger small" onclick="deleteUser(${u.id})">Delete</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) { console.error(e); }
}

function openNewUserModal() {
  document.getElementById('user-modal-title').textContent = 'Add Member';
  document.getElementById('edit-user-id').value = '';
  document.getElementById('user-name').value = '';
  document.getElementById('user-email').value = '';
  document.getElementById('user-password').value = '';
  document.getElementById('user-role').value = 'developer';
  openModal('modal-user');
}

async function openEditUser(id) {
  const u = state.users.find(u => u.id === id);
  if (!u) return;
  document.getElementById('user-modal-title').textContent = 'Edit Member';
  document.getElementById('edit-user-id').value = u.id;
  document.getElementById('user-name').value = u.name;
  document.getElementById('user-email').value = u.email;
  document.getElementById('user-password').value = '';
  document.getElementById('user-role').value = u.role;
  openModal('modal-user');
}

async function saveUser() {
  const id = document.getElementById('edit-user-id').value;
  const body = {
    name: document.getElementById('user-name').value.trim(),
    email: document.getElementById('user-email').value.trim(),
    role: document.getElementById('user-role').value
  };
  const pw = document.getElementById('user-password').value;
  if (pw) body.password = pw;
  if (!body.name || !body.email) return alert('Name and email required');

  try {
    if (id) {
      await api(`/users/${id}`, 'PUT', body);
    } else {
      if (!pw) return alert('Password required for new users');
      await api('/users', 'POST', body);
    }
    closeAllModals();
    loadUsers();
  } catch (e) { alert(e.message); }
}

async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  try {
    await api(`/users/${id}`, 'DELETE');
    loadUsers();
  } catch (e) { alert(e.message); }
}

// ========================
// MODAL HELPERS
// ========================
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
  document.body.style.overflow = '';
}

// ========================
// EVENT LISTENERS
// ========================
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  // Login
  document.getElementById('login-btn').addEventListener('click', login);
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

  // Nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigateTo(el.dataset.page); });
  });

  // Hamburger
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
  document.getElementById('sidebar-close').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', logout);

  // Modals close
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(el => {
    el.addEventListener('click', closeAllModals);
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeAllModals(); });
  });

  // Projects
  document.getElementById('new-project-btn').addEventListener('click', openNewProjectModal);
  document.getElementById('save-project-btn').addEventListener('click', saveProject);

  // Tasks
  document.getElementById('new-task-btn').addEventListener('click', openNewTaskModal);
  document.getElementById('save-task-btn').addEventListener('click', saveTask);
  document.getElementById('ai-gen-btn').addEventListener('click', generateAIDescription);

  // Board filters
  document.getElementById('board-filter-user').addEventListener('change', loadBoard);
  document.getElementById('board-filter-priority').addEventListener('change', loadBoard);

  // Task Detail
  document.getElementById('detail-status').addEventListener('change', updateTaskStatus);
  document.getElementById('add-comment-btn').addEventListener('click', addComment);
  document.getElementById('detail-edit-btn').addEventListener('click', editTaskFromDetail);
  document.getElementById('detail-delete-btn').addEventListener('click', deleteTaskFromDetail);

  // Users
  document.getElementById('new-user-btn').addEventListener('click', openNewUserModal);
  document.getElementById('save-user-btn').addEventListener('click', saveUser);
});
