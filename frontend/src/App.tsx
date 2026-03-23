import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { HomePage } from './pages/HomePage'
import { ProjectDetailsPage } from './pages/ProjectDetailsPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects/:id" element={<ProjectDetailsPage />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
