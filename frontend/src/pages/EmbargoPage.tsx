import { useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { EmbargoSection } from '@/components/settings/EmbargoSection'

export function EmbargoPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/settings')} className="cursor-pointer">
              Settings
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Embargo Periods</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="size-5 text-muted-foreground" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Embargo Periods</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Define change freeze windows that restrict migration activities for specific service lines.
        </p>
      </div>

      <EmbargoSection />
    </div>
  )
}
