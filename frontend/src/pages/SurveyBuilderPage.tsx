import { useNavigate } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { SurveyBuilderSection } from '@/components/settings/SurveyBuilderSection'

export function SurveyBuilderPage() {
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
            <BreadcrumbPage>Survey Builder</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="size-5 text-muted-foreground" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Survey Builder</h1>
        </div>
        <p className="text-muted-foreground text-sm">Configure the survey questions shown to application owners.</p>
      </div>

      <SurveyBuilderSection />
    </div>
  )
}
