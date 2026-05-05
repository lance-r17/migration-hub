import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { UserProvider } from '@/context/UserContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="migration-hub-theme">
      <UserProvider>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </UserProvider>
    </ThemeProvider>
  </StrictMode>,
)
