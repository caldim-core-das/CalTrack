import { Navigate, Route, Routes } from "react-router-dom"

import { useAuth } from "../state/auth/useAuth.js"
import { routes } from "./routes.js"
import { AppShell } from "./shell/AppShell.jsx"
import { DashboardPage } from "./pages/DashboardPage.jsx"
import { LocationsPage } from "./pages/LocationsPage.jsx"
import { EmployeesPage } from "./pages/EmployeesPage.jsx"
import { LeavesPage } from "./pages/LeavesPage.jsx"
import { LoginPage } from "./pages/LoginPage.jsx"
import { PayrollPage } from "./pages/PayrollPage.jsx"
import { ReportsPage } from "./pages/ReportsPage.jsx"
import { SchedulingPage } from "./pages/SchedulingPage.jsx"
import { TasksPage } from "./pages/TasksPage.jsx"
import { TimePage } from "./pages/TimePage.jsx"
import { SettingsPage } from "./pages/SettingsPage.jsx"
import { PeopleSettingsPage } from "./pages/PeopleSettingsPage.jsx"
import { HolidaysSettingsPage } from "./pages/HolidaysSettingsPage.jsx"
import { WorkSchedulesSettingsPage } from "./pages/WorkSchedulesSettingsPage.jsx"
import { TimeTrackingSettingsPage } from "./pages/TimeTrackingSettingsPage.jsx"
import { LocationsSettingsPage } from "./pages/LocationsSettingsPage.jsx"
import { OnboardingPage } from "./pages/OnboardingPage.jsx"
import { GetStartedPage } from "./pages/GetStartedPage.jsx"
import { LiveLocationsPage } from "./pages/LiveLocationsPage.jsx"

export function App() {
  const { isReady, user } = useAuth()

  if (!isReady) return null

  return (
    <Routes>
      <Route path={routes.login} element={user ? <Navigate to={routes.get_started} replace /> : <LoginPage />} />
      <Route path={routes.onboarding} element={user ? <OnboardingPage /> : <Navigate to={routes.login} replace />} />
      <Route element={user ? <AppShell /> : <Navigate to={routes.login} replace />}>
        <Route path={routes.get_started} element={<GetStartedPage />} />
        <Route path={routes.dashboard} element={<DashboardPage />} />
        <Route path={routes.locations} element={<LocationsPage />} />
        <Route path={routes.live_locations} element={<LiveLocationsPage />} />
        <Route path={routes.time} element={<TimePage />} />
        <Route path={routes.tasks} element={<TasksPage />} />
        <Route path={routes.leaves} element={<LeavesPage />} />
        <Route path={routes.payroll} element={<PayrollPage />} />
        <Route path={routes.scheduling} element={<SchedulingPage />} />
        <Route path={routes.employees} element={<EmployeesPage />} />
        <Route path={routes.reports} element={<ReportsPage />} />
        <Route path={routes.settings} element={<SettingsPage />} />
        <Route path={routes.settings_people} element={<PeopleSettingsPage />} />
        <Route path={routes.settings_timetracking} element={<TimeTrackingSettingsPage />} />
        <Route path={routes.settings_schedules} element={<WorkSchedulesSettingsPage />} />
        <Route path={routes.settings_holidays} element={<HolidaysSettingsPage />} />
        <Route path={routes.settings_locations} element={<LocationsSettingsPage />} />
        <Route path={routes.settings_projects} element={<SettingsPage />} />
        <Route path={routes.settings_organization} element={<SettingsPage section="organization" />} />
        <Route path={routes.settings_integrations} element={<SettingsPage section="integrations" />} />
      </Route>
      <Route path="*" element={<Navigate to={routes.dashboard} replace />} />
    </Routes>
  )
}
