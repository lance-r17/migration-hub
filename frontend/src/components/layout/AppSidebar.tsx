import * as React from "react"
import { NavLink, useLocation } from "react-router-dom"

import { NavUser } from "@/components/layout/NavUser"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  Settings2Icon,
  Waves,
  DollarSign,
  Mail,
  FileText,
  UserCog,
  FolderOpen,
  GanttChart,
  CalendarDays,
  Database,
  ExternalLink,
} from "lucide-react"
import { NavMain } from "./NavMain"
import { Logo } from "@/components/shared/Logo"
import { useCurrentUser } from "@/context/UserContext"
import { useMigrationSettingsContext } from "@/context/MigrationSettingsContext"
import { useCustomNavCardContext } from "@/context/CustomNavCardContext"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface NavItem {
  title: string
  url: string
  icon: React.ReactNode
  requiresRole?: string | string[]
  excludesRole?: string | string[]
}

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Projects",
      url: "/projects",
      icon: <FolderOpen />,
    },
    {
      title: "Engagements",
      url: "/engagements",
      icon: <CalendarDays />,
      requiresRole: ["platform_migration_lead", "engagement_reviewer"],
    },
    {
      title: "Waves",
      url: "/waves",
      icon: <Waves />,
      requiresRole: "platform_migration_lead",
    },
    {
      title: "Finance",
      url: "/finance",
      icon: <DollarSign />,
      requiresRole: "platform_migration_lead",
    },
    {
      title: "Email",
      url: "/email",
      icon: <Mail />,
      requiresRole: "platform_migration_lead",
    },
    {
      title: "Templates",
      url: "/templates",
      icon: <FileText />,
      requiresRole: "platform_migration_lead",
    },
    {
      title: "Settings",
      url: "/settings",
      icon: <Settings2Icon />,
      requiresRole: "platform_migration_lead",
    },
    {
      title: "Admin",
      url: "/admin",
      icon: <UserCog />,
      requiresRole: "admin",
    },
    {
      title: "Wave Gantt",
      url: "/waves/gantt",
      icon: <GanttChart />,
      excludesRole: ["platform_migration_lead", "engagement_reviewer"],
    },
    {
      title: "Data Migration",
      url: "/waves/data-migration",
      icon: <Database />,
      excludesRole: "platform_migration_lead",
    },
  ] satisfies NavItem[],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const { user } = useCurrentUser()
  const { settings } = useMigrationSettingsContext()
  const { config: navCardConfig } = useCustomNavCardContext()

  const isBgiCloudLead = user?.role.includes('bgi_cloud_lead') ?? false
  const dataMigrationEnabled = settings?.dataMigrationAdjustmentEnabled ?? true

  const hasAnyRole = (roles: string | string[]) => {
    const list = Array.isArray(roles) ? roles : [roles]
    return list.some(r => user?.role.includes(r))
  }

  const isAdmin = user?.role.includes('admin') ?? false
  const isPlatformLead = user?.role.includes('platform_migration_lead') ?? false
  const isGbiChampionOrDelegate = user?.projectRoles?.some(
    r => r === 'gbi_champion' || r === 'gbi_champion_delegate'
  ) ?? false

  const canViewProjects = isAdmin || isPlatformLead || isBgiCloudLead || isGbiChampionOrDelegate

  const visibleItems = data.navMain.filter(item => {
    if (item.url === '/waves/data-migration' && !dataMigrationEnabled) return false
    if (item.url === '/projects') return canViewProjects
    if (isBgiCloudLead) {
      // BGI cloud leads only see Dashboard, Projects, Wave Gantt, and Data Migration
      return ['/', '/projects', '/waves/gantt', '/waves/data-migration'].includes(item.url)
    }
    if (item.requiresRole && !hasAnyRole(item.requiresRole)) return false
    if (item.excludesRole && hasAnyRole(item.excludesRole)) return false
    return true
  })

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <NavLink to="/">
                <Logo className="size-5" />
                <span className="text-base font-semibold">Migration Engine</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={visibleItems}
          pathname={location.pathname}
        />
        {navCardConfig && (
          <a
            href={navCardConfig.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto px-2 pb-2"
          >
            <Card size="sm" className="border shadow-sm">
              <CardHeader>
                <CardAction>
                  <ExternalLink className="size-4 text-muted-foreground" />
                </CardAction>
                <CardTitle>{navCardConfig.title}</CardTitle>
                <CardDescription className="text-xs">{navCardConfig.description}</CardDescription>
              </CardHeader>
            </Card>
          </a>
        )}
      </SidebarContent>
      <SidebarFooter>
        {user && <NavUser user={{ name: user.name, email: user.email, avatar: '' }} />}
      </SidebarFooter>
    </Sidebar>
  )
}
