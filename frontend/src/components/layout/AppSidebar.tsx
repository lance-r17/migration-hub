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
  MonitorDot,
} from "lucide-react"
import { NavMain } from "./NavMain"
import { Logo } from "@/components/shared/Logo"
import { useCurrentUser } from "@/context/UserContext"

interface NavItem {
  title: string
  url: string
  icon: React.ReactNode
  requiresRole?: string
}

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: <LayoutDashboardIcon />,
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
      title: "Settings",
      url: "/settings",
      icon: <Settings2Icon />,
      requiresRole: "platform_migration_lead",
    },
    {
      title: "Job Monitor",
      url: "/admin/jobs",
      icon: <MonitorDot />,
      requiresRole: "platform_migration_lead",
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
                <span className="text-base font-semibold">Migration Hub</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={data.navMain.filter(item => !item.requiresRole || (user?.role.includes(item.requiresRole) ?? false))}
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
