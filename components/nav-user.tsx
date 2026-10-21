/**components/nav-user.tsx   */
"use client"

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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronsUpDownIcon, BugIcon, LogOutIcon, SunIcon, MoonIcon, MonitorIcon, UserRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useClerk } from "@clerk/nextjs"
import { useTheme } from "next-themes"
import * as React from "react"
import { BugReportDialog } from "@/components/feedback/BugReportDialog"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile, state } = useSidebar()
  const { signOut } = useClerk()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [bugReportOpen, setBugReportOpen] = React.useState(false)

  // The sidebar folded to icons has no room for two buttons: there the avatar opens the menu as before.
  // Otherwise the profile area goes straight to /platform/user and the menu sits behind its own button on the right.
  const iconOnly = state === "collapsed" && !isMobile

  const menu = (
    <DropdownMenuContent
      className="min-w-56 rounded-lg"
      side={isMobile ? "bottom" : "right"}
      align="end"
      sideOffset={4}
    >
      <DropdownMenuGroup>
        <DropdownMenuItem onSelect={() => router.push("/platform/user")}>
          <UserRound />
          User settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setBugReportOpen(true)}>
          <BugIcon />
          Report a bug
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {theme === "light" ? <SunIcon /> : theme === "dark" ? <MoonIcon /> : <MonitorIcon />}
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onSelect={() => setTheme("light")}>
              <SunIcon />
              Light
              {theme === "light" && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("dark")}>
              <MoonIcon />
              Dark
              {theme === "dark" && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("system")}>
              <MonitorIcon />
              System
              {theme === "system" && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onSelect={() => signOut({ redirectUrl: "/" })}>
        <LogOutIcon />
        Log out
      </DropdownMenuItem>
    </DropdownMenuContent>
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {iconOnly ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                {/* Plain default user icon, not initials — see app-sidebar.tsx's
                    navUser: avatar is sourced from OUR OWN users.pfp column,
                    never Clerk directly, so this fallback is what shows for
                    everyone who hasn't uploaded a real photo, instead of
                    Clerk's own auto-generated default avatar or made-up
                    initials. */}
                <AvatarFallback className="rounded-lg bg-primary/10">
                  <UserRound className="h-[60%] w-[60%] text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            {menu}
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-1">
            <SidebarMenuButton asChild size="lg" className="min-w-0 flex-1">
              <Link href="/platform/user" prefetch title="User settings">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                {/* Plain default user icon, not initials — see app-sidebar.tsx's
                    navUser: avatar is sourced from OUR OWN users.pfp column,
                    never Clerk directly, so this fallback is what shows for
                    everyone who hasn't uploaded a real photo, instead of
                    Clerk's own auto-generated default avatar or made-up
                    initials. */}
                <AvatarFallback className="rounded-lg bg-primary/10">
                  <UserRound className="h-[60%] w-[60%] text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              </Link>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu: report a bug, theme, log out"
                  title="Menu"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent"
                >
                  <ChevronsUpDownIcon className="size-4" />
                </button>
              </DropdownMenuTrigger>
              {menu}
            </DropdownMenu>
          </div>
        )}
      </SidebarMenuItem>

      <BugReportDialog open={bugReportOpen} onOpenChange={setBugReportOpen} />
    </SidebarMenu>
  )
}
