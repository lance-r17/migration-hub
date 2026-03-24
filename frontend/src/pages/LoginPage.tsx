import { useState, useEffect } from "react"
import { AnimatePresence, motion } from "motion/react"
import { LoginForm } from "@/components/login-form"
import { Logo } from "@/components/shared/Logo"

const FRAMES = [
  '/scenes/scene-01.png',
  '/scenes/scene-02.png',
  '/scenes/scene-03.png',
  '/scenes/scene-04.png',
  '/scenes/scene-05.png',
  '/scenes/scene-06.png',
]
const FRAME_MS = 3000 // 3s per frame — full loop ~18s

export function LoginPage() {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    let cancelled = false
    const id = setInterval(() => {
      if (!cancelled) setFrame(f => (f + 1) % FRAMES.length)
    }, FRAME_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <Logo className="size-6" />
            <span>Migration Hub</span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <LoginForm />
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-black lg:block">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={frame}
            src={FRAMES[frame]}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </AnimatePresence>
      </div>
    </div>
  )
}
