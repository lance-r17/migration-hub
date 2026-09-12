import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  EllipsisVerticalIcon,
  CircleUserRoundIcon,
  BellIcon,
  LogOutIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useCurrentUser } from "@/context/UserContext"
import { Badge } from "@/components/ui/badge"
import {
  getUnreadCount,
  NOTIFICATIONS_CHANGED_EVENT,
} from "@/services/notifications"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const { logout } = useCurrentUser()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      getUnreadCount()
        .then((count) => { if (!cancelled) setUnreadCount(count) })
        .catch(() => {})
    }
    refresh()
    const interval = setInterval(refresh, 60_000)
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh)
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh)
    }
  }, [])

  function handleLogout() {
    logout()
    navigate("/login", { replace: true })
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="relative data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex size-2.5" title={`${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`}>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                </span>
              )}
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <EllipsisVerticalIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate("/account")}>
                <CircleUserRoundIcon />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/notifications")}>
                <BellIcon />
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="default" className="ml-auto px-1.5 min-w-5 justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
