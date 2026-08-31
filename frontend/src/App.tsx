import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { MigrationSettingsProvider, useMigrationSettingsContext } from '@/context/MigrationSettingsContext'
import { CustomNavCardProvider } from '@/context/CustomNavCardContext'
import { CustomNavCardSettingsPage } from './pages/CustomNavCardSettingsPage'
import { HomePage } from './pages/HomePage'
import { ProjectDetailsPage } from './pages/ProjectDetailsPage'
import { LoginPage } from './pages/LoginPage'
import { WavesPage } from './pages/WavesPage'
import { WaveGanttPage } from './pages/WaveGanttPage'
import { EnvironmentProvisionPage } from './pages/EnvironmentProvisionPage'
import { DataMigrationPage } from './pages/DataMigrationPage'
import { EngagementCalendarPage } from './pages/EngagementCalendarPage'
import { EngagementNotesPage } from './pages/EngagementNotesPage'
import { EngagementNotesEditPage } from './pages/EngagementNotesEditPage'
import { FinancePage } from './pages/FinancePage'
import { SettingsPage } from './pages/SettingsPage'
import { SettingsHome } from './pages/SettingsHome'
import { SurveyBuilderPage } from './pages/SurveyBuilderPage'
import { EmbargoPage } from './pages/EmbargoPage'
import { BillingSettingsPage } from './pages/BillingSettingsPage'
import { SignoffSettingsPage } from './pages/SignoffSettingsPage'
import { MigrationSettingsPage } from './pages/MigrationSettingsPage'
import { EmailTemplatesPage } from './pages/EmailTemplatesPage'
import { EmailBuilderPage } from './pages/EmailBuilderPage'
import { EmailPreviewPage } from './pages/EmailPreviewPage'
import { NoteTemplatesPage } from './pages/NoteTemplatesPage'
import { TemplatePreviewPage } from './pages/TemplatePreviewPage'
import { CallbackPage } from './pages/CallbackPage'
import { AdminJiraJobsPage } from './pages/AdminJiraJobsPage'
import { ServiceAccountsPage } from './pages/ServiceAccountsPage'
import { AdminAttachmentsPage } from './pages/AdminAttachmentsPage'
import { UserAccountsPage } from './pages/UserAccountsPage'
import { NotificationSettingsPage } from './pages/NotificationSettingsPage'
import { EmailJobsPage } from './pages/EmailJobsPage'
import { AdminPage } from './pages/AdminPage'
import { AdminHome } from './pages/AdminHome'
import { ProjectsPage } from './pages/ProjectsPage'
import { BgiSettingsPage } from './pages/BgiSettingsPage'
import { BgiCloudLeadsPage } from './pages/BgiCloudLeadsPage'
import { AdminProvisionCidrsPage } from './pages/AdminProvisionCidrsPage'
import { EngagementReviewersPage } from './pages/EngagementReviewersPage'
import { useCurrentUser } from '@/context/UserContext'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useCurrentUser()
  const location = useLocation()
  if (loading) return null
  if (!isAuthenticated) {
    const path = location.pathname + location.search
    if (path !== '/login' && path !== '/callback') {
      localStorage.setItem('post_login_redirect', path)
    }
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function DataMigrationRoute() {
  const { settings, loading } = useMigrationSettingsContext()
  if (loading) return null
  if (!settings?.dataMigrationAdjustmentEnabled) return <Navigate to="/" replace />
  return <DataMigrationPage />
}

function App() {
  return (
    <BrowserRouter>
      <MigrationSettingsProvider>
        <CustomNavCardProvider>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/callback" element={<CallbackPage />} />
          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetailsPage /></ProtectedRoute>} />
          <Route path="/engagements" element={<ProtectedRoute><EngagementCalendarPage /></ProtectedRoute>} />
          <Route path="/engagements/:projectId" element={<ProtectedRoute><EngagementNotesPage /></ProtectedRoute>} />
          <Route path="/engagements/:projectId/edit" element={<ProtectedRoute><EngagementNotesEditPage /></ProtectedRoute>} />
          <Route path="/waves" element={<ProtectedRoute><WavesPage /></ProtectedRoute>} />
          <Route path="/waves/gantt" element={<ProtectedRoute><WaveGanttPage /></ProtectedRoute>} />
          <Route path="/waves/environment-provision" element={<ProtectedRoute><EnvironmentProvisionPage /></ProtectedRoute>} />
          <Route path="/waves/data-migration" element={<ProtectedRoute><DataMigrationRoute /></ProtectedRoute>} />
          <Route path="/finance" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
          <Route path="/email" element={<ProtectedRoute><EmailTemplatesPage /></ProtectedRoute>} />
          <Route path="/email/new" element={<ProtectedRoute><EmailBuilderPage /></ProtectedRoute>} />
          <Route path="/email/:id/edit" element={<ProtectedRoute><EmailBuilderPage /></ProtectedRoute>} />
          <Route path="/email/:id/preview" element={<ProtectedRoute><EmailPreviewPage /></ProtectedRoute>} />
          <Route path="/templates" element={<ProtectedRoute><NoteTemplatesPage /></ProtectedRoute>} />
          <Route path="/templates/:id" element={<ProtectedRoute><TemplatePreviewPage /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>}>
            <Route index element={<AdminHome />} />
            <Route path="users" element={<UserAccountsPage />} />
            <Route path="jobs" element={<AdminJiraJobsPage />} />
            <Route path="email-jobs" element={<EmailJobsPage />} />
            <Route path="notifications" element={<NotificationSettingsPage />} />
            <Route path="service-accounts" element={<ServiceAccountsPage />} />
            <Route path="attachments" element={<AdminAttachmentsPage />} />
            <Route path="bgi-cloud-leads" element={<BgiCloudLeadsPage />} />
            <Route path="engagement-reviewers" element={<EngagementReviewersPage />} />
            <Route path="provision-cidrs" element={<AdminProvisionCidrsPage />} />
          </Route>
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>}>
            <Route index element={<SettingsHome />} />
            <Route path="survey" element={<SurveyBuilderPage />} />
            <Route path="embargo" element={<EmbargoPage />} />
            <Route path="billing" element={<BillingSettingsPage />} />
            <Route path="signoff" element={<SignoffSettingsPage />} />
            <Route path="migration" element={<MigrationSettingsPage />} />
            <Route path="bgi" element={<BgiSettingsPage />} />
            <Route path="nav-card" element={<CustomNavCardSettingsPage />} />
          </Route>
        </Routes>
        <Toaster />
        </CustomNavCardProvider>
      </MigrationSettingsProvider>
    </BrowserRouter>
  )
}

export default App
