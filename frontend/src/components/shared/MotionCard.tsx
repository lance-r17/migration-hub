import type { ReactNode } from 'react'
import { motion, type Variants } from 'motion/react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MotionCardProps {
  children: ReactNode
  className?: string
  variants?: Variants
  onClick?: () => void
}

export function MotionCard({ children, className, variants, onClick }: MotionCardProps) {
  return (
    <motion.div
      variants={variants}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      onClick={onClick}
    >
      <Card
        className={cn(
          'group h-full border-border/40 bg-card/50 transition-all hover:bg-card hover:shadow-lg',
          className
        )}
      >
        {children}
      </Card>
    </motion.div>
  )
}
