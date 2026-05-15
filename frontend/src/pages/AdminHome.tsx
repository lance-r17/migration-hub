import { Link } from 'react-router-dom'
import { MonitorDot, Key, Paperclip, UserCog, Users, Mail, Bell } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const ADMIN_SECTIONS = [
  {
    title: 'User Accounts',
    description: 'Manage human user accounts across the platform.',
    icon: <Users size={20} className="text-primary" />,
    href: '/admin/users',
  },
  {
    title: 'Job Monitor',
    description: 'View and manage background Jira integration jobs across all projects.',
    icon: <MonitorDot size={20} className="text-primary" />,
    href: '/admin/jobs',
  },
  {
    title: 'Email Jobs',
    description: 'View background email delivery status and retry failed sends.',
    icon: <Mail size={20} className="text-primary" />,
    href: '/admin/email-jobs',
  },
  {
    title: 'Notifications',
    description: 'Configure event-driven email triggers and cron schedules.',
    icon: <Bell size={20} className="text-primary" />,
    href: '/admin/notifications',
  },
  {
    title: 'Service Accounts',
    description: 'Manage machine-to-machine API accounts.',
    icon: <Key size={20} className="text-primary" />,
    href: '/admin/service-accounts',
  },
  {
    title: 'Attachment Management',
    description: 'Review and permanently delete project attachments across all projects.',
    icon: <Paperclip size={20} className="text-primary" />,
    href: '/admin/attachments',
  },
]

export function AdminHome() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <UserCog className="size-5 text-muted-foreground" />
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Admin</h1>
        </div>
        <p className="text-muted-foreground text-sm">Platform administration and oversight.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ADMIN_SECTIONS.map((section) => (
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
