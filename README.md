# Bazar Retail – Attendance Management System

A full-stack web application for managing employee attendance.

**Stack:** React.js · Node.js/Express · Supabase (PostgreSQL) · JWT · ExcelJS

---

## Project Structure

```
bazar-attendance/
├── backend/
│   ├── config/supabase.js
│   ├── middleware/auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── employees.js
│   │   ├── departments.js
│   │   └── attendance.js
│   ├── server.js
│   ├── supabase_schema.sql
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── public/index.html
    ├── src/
    │   ├── components/
    │   │   ├── Topbar.js
    │   │   └── LiveClock.js
    │   ├── context/AuthContext.js
    │   ├── pages/
    │   │   ├── LoginPage.js
    │   │   ├── EmployeePage.js
    │   │   └── AdminPage.js
    │   ├── utils/api.js
    │   ├── App.js
    │   ├── index.js
    │   └── index.css
    ├── .env.example
    └── package.json
```

---

## Step 1 — Set up Supabase

1. Go to https://supabase.com → Create a new project
2. Go to **SQL Editor** → paste the contents of `backend/supabase_schema.sql` → Run
3. Go to **Project Settings → API** → copy:
   - Project URL
   - Service Role Key (secret)

---

## Step 2 — Set up the Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` and fill in:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=any_random_secret_string
ADMIN_USERNAME=bazarHR
ADMIN_PASSWORD=bazar@HR
PORT=5000
FRONTEND_URL=http://localhost:3000
```

Start the backend:
```bash
npm run dev      # development (with nodemon)
# or
npm start        # production
```

Backend runs at: http://localhost:5000

---

## Step 3 — Set up the Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `.env`:
```
REACT_APP_API_URL=http://localhost:5000/api
```

Start the frontend:
```bash
npm start
```

Frontend runs at: http://localhost:3000

---

## Step 4 — Add First Employee via Admin

1. Open http://localhost:3000
2. Switch to Admin Login → use `bazarHR` / `bazar@HR`
3. Go to Employees tab → Add Employee
4. Set Employee ID (e.g. EMP001), Name, Department, Password
5. Employee can now log in on the Employee portal

---

## Default Admin Credentials

| Field    | Value      |
|----------|------------|
| Username | bazarHR    |
| Password | bazar@HR   |

---

## Features

### Employee Portal
- Secure JWT login
- Mark Present / Absent (once per day)
- Attendance window: 9:00 AM – 10:00 AM
- Monthly summary with attendance percentage

### Admin Portal
- Live clock (updates every second)
- Dashboard with 4 stat cards
- Today's attendance table (auto-refreshes every 15s)
- Not Marked table (visible after 9:45 AM, live updates)
- Employee management (Add / Edit / Delete / Reset Password)
- Department management (Add / Edit / Delete)
- Attendance records with search + filters
- Download Excel (.xlsx) with 2 sheets

---

## Deployment

### Backend → Render
1. Push backend folder to GitHub
2. Create a new Web Service on https://render.com
3. Add all env variables from `.env`
4. Build command: `npm install` | Start command: `node server.js`

### Frontend → Vercel
1. Push frontend folder to GitHub
2. Import on https://vercel.com
3. Set env variable: `REACT_APP_API_URL=https://your-render-url.onrender.com/api`
4. Deploy

---

## API Endpoints

| Method | Endpoint | Access |
|--------|----------|--------|
| POST | /api/auth/admin/login | Public |
| POST | /api/auth/employee/login | Public |
| GET | /api/employees | Admin |
| POST | /api/employees | Admin |
| PUT | /api/employees/:id | Admin |
| DELETE | /api/employees/:id | Admin |
| PATCH | /api/employees/:id/reset-password | Admin |
| GET | /api/departments | Auth |
| POST | /api/departments | Admin |
| PUT | /api/departments/:id | Admin |
| DELETE | /api/departments/:id | Admin |
| POST | /api/attendance/submit | Employee |
| GET | /api/attendance/today/me | Employee |
| GET | /api/attendance/monthly/me | Employee |
| GET | /api/attendance | Admin |
| GET | /api/attendance/not-marked | Admin |
| GET | /api/attendance/export | Admin |
