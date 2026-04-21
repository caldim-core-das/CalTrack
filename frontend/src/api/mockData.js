/**
 * Mock data – used as a fallback when the backend is unreachable.
 * Keyed by the API path prefix.
 */

export const MOCK = {
  "/employees/": {
    count: 6,
    results: [
      { id: 1, employee_id: "EMP001", title: "Senior Engineer",   hourly_rate: 42.50, is_active: true,  user: { username: "alice" } },
      { id: 2, employee_id: "EMP002", title: "Product Designer",   hourly_rate: 38.00, is_active: true,  user: { username: "bob" } },
      { id: 3, employee_id: "EMP003", title: "QA Engineer",        hourly_rate: 32.00, is_active: true,  user: { username: "carol" } },
      { id: 4, employee_id: "EMP004", title: "DevOps Specialist",  hourly_rate: 45.00, is_active: true,  user: { username: "david" } },
      { id: 5, employee_id: "EMP005", title: "Project Manager",    hourly_rate: 50.00, is_active: true,  user: { username: "eva" } },
      { id: 6, employee_id: "EMP006", title: "UI/UX Intern",       hourly_rate: 20.00, is_active: false, user: { username: "frank" } }
    ]
  },

  "/leaves/": {
    count: 5,
    results: [
      { id: 1, leave_type: "vacation", start_date: "2026-03-20", end_date: "2026-03-25", status: "approved",  reason: "Family trip" },
      { id: 2, leave_type: "sick",     start_date: "2026-03-10", end_date: "2026-03-11", status: "approved",  reason: "Fever" },
      { id: 3, leave_type: "unpaid",   start_date: "2026-04-01", end_date: "2026-04-03", status: "pending",   reason: "Personal" },
      { id: 4, leave_type: "vacation", start_date: "2026-02-14", end_date: "2026-02-16", status: "rejected",  reason: "Valentine trip" },
      { id: 5, leave_type: "sick",     start_date: "2026-03-05", end_date: "2026-03-05", status: "approved",  reason: "Doctor visit" }
    ]
  },

  "/time/logs/": {
    count: 5,
    results: [
      { id: 1, work_date: "2026-03-18", clock_in: "2026-03-18T09:02:00Z", clock_out: "2026-03-18T18:05:00Z", worked_hours: "9.05", breaks: [] },
      { id: 2, work_date: "2026-03-17", clock_in: "2026-03-17T08:58:00Z", clock_out: "2026-03-17T17:55:00Z", worked_hours: "8.95", breaks: [{ id: 1, break_start: "2026-03-17T12:00:00Z", break_end: "2026-03-17T13:00:00Z" }] },
      { id: 3, work_date: "2026-03-14", clock_in: "2026-03-14T09:10:00Z", clock_out: "2026-03-14T18:20:00Z", worked_hours: "9.17", breaks: [] },
      { id: 4, work_date: "2026-03-13", clock_in: "2026-03-13T08:45:00Z", clock_out: "2026-03-13T17:50:00Z", worked_hours: "9.08", breaks: [] },
      { id: 5, work_date: "2026-03-12", clock_in: "2026-03-12T09:00:00Z", clock_out: "2026-03-12T18:00:00Z", worked_hours: "9.00", breaks: [] }
    ]
  },

  "/time/timesheets/": {
    range: { start: "2026-03-12", end: "2026-03-18" },
    totals: { hours: 45.25, overtime_hours: 5.25 },
    daily: [
      { date: "2026-03-12", hours: 9.00, overtime_hours: 1.00 },
      { date: "2026-03-13", hours: 9.08, overtime_hours: 1.08 },
      { date: "2026-03-14", hours: 9.17, overtime_hours: 1.17 },
      { date: "2026-03-17", hours: 8.95, overtime_hours: 0.95 },
      { date: "2026-03-18", hours: 9.05, overtime_hours: 1.05 }
    ]
  },

  "/scheduling/shifts/": {
    count: 4,
    results: [
      { id: 1, title: "Front Desk",   shift_start: "2026-03-19T09:00:00Z", shift_end: "2026-03-19T17:00:00Z", employee: 1, notes: "" },
      { id: 2, title: "Night Watch",  shift_start: "2026-03-20T20:00:00Z", shift_end: "2026-03-21T06:00:00Z", employee: 2, notes: "" },
      { id: 3, title: "Morning Rush", shift_start: "2026-03-21T07:00:00Z", shift_end: "2026-03-21T15:00:00Z", employee: 3, notes: "" },
      { id: 4, title: "Dev Sprint",   shift_start: "2026-03-10T09:00:00Z", shift_end: "2026-03-10T18:00:00Z", employee: 1, notes: "Sprint review" }
    ]
  },

  "/payroll/records/": {
    count: 3,
    results: [
      {
        id: 1,
        employee: "EMP001",
        employee_name: "alice",
        net_pay: "3820.50",
        regular_hours: "80.00",
        overtime_hours: "6.00",
        period: { start_date: "2026-03-01", end_date: "2026-03-15" }
      },
      {
        id: 2,
        employee: "EMP002",
        employee_name: "bob",
        net_pay: "4012.00",
        regular_hours: "80.00",
        overtime_hours: "10.50",
        period: { start_date: "2026-02-15", end_date: "2026-02-28" }
      },
      {
        id: 3,
        employee: "EMP003",
        employee_name: "carol",
        net_pay: "3600.00",
        regular_hours: "80.00",
        overtime_hours: "0.00",
        period: { start_date: "2026-02-01", end_date: "2026-02-14" }
      }
    ]
  },

  "/reports/overview/": {
    range: { start: "2026-02-16", end: "2026-03-18" },
    employees:      { total: 6, active: 5 },
    leaves:         { pending: 1, approved_in_range: 3 },
    time_tracking:  { time_logs_in_range: 42 },
    payroll:        { records_generated_in_range: 2 }
  }
}

/**
 * Return mock data for a given API path, or null if no mock exists.
 * Matches by prefix so query strings like ?start=... still resolve.
 */
export function getMock(path) {
  for (const key of Object.keys(MOCK)) {
    if (path.startsWith(key) || path === key.slice(0, -1)) {
      return MOCK[key]
    }
  }
  return null
}
