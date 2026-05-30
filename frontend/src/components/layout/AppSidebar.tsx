import * as React from "react"
import { NavLink, useLocation } from "react-router-dom"

import { NavSecondary } from "@/components/layout/NavSecondary"
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
  CircleHelpIcon,
  Waves,
  DollarSign,
  Mail,
  FileText,
  UserCog,
  FolderOpen,
  GanttChart,
  CalendarDays,
} from "lucide-react"
import { NavMain } from "./NavMain"
import { Logo } from "@/components/shared/Logo"
import { useCurrentUser } from "@/context/UserContext"

interface NavItem {
  title: string
  url: string
  icon: React.ReactNode
  requiresRole?: string
  excludesRole?: string
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
      requiresRole: "platform_migration_lead",
    },
    {
      title: "Engagements",
      url: "/engagements",
      icon: <CalendarDays />,
      requiresRole: "platform_migration_lead",
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
      excludesRole: "platform_migration_lead",
    },
  ] satisfies NavItem[],
  navSecondary: [
    {
      title: "Help & Support",
      url: "#",
      icon: <CircleHelpIcon />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const { user } = useCurrentUser()

  const isGbiCloudLead = user?.role.includes('gbi_cloud_lead') ?? false

  const visibleItems = data.navMain.filter(item => {
    if (isGbiCloudLead) {
      // GBI cloud leads only see Dashboard, Projects, and Wave Gantt
      return ['/', '/projects', '/waves/gantt'].includes(item.url)
    }
    if (item.requiresRole && !(user?.role.includes(item.requiresRole) ?? false)) return false
    if (item.excludesRole && (user?.role.includes(item.excludesRole) ?? false)) return false
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
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        {user && <NavUser user={{ name: user.name, email: user.email, avatar: '' }} />}
      </SidebarFooter>
    </Sidebar>
  )
}
