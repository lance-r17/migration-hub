import { Link } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const SETTINGS_SECTIONS = [
  {
    title: 'Survey Builder',
    description: 'Configure the project survey questions shown to application owners.',
    icon: <ClipboardList size={20} className="text-primary" />,
    href: '/settings/survey',
  },
]

export function SettingsHome() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Platform configuration for Migration Hub.</p>
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
