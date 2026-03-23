import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { TeamAvatars } from '@/components/shared/TeamAvatars'
import { MotionCard } from '@/components/shared/MotionCard'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ProjectCardProps {
  project: Project
}

function getProgressVariant(project: Project) {
  if (project.progress === 100) return 'tertiary'
  if (project.status === 'blocked') return 'error'
  if (project.status === 'planning') return 'muted'
  return 'primary'
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate()
  const isBlocked = project.status === 'blocked'
  const ctaLabel = isBlocked ? 'Resolve Issues' : 'View Details'

  return (
    <MotionCard
      onClick={() => navigate(`/projects/${project.id}`)}
      className={cn(
        'cursor-pointer py-6',
        isBlocked ? 'hover:border-destructive/20' : 'hover:border-primary/20'
      )}
    >
      {/* Header */}
      <CardHeader className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CardTitle>{project.name}</CardTitle>
            {isBlocked && <AlertTriangle size={16} className="text-destructive" />}
          </div>
          <CardDescription>Project ID: {project.id}</CardDescription>
        </div>
        <StatusBadge status={project.status} />
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* Progress */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs mb-2 font-medium">
              <span className="text-muted-foreground">Migration Status</span>
              <span className="text-foreground">{project.progress}%</span>
            </div>
            <ProgressBar value={project.progress} variant={getProgressVariant(project)} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4">
            <TeamAvatars members={project.team} max={3} />
            <button
              className="text-sm font-semibold text-primary flex items-center gap-1"
              onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}`) }}
            >
              {ctaLabel}
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </CardContent>
    </MotionCard>
  )
}
