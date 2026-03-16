# NEU Library Visitor Log

A digital visitor management system for the New Era University Library.
Built with React, Firebase, and Tailwind CSS.

---

## Features

**Visitors**
- Google Sign-In with role & college selection on first login
- Check-in with visit reason (Reading, Research, Studying, etc.)
- Personal visit history and total visit count

**Admins**
- Dashboard with visitor stats, unique users, peak college
- Filter logs by today / weekly / monthly / custom date range
- Search logs by name, email, or college
- Export logs to CSV / Clear all logs
- Block or unblock users
- Approve or reject Faculty/Admin role requests
- Pie chart breakdown of visit reasons

---

## Tech Stack

| | |
|---|---|
| Frontend | React 19, TypeScript, Vite 6 |
| Styling | Tailwind CSS v4, Framer Motion |
| Charts | Recharts |
| Backend | Firebase Firestore + Google Auth |
| Utilities | date-fns, Lucide React |

---

## Getting Started
```bash
# 1. Install dependencies
npm install

# 2. Add your Firebase credentials
#    Edit firebase-applet-config.json

# 3. Start the dev server
npm run dev
```

---

## User Roles

| Role | Auto-Approved | Access |
|------|:---:|---|
| Student | ✅ | Check-in, visit history |
| Faculty | ❌ | Check-in after admin approval |
| Admin | ✅ | Full dashboard & management |

---

## Data Model

**`/users/{userId}`** — profile, role, college, blocked/approved status

**`/logs/{logId}`** — visitor name, email, college, reason, timestamp

---

## Project Structure
```
src/
├── App.tsx       — Auth flow, user & admin views
├── firebase.ts   — Firebase initialization
├── types.ts      — Interfaces, roles, colleges, reasons
└── main.tsx      — Entry point
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm run lint` | TypeScript type check |
| `npm run clean` | Remove dist folder |
