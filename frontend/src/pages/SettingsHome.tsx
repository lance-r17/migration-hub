import { Link } from 'react-router-dom'
import { BadgeCheck, CalendarRange, ClipboardList, DollarSign, Settings2, ShieldAlert } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const SETTINGS_SECTIONS = [
  {
    title: 'Survey Builder',
    description: 'Configure the project survey questions shown to application owners.',
    icon: <ClipboardList size={20} className="text-primary" />,
    href: '/settings/survey',
  },
  {
    title: 'Migration Settings',
    description: 'Set the platform migration period and configurable duration options for migration windows.',
    icon: <CalendarRange size={20} className="text-primary" />,
    href: '/settings/migration',
  },
  {
    title: 'Embargo Periods',
    description: 'Define change freeze windows that restrict migration activities for specific service lines.',
    icon: <ShieldAlert size={20} className="text-primary" />,
    href: '/settings/embargo',
  },
  {
    title: 'Billing Configuration',
    description: 'Adjust the ratio thresholds that classify resource sets as Healthy, At Risk, or Over budget.',
    icon: <DollarSign size={20} className="text-primary" />,
    href: '/settings/billing',
  },
  {
    title: 'Sign-off Control',
    description: 'Enable or disable the sign-off workflow for project team members.',
    icon: <BadgeCheck size={20} className="text-primary" />,
    href: '/settings/signoff',
  },
]

export function SettingsHome() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Settings2 className="size-5 text-muted-foreground" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
        </div>
        <p className="text-muted-foreground text-sm">Platform configuration for Migration Hub.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {SETTINGS_SECTIONS.map((section) => (
        <Link key={section.href} to={section.href} className="group focus:outline-none">
          <Card className="h-full transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-primary">
            <CardHeader>
              <div className="mb-1">{section.icon}</div>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
      </div>
    </div>
  )
}
