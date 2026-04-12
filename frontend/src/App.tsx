import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { HomePage } from './pages/HomePage'
import { ProjectDetailsPage } from './pages/ProjectDetailsPage'
import { LoginPage } from './pages/LoginPage'
import { WavesPage } from './pages/WavesPage'
import { FinancePage } from './pages/FinancePage'
import { SettingsPage } from './pages/SettingsPage'
import { SettingsHome } from './pages/SettingsHome'
import { SurveyBuilderPage } from './pages/SurveyBuilderPage'
import { EmbargoPage } from './pages/EmbargoPage'
import { BillingSettingsPage } from './pages/BillingSettingsPage'
import { EmailTemplatesPage } from './pages/EmailTemplatesPage'
import { EmailBuilderPage } from './pages/EmailBuilderPage'
import { EmailPreviewPage } from './pages/EmailPreviewPage'
import { useCurrentUser } from '@/context/UserContext'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useCurrentUser()
  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetailsPage /></ProtectedRoute>} />
        <Route path="/waves" element={<ProtectedRoute><WavesPage /></ProtectedRoute>} />
        <Route path="/finance" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
        <Route path="/email" element={<ProtectedRoute><EmailTemplatesPage /></ProtectedRoute>} />
        <Route path="/email/new" element={<ProtectedRoute><EmailBuilderPage /></ProtectedRoute>} />
        <Route path="/email/:id/edit" element={<ProtectedRoute><EmailBuilderPage /></ProtectedRoute>} />
        <Route path="/email/:id/preview" element={<ProtectedRoute><EmailPreviewPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>}>
          <Route index element={<SettingsHome />} />
          <Route path="survey" element={<SurveyBuilderPage />} />
          <Route path="embargo" element={<EmbargoPage />} />
          <Route path="billing" element={<BillingSettingsPage />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
