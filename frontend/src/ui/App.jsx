import { lazy, Suspense } from "react"
import { Navigate, Outlet, Route, Routes } from "react-router-dom"
import { useAuth } from "../state/auth/useAuth.js"
import { useRole } from "../state/auth/useRole.js"
import { routes } from "./routes.js"
import { AppShell } from "./shell/AppShell.jsx"
import { SessionToast } from "./components/SessionToast.jsx"
import { LoginPage } from "./pages/LoginPage.jsx"

// Lazy-loaded Pages
const OrganizationSignupPage = lazy(() =>
  import("./pages/OrganizationSignupPage.jsx").then(m => ({ default: m.OrganizationSignupPage }))
)

const AcceptInvitePage = lazy(() =>
  import("./pages/AcceptInvitePage.jsx").then(m => ({ default: m.AcceptInvitePage }))
)

const ActivationJourneyPage = lazy(() =>
  import("./pages/ActivationJourneyPage.jsx").then(m => ({ default: m.ActivationJourneyPage }))
)

const CreatePasswordPage = lazy(() =>
  import("./pages/CreatePasswordPage.jsx").then(m => ({ default: m.CreatePasswordPage }))
)


const DashboardPage = lazy(() =>
  import("./pages/DashboardPage.jsx").then(m => ({ default: m.DashboardPage }))
)

const AnalysisPage = lazy(() =>
  import("./pages/AnalysisPage.jsx").then(m => ({ default: m.AnalysisPage }))
)

const ResetPasswordPage = lazy(() =>
  import("./pages/ResetPasswordPage.jsx").then(m => ({ default: m.ResetPasswordPage }))
)

const LocationsPage = lazy(() =>
  import("./pages/LocationsPage.jsx").then(m => ({ default: m.LocationsPage }))
)

const EmployeesPage = lazy(() =>
  import("./pages/EmployeesPage.jsx").then(m => ({ default: m.EmployeesPage }))
)

const LeavesPage = lazy(() =>
  import("./pages/LeavesPage.jsx").then(m => ({ default: m.LeavesPage }))
)

const PayrollPage = lazy(() =>
  import("./pages/PayrollPage.jsx").then(m => ({ default: m.PayrollPage }))
)

const ReportsPage = lazy(() =>
  import("./pages/ReportsPage.jsx").then(m => ({ default: m.ReportsPage }))
)

const SchedulingPage = lazy(() =>
  import("./pages/SchedulingPage.jsx").then(m => ({ default: m.SchedulingPage }))
)

const TasksPage = lazy(() =>
  import("./pages/TasksPage.jsx").then(m => ({ default: m.TasksPage }))
)

const TimePage = lazy(() =>
  import("./pages/TimePage.jsx").then(m => ({ default: m.TimePage }))
)

const AuditLedgerPage = lazy(() =>
  import("./pages/AuditLedgerPage.jsx")
)

const SettingsPage = lazy(() =>
  import("./pages/SettingsPage.jsx").then(m => ({ default: m.SettingsPage }))
)

const OnboardingPage = lazy(() =>
  import("./pages/OnboardingPage.jsx").then(m => ({ default: m.OnboardingPage }))
)

const GetStartedPage = lazy(() =>
  import("./pages/GetStartedPage.jsx").then(m => ({ default: m.GetStartedPage }))
)

const LiveLocationsPage = lazy(() =>
  import("./pages/LiveLocationsPage.jsx").then(m => ({ default: m.LiveLocationsPage }))
)

const PeopleSettingsPage = lazy(() =>
  import("./pages/PeopleSettingsPage.jsx").then(m => ({ default: m.PeopleSettingsPage }))
)

const TimeTrackingSettingsPage = lazy(() =>
  import("./pages/TimeTrackingSettingsPage.jsx").then(m => ({ default: m.TimeTrackingSettingsPage }))
)

const WorkSchedulesSettingsPage = lazy(() =>
  import("./pages/WorkSchedulesSettingsPage.jsx").then(m => ({ default: m.WorkSchedulesSettingsPage }))
)

const HolidaysSettingsPage = lazy(() =>
  import("./pages/HolidaysSettingsPage.jsx").then(m => ({ default: m.HolidaysSettingsPage }))
)

const LocationsSettingsPage = lazy(() =>
  import("./pages/LocationsSettingsPage.jsx").then(m => ({ default: m.LocationsSettingsPage }))
)

const CompliancePage = lazy(() =>
  import("./pages/CompliancePage.jsx").then(m => ({ default: m.CompliancePage }))
)

const InventoryPage = lazy(() =>
  import("./pages/InventoryPage.jsx").then(m => ({ default: m.InventoryPage }))
)

const MileagePage = lazy(() =>
  import("./pages/MileagePage.jsx").then(m => ({ default: m.MileagePage }))
)

const ApprovalCenterPage = lazy(() =>
  import("./pages/ApprovalCenterPage.jsx").then(m => ({ default: m.ApprovalCenterPage }))
)

const EmployeesDashboardPage = lazy(() =>
  import("./pages/EmployeeSubPages.jsx").then(m => ({ default: m.EmployeesDashboardPage }))
)
const ApprovedEmployeesPage = lazy(() =>
  import("./pages/EmployeeSubPages.jsx").then(m => ({ default: m.ApprovedEmployeesPage }))
)
const RejectedEmployeesPage = lazy(() =>
  import("./pages/EmployeeSubPages.jsx").then(m => ({ default: m.RejectedEmployeesPage }))
)
const DocumentVaultPage = lazy(() =>
  import("./pages/EmployeeSubPages.jsx").then(m => ({ default: m.DocumentVaultPage }))
)
const TrainingRecordsPage = lazy(() =>
  import("./pages/EmployeeSubPages.jsx").then(m => ({ default: m.TrainingRecordsPage }))
)

const BookingPage = lazy(() =>
  import("./pages/BookingPage.jsx").then(m => ({ default: m.BookingPage }))
)
const FeedbackPage = lazy(() =>
  import("./pages/FeedbackPage.jsx").then(m => ({ default: m.FeedbackPage }))
)
const ServiceRequestsPage = lazy(() =>
  import("./pages/ServiceRequestsPage.jsx").then(m => ({ default: m.ServiceRequestsPage }))
)
const FeedbackManagementPage = lazy(() =>
  import("./pages/FeedbackManagementPage.jsx").then(m => ({ default: m.FeedbackManagementPage }))
)
const EmployeeJobsPage = lazy(() =>
  import("./pages/EmployeeJobsPage.jsx").then(m => ({ default: m.EmployeeJobsPage }))
)
const EmployeeFeedbackPage = lazy(() =>
  import("./pages/EmployeeFeedbackPage.jsx").then(m => ({ default: m.EmployeeFeedbackPage }))
)

// ─── Route Guards ────────────────────────────────────────────

/**
 * RequireAdmin — redirects employees away from admin-only routes.
 * Admins and managers pass through; employees go to the dashboard.
 */
function RequireAdmin() {
  const { isAdmin } = useRole()
  if (!isAdmin) return <Navigate to={routes.dashboard} replace />
  return <Outlet />
}

/**
 * RequireAdminSettings — for settings routes that are admin-only.
 * Employees are redirected to their profile settings (the one section
 * they're allowed to see).
 */
function RequireAdminSettings() {
  const { isAdmin } = useRole()
  if (!isAdmin) return <Navigate to={routes.settings_profile} replace />
  return <Outlet />
}

/**
 * RequireModulePermission — protects routes based on company module permissions.
 * Redirects unauthorized users back to the dashboard.
 */
function RequireModulePermission({ module, action = "view" }) {
  const { user } = useAuth()
  if (!user) return <Navigate to={routes.login} replace />

  const perms = user.companyPermissions
  if (perms) {
    const modulePerms = perms[module]
    if (modulePerms) {
      const checkRole = user.role === "manager" ? "admin" : user.role
      const actions = modulePerms[checkRole] || []
      if (!actions.includes(action)) {
        return <Navigate to={routes.dashboard} replace />
      }
    }
  }
  return <Outlet />
}

const ONBOARDING_DISMISSED_KEY = "caltrack.onboarding.dismissed"

export function App() {
  const { isReady, user } = useAuth()
  const { isAdmin } = useRole()
  console.log("DEBUG: App component rendered. isReady:", isReady, "user:", user, "isAdmin:", isAdmin);

  // Helper: where should an admin land after login?
  const adminDefaultRoute = () => {
    const dismissed = localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true"
    return dismissed ? routes.dashboard : routes.get_started
  }

  const PageLoader = () => (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  )

  if (!isReady)
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg, #f8fafc)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid var(--stroke, #e2e8f0)",
            borderTopColor: "#4F46E5",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path={routes.login}
            element={
              user ? (
                user.companyId ? (
                  <Navigate to={isAdmin ? adminDefaultRoute() : routes.dashboard} replace />
                ) : (
                  <Navigate to={routes.onboarding} replace />
                )
              ) : (
                <LoginPage />
              )
            }
          />

          <Route
            path={routes.organization_signup}
            element={
              user ? (
                user.companyId ? (
                  <Navigate to={isAdmin ? adminDefaultRoute() : routes.dashboard} replace />
                ) : (
                  <Navigate to={routes.onboarding} replace />
                )
              ) : (
                <OrganizationSignupPage />
              )
            }
          />

          <Route
            path={routes.onboarding}
            element={
              !user ? (
                <Navigate to={routes.login} replace />
              ) : user.companyId ? (
                <Navigate to={isAdmin ? adminDefaultRoute() : routes.dashboard} replace />
              ) : (
                <OnboardingPage />
              )
            }
          />

          <Route
            path={routes.activation_journey}
            element={<ActivationJourneyPage />}
          />

          <Route
            path={routes.create_password}
            element={<CreatePasswordPage />}
          />

          <Route
            path={routes.reset_password}
            element={
              user ? <Navigate to={isAdmin ? adminDefaultRoute() : routes.dashboard} replace /> : <ResetPasswordPage />
            }
          />

          <Route
            path={routes.accept_invite}
            element={
              user ? (
                <Navigate to={isAdmin ? adminDefaultRoute() : routes.dashboard} replace />
              ) : (
                <AcceptInvitePage />
              )
            }
          />

          <Route path={routes.booking} element={<BookingPage />} />
          <Route path={routes.feedback} element={<FeedbackPage />} />

          {/* ── Authenticated shell ── */}
          <Route
            element={
              user ? (
                user.companyId ? (
                  <AppShell />
                ) : (
                  <Navigate to={routes.onboarding} replace />
                )
              ) : (
                <Navigate to={routes.login} replace />
              )
            }
          >
            {/* ── Routes accessible by ALL authenticated roles ── */}
            <Route path={routes.dashboard} element={<DashboardPage />} />
            <Route
              path={routes.analysis}
              element={isAdmin ? <Navigate to={routes.dashboard} replace /> : <AnalysisPage />}
            />
            <Route element={<RequireModulePermission module="attendance" action="view" />}>
              <Route path={routes.time} element={<TimePage />} />
            </Route>
            <Route path={routes.tasks} element={<TasksPage />} />
            <Route path={routes.leaves} element={<LeavesPage />} />
            <Route path={routes.inventory} element={<InventoryPage />} />
            <Route path={routes.mileage} element={<MileagePage />} />
            <Route path={routes.employee_jobs} element={<EmployeeJobsPage />} />
            <Route path={routes.employee_feedback} element={<EmployeeFeedbackPage />} />

            {/* Employee profile settings — accessible to everyone */}
            <Route path={routes.settings} element={<SettingsPage />} />
            <Route path={routes.settings_profile} element={<SettingsPage section="profile" />} />
            <Route path={routes.settings_notifications} element={<SettingsPage section="notifications" />} />
            <Route path={routes.settings_preferences} element={<SettingsPage section="preferences" />} />
            <Route path={routes.settings_security} element={<SettingsPage section="security" />} />
            <Route path={routes.settings_data} element={<SettingsPage section="data" />} />

            {/* ── Admin-only routes ── */}
            <Route element={<RequireAdmin />}>
              <Route path={routes.get_started} element={<GetStartedPage />} />
              <Route element={<RequireModulePermission module="locations" action="view" />}>
                <Route path={routes.locations} element={<LocationsPage />} />
              </Route>
              <Route element={<RequireModulePermission module="live_location" action="view" />}>
                <Route path={routes.live_locations} element={<LiveLocationsPage />} />
              </Route>
              <Route element={<RequireModulePermission module="payroll" action="view" />}>
                <Route path={routes.payroll} element={<PayrollPage />} />
              </Route>
              <Route path={routes.scheduling} element={<SchedulingPage />} />
              <Route path={routes.employees} element={<EmployeesPage />} />
              <Route path={routes.audit_ledger} element={<AuditLedgerPage />} />
              <Route element={<RequireModulePermission module="reports" action="view" />}>
                <Route path={routes.reports} element={<ReportsPage />} />
              </Route>
              <Route path={routes.compliance} element={<CompliancePage />} />
              <Route path={routes.approvals} element={<ApprovalCenterPage />} />
              <Route path={routes.employees_dashboard} element={<EmployeesDashboardPage />} />
              <Route path={routes.employees_pending} element={<ApprovalCenterPage />} />
              <Route path={routes.employees_approved} element={<ApprovedEmployeesPage />} />
              <Route path={routes.employees_rejected} element={<RejectedEmployeesPage />} />
              <Route path={routes.employees_documents} element={<DocumentVaultPage />} />
              <Route path={routes.employees_training} element={<TrainingRecordsPage />} />
              <Route path={routes.admin_service_requests} element={<ServiceRequestsPage />} />
              <Route path={routes.admin_feedback} element={<FeedbackManagementPage />} />
              <Route path="/customers/list" element={<ServiceRequestsPage />} />
              <Route path="/customers/bookings" element={<ServiceRequestsPage />} />
              <Route path="/customers/payments" element={<ServiceRequestsPage />} />
              <Route path="/customers/documents" element={<ServiceRequestsPage />} />
              <Route path="/customers/complaints" element={<FeedbackManagementPage />} />
              <Route path="/customers/reviews" element={<FeedbackManagementPage />} />
            </Route>

            {/* ── Admin-only settings (employees redirected to /settings/profile) ── */}
            <Route element={<RequireAdminSettings />}>
              <Route path={routes.settings_people} element={<SettingsPage section="people" />} />
              <Route path={routes.settings_team} element={<SettingsPage section="team" />} />
              <Route path={routes.settings_timetracking} element={<SettingsPage section="time-tracking" />} />
              <Route path={routes.settings_attendance} element={<SettingsPage section="attendance" />} />
              <Route path={routes.settings_schedules} element={<SettingsPage section="schedules" />} />
              <Route path={routes.settings_shiftplanner} element={<SettingsPage section="shift-planner" />} />
              <Route path={routes.settings_holidays} element={<SettingsPage section="holidays" />} />
              <Route path={routes.settings_payroll} element={<SettingsPage section="payroll" />} />
              <Route path={routes.settings_expenses} element={<SettingsPage section="expenses" />} />
              <Route path={routes.settings_workflows} element={<SettingsPage section="workflows" />} />
              <Route path={routes.settings_productivity} element={<SettingsPage section="productivity" />} />
              <Route path={routes.settings_reports} element={<SettingsPage section="reports" />} />
              <Route path={routes.settings_rbac} element={<SettingsPage section="rbac" />} />
              <Route path={routes.settings_audit} element={<SettingsPage section="audit" />} />
              <Route path={routes.settings_devices} element={<SettingsPage section="devices" />} />
              <Route path={routes.settings_location} element={<SettingsPage section="location" />} />
              <Route path={routes.settings_branding} element={<SettingsPage section="branding" />} />
              <Route path={routes.settings_organization} element={<SettingsPage section="organization" />} />
              <Route path={routes.settings_integrations} element={<SettingsPage section="integrations" />} />
              <Route path={routes.settings_developer} element={<SettingsPage section="developer" />} />
              <Route path={routes.settings_billing} element={<SettingsPage section="billing" />} />
              <Route path={routes.settings_invoices} element={<SettingsPage section="invoices" />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to={routes.dashboard} replace />} />
        </Routes>
      </Suspense>
      <SessionToast />
    </>
  )
}
