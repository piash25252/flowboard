# FlowBoard 🚀
### Project Management Tool for Software Teams

---

## Features
- ✅ Role-based login: Admin, Project Manager, Developer, QA Tester
- ✅ Admin creates all user accounts
- ✅ Kanban Board: Todo → In Progress → Review → Done
- ✅ Task assign, priority, due date, type (task/bug/feature)
- ✅ AI-powered task description generation
- ✅ Comments on tasks
- ✅ Activity log
- ✅ Mobile responsive

---

## Local Setup (Development)

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env

# 3. Start server
npm start

# App runs at: http://localhost:3000
# Default login: admin@flowboard.com / admin123
```

---

## Deploy on Render.com (FREE)

1. Push code to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Settings:
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Environment: Node
5. Add Environment Variable:
   - `JWT_SECRET` = any random 32+ character string
6. Click Deploy!

**Note:** Free tier on Render spins down after 15 mins of inactivity. First request may be slow.

---

## Deploy on Railway.app (FREE alternative)

1. Go to https://railway.app
2. New Project → Deploy from GitHub
3. Add env var: `JWT_SECRET`
4. Deploy!

---

## Role Permissions

| Feature | Admin | Project Manager | Developer | QA Tester |
|---------|-------|----------------|-----------|-----------|
| Create users | ✅ | ❌ | ❌ | ❌ |
| Create projects | ✅ | ✅ | ❌ | ❌ |
| Create tasks | ✅ | ✅ | ❌ | ❌ |
| Update all tasks | ✅ | ✅ | ❌ | ❌ |
| Update own tasks status | ✅ | ✅ | ✅ | ✅ |
| Add comments | ✅ | ✅ | ✅ | ✅ |
| View board | ✅ | ✅ | ✅ (own tasks) | ✅ |

---

## Default Admin
- Email: `admin@flowboard.com`
- Password: `admin123`
- **Change this password immediately after first login!**
