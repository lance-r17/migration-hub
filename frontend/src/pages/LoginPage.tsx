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

const FRAME_MS = 4000
const TRANSITION_S = 1.2
const EASE_CINEMATIC = [0.45, 0, 0.15, 1] as [number, number, number, number]

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mql.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return reduced
}

export function LoginPage() {
  const [frame, setFrame] = useState(0)
  const reducedMotion = usePrefersReducedMotion()

  // Preload all scene images so the first loop is seamless
  useEffect(() => {
    FRAMES.forEach((src) => {
      const img = new Image()
      img.src = src
    })
  }, [])

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

  const transition = reducedMotion
    ? { duration: 0.3, ease: 'easeInOut' as const }
    : { duration: TRANSITION_S, ease: EASE_CINEMATIC }

  const initial = reducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 1.08 }

  const animate = reducedMotion
    ? { opacity: 1 }
    : { opacity: 1, scale: 1 }

  const exit = reducedMotion
    ? { opacity: 0 }
    : { opacity: 0, scale: 1.12 }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left panel — warm, natural, grounded */}
      <div className="relative flex flex-col gap-4 p-6 md:p-10">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 20% 50%, hsl(35 30% 88% / 0.6), transparent)',
            }}
          />
        </div>

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

      {/* Right panel — cinematic scene theatre */}
      <div className="relative hidden overflow-hidden bg-black lg:block">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={frame}
            className="absolute inset-0"
            initial={initial}
            animate={animate}
            exit={exit}
            transition={transition}
          >
            {/* Sharp base image */}
            <img
              src={FRAMES[frame]}
              alt=""
              className="absolute inset-0 h-full w-full object-contain"
            />

            {/* Black edge blur — a blurred, nearly-black copy of the image
                masked so it only appears at the edges, creating a smooth
                black dissolve on all 4 sides */}
            <img
              src={FRAMES[frame]}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-contain"
              style={{
                filter: 'blur(40px) brightness(0)',
                maskImage:
                  'radial-gradient(ellipse 58% 58% at center, transparent 45%, black 100%)',
                WebkitMaskImage:
                  'radial-gradient(ellipse 58% 58% at center, transparent 45%, black 100%)',
                zIndex: 1,
              }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Soft vignette — organic eye-draw */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at center, transparent 25%, rgba(12,10,8,0.50) 100%)',
          }}
        />

        {/* Bottom gradient — natural atmospheric haze */}
        <div
          className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(12,10,8,0.35), transparent)',
          }}
        />

        {/* Film grain — subtle organic noise */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.04] mix-blend-overlay"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="3"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>
    </div>
  )
}
