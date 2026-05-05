import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { UserProvider } from '@/context/UserContext'
import { loadRuntimeConfig } from '@/runtimeConfig'

async function bootstrap() {
  const rootEl = document.getElementById('root')!

  // Show a minimal loading state while runtime config is fetched.
  // This prevents the app from rendering with stale/wrong config values.
  rootEl.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#666;">Loading configuration…</div>'

  await loadRuntimeConfig()

  createRoot(rootEl).render(
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
}

bootstrap()
