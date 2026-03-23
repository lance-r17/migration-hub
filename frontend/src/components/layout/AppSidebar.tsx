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
} from "lucide-react"
import { NavMain } from "./NavMain"
import { Logo } from "@/components/shared/Logo"
import { useCurrentUser } from "@/context/UserContext"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: <LayoutDashboardIcon />,
    },
    // {
    //   title: "Projects",
    //   url: "/",
    //   icon: <FolderIcon />,
    // },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: <Settings2Icon />,
    },
    {
      title: "Help & Support",
      url: "#",
      icon: <CircleHelpIcon />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const currentUser = useCurrentUser()

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
        <NavMain items={data.navMain} pathname={location.pathname} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={{ name: currentUser.name, email: currentUser.email, avatar: '' }} />
      </SidebarFooter>
    </Sidebar>
  )
}
