# QuickTIMS — AI Project Intelligence

## Skills
Before writing or reviewing ANY code, always read and strictly follow:
mnt/skills/user/senior-fullstack/SKILL.md

---

## Product Overview
QuickTIMS is a multi-tenant workforce management SaaS platform.
Organizations use it to manage employee time tracking (with GPS + photo verification),
leaves, payroll, scheduling, tasks for field workers, and admin reports.
Every piece of data is strictly isolated by organization — no exceptions.

---

## Tech Stack

### Frontend
- React 19 + Vite (JSX only, never TSX)
- Redux Toolkit — all global state management (never useState for shared state)
- React Router v6 — always useNavigate(), never window.location
- Leaflet / React Leaflet — all maps and geolocation UI
- Lucide React — all icons
- Google OAuth via @react-oauth/google
- Inline styles only using CSS variables — no Tailwind, no CSS modules
- No external UI libraries — build every component from scratch

### Backend
- Python 3.13 — Django 5.2
- Django REST Framework (DRF) — all APIs
- MongoDB via official django-mongodb-backend
- JWT Authentication — djangorestframework-simplejwt
- Bearer token in Authorization header
- Pillow — image handling (photo verification on clock-in)
- NO Pydantic — use DRF Serializers for all validation

### Database
- MongoDB via django-mongodb-backend
- No raw PyMongo — always use Django ORM with mongodb backend

---

## CSS Variables (ALWAYS use these — never hardcode colors)
- var(--bg)         → page background
- var(--surface)    → card / panel background
- var(--fg)         → primary text
- var(--muted)      → secondary / hint text
- var(--stroke)     → border
- var(--stroke2)    → subtle border / divider

## Brand Colors (use only for accents, prefer CSS variables)
- Primary:   #5d5fef   (indigo — buttons, active states)
- Success:   #059669   (green — clocked in, approved, complete)
- Danger:    #E94560   (red — errors, clocked out, rejected)
- Warning:   #f59e0b   (amber — pending, in-review)
- Dark bg:   #0e1116
- Dark mid:  #1e1b4b

---

## Project Structure

quicktims/
├── CLAUDE.md                          ← you are here
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── OnboardingPage.jsx
│       │   ├── DashboardPage.jsx
│       │   ├── LocationsPage.jsx
│       │   ├── TimePage.jsx           # GPS clock in/out + photo
│       │   ├── TasksPage.jsx          # Field worker tasks
│       │   ├── LeavesPage.jsx
│       │   ├── PayrollPage.jsx
│       │   ├── SchedulingPage.jsx
│       │   ├── EmployeesPage.jsx
│       │   ├── ReportsPage.jsx
│       │   └── SettingsPage.jsx
│       ├── components/                # Reusable UI pieces
│       ├── store/                     # Redux Toolkit slices
│       ├── hooks/                     # Custom React hooks
│       ├── utils/                     # Helper functions
│       ├── routes.js                  # ALL route constants live here
│       └── main.jsx
├── backend/
│   ├── manage.py
│   ├── config/                        # Django settings
│   ├── accounts/                      # Auth, JWT, Google OAuth, roles
│   ├── employees/                     # Employee profiles
│   ├── time_tracking/                 # Clock in/out, breaks, GPS, photo
│   ├── leaves/                        # Leave requests and approvals
│   ├── payroll/                       # Payroll periods and records
│   ├── scheduling/                    # Shifts
│   ├── reports/                       # Admin overview and stats
│   └── tasks/                         # Field worker task management
└── mnt/
    └── skills/
        └── user/
            └── senior-fullstack/
                └── SKILL.md

---

## Modules, Pages & Routes

| Route         | Page             | Description                                  |
|---------------|------------------|----------------------------------------------|
| /login        | LoginPage        | JWT login + Google OAuth                     |
| /onboarding   | OnboardingPage   | 3-step org setup wizard                      |
| /             | DashboardPage    | Overview, stats, quick actions               |
| /locations    | LocationsPage    | Office locations and geofence config         |
| /time         | TimePage         | GPS clock in/out, photo verification, breaks |
| /tasks        | TasksPage        | Field worker task list and actions           |
| /leaves       | LeavesPage       | Apply, approve, track leave requests         |
| /payroll      | PayrollPage      | Payroll periods, records, payslips           |
| /scheduling   | SchedulingPage   | Employee shift scheduling                    |
| /employees    | EmployeesPage    | Employee directory, profiles, roles          |
| /reports      | ReportsPage      | Admin overview and analytics                 |
| /settings     | SettingsPage     | Org settings, roles, config                  |

---

## API Endpoints

### Auth — /api/auth/
- POST   /api/auth/login/              # JWT login
- POST   /api/auth/register/           # User registration
- POST   /api/auth/google/             # Google OAuth login
- POST   /api/auth/refresh/            # JWT token refresh
- GET    /api/auth/me/                 # Current user profile

### Employees — /api/employees/
- GET    /api/employees/               # List all employees
- POST   /api/employees/               # Create employee
- GET    /api/employees/<id>/          # Employee details
- PUT    /api/employees/<id>/          # Full update
- PATCH  /api/employees/<id>/          # Partial update
- DELETE /api/employees/<id>/          # Delete employee

### Time Tracking — /api/time/
- POST   /api/time/clock-in/                           # Clock in with GPS + photo
- POST   /api/time/clock-out/                          # Clock out
- POST   /api/time/break/start/                        # Start break
- POST   /api/time/break/end/                          # End break
- GET    /api/time/timesheets/                         # View timesheets
- GET    /api/time/logs/                               # List time logs
- POST   /api/time/logs/                               # Create time log
- GET    /api/time/logs/<id>/                          # Time log detail
- PUT    /api/time/logs/<id>/                          # Edit time log
- PATCH  /api/time/logs/<id>/                          # Partial edit
- DELETE /api/time/logs/<id>/                          # Delete time log
- GET    /api/time/admin/employees/<employee_id>/logs/ # Admin: employee logs

### Leaves — /api/leaves/
- GET    /api/leaves/                  # List leave requests
- POST   /api/leaves/                  # Create leave request
- GET    /api/leaves/<id>/             # Leave detail
- PUT    /api/leaves/<id>/             # Update leave
- PATCH  /api/leaves/<id>/             # Approve / reject
- DELETE /api/leaves/<id>/             # Delete leave

### Payroll — /api/payroll/
- POST   /api/payroll/generate/        # Generate payroll for a period
- GET    /api/payroll/records/         # List payroll records
- POST   /api/payroll/records/         # Create record
- GET    /api/payroll/records/<id>/    # Record detail
- PUT    /api/payroll/records/<id>/    # Update record
- PATCH  /api/payroll/records/<id>/    # Partial update
- DELETE /api/payroll/records/<id>/    # Delete record

### Scheduling — /api/scheduling/
- GET    /api/scheduling/shifts/       # List shifts
- POST   /api/scheduling/shifts/       # Create shift
- GET    /api/scheduling/shifts/<id>/  # Shift detail
- PUT    /api/scheduling/shifts/<id>/  # Update shift
- PATCH  /api/scheduling/shifts/<id>/  # Partial update
- DELETE /api/scheduling/shifts/<id>/  # Delete shift

### Reports — /api/reports/
- GET    /api/reports/overview/        # Admin overview statistics

### Tasks — /api/tasks/
- GET    /api/tasks/admin/                      # Admin: list all tasks
- POST   /api/tasks/admin/                      # Admin: create task
- GET    /api/tasks/admin/<pk>/                 # Admin: task detail
- PUT    /api/tasks/admin/<pk>/                 # Admin: update task
- PATCH  /api/tasks/admin/<pk>/                 # Admin: partial update
- DELETE /api/tasks/admin/<pk>/                 # Admin: delete task
- POST   /api/tasks/admin/<pk>/attachments/     # Add attachment to task
- GET    /api/tasks/my/                         # Employee: my tasks
- POST   /api/tasks/my/<pk>/<action>/           # Employee: start/complete task

---

## MongoDB Collections (Django Models)

| App            | Model          | Collection Purpose                        |
|----------------|----------------|-------------------------------------------|
| accounts       | User           | Users, auth credentials, roles            |
| employees      | Employee       | Profile, hourly rate, hire date           |
| time_tracking  | TimeLog        | Clock in/out sessions, GPS, photo         |
| time_tracking  | Break          | Breaks within a TimeLog session           |
| leaves         | LeaveRequest   | Leave applications and approval status    |
| payroll        | PayrollPeriod  | Payroll intervals (start/end dates)       |
| payroll        | PayrollRecord  | Calculated pay per employee per period    |
| scheduling     | Shift          | Scheduled shifts per employee             |
| tasks          | Task           | Jobs assigned to field workers            |
| tasks          | TaskAttachment | Files/photos uploaded for tasks           |

---

## Roles & Permissions

| Role     | Access                                                       |
|----------|--------------------------------------------------------------|
| Admin    | Full access — all modules, all employees, reports, settings  |
| Employee | Own timesheets, own leaves, own tasks, own payslips only     |

- Role stored on User model in accounts app
- Always enforce role checks in backend — never trust frontend
- Admin-only endpoints use /admin/ prefix in URL

---

## Time Tracking — GPS + Photo Rules

### Frontend (TimePage.jsx)
- Use Leaflet / React Leaflet for live map preview
- Use browser navigator.geolocation for GPS coordinates
- Always request: { enableHighAccuracy: true, timeout: 10000 }
- Show GPS status: Acquiring → Locked → Error
- Capture photo via device camera before allowing clock-in
- Disable clock-in button until GPS locked + photo captured
- Send { latitude, longitude, accuracy, photo } on clock-in

### Backend (time_tracking app)
- Validate GPS coords against org geofence on every clock-in
- Reject clock-in if outside geofence radius — return 403
- Store photo using Pillow + Django FileField — never base64 in DB
- Prevent duplicate clock-in (must clock out before clocking in again)
- Record break start/end only within an active TimeLog session

---

## React Coding Rules

- Named exports only: export function PageName()
- Redux Toolkit for ALL shared/global state — never prop drill
- Every page entry animates: style={{ animation: "fadeUp 0.4s ease both" }}
- Buttons: className="btn btnPrimary" or "btn btnGhost"
- Form fields: className="field" + className="fieldLabel" + className="input"
- LocalStorage prefix: "quicktims." (e.g. quicktims.orgName, quicktims.token)
- Custom events prefix: "quicktims:" (e.g. quicktims:clockIn)
- All routes imported from routes.js — never hardcode path strings in pages
- Google OAuth: always use @react-oauth/google — never implement manually

---

## Django / DRF Rules

- All API views use DRF ViewSets or APIViews
- Business logic: NEVER in views — always in a service function or model method
- DRF Serializers for ALL request/response validation — no Pydantic
- Permissions: always use DRF permission classes (IsAuthenticated, IsAdminUser)
- Standard success response: { "success": true, "data": {}, "message": "" }
- Standard error response: { "success": false, "message": "..." } + correct HTTP status
- All datetimes: UTC, stored as ISO 8601
- JWT: Bearer token via djangorestframework-simplejwt — never session auth

---

## MongoDB / Django ORM Rules

- Always use Django ORM — never raw PyMongo queries
- Every queryset must be scoped to org or user — no unscoped queries
- Passwords: Django built-in hashing — never plain text
- Images: stored via Pillow + Django FileField — never base64 in DB

---

## Hard Rules — Never Violate These

- No raw PyMongo — always Django ORM with mongodb backend
- No unscoped queries — always filter by org/user
- No plain text passwords
- No base64 images stored in MongoDB — use Pillow + FileField
- No class components in React — functional only
- No prop drilling — use Redux Toolkit for shared state
- No hardcoded route strings in pages — always import from routes.js
- No external CSS frameworks — inline styles + CSS variables only
- No GPS clock-in without photo verification
- No duplicate clock-in without clock-out in between
- No employee accessing another employee's data
- No Pydantic models — use DRF Serializers only