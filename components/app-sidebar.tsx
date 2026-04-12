// components/app-sidebar.tsx
"use client"

import * as React from "react"
import {
  LayoutDashboard, Users, Flame, UserCheck,
  GitFork, Globe, Settings, CreditCard, LifeBuoy,
} from "lucide-react"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { useUser } from "@clerk/nextjs"
import {
  Sidebar, SidebarContent, SidebarFooter,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar"

// Plan tier map — controls which nav items are locked
const TIER: Record<string, number> = { free: 0, pro: 1, elite: 2 }

// Nav items — href, label, icon, minimum plan required
// locked items still show but route to /platform/subscription
const NAV_ITEMS = [
  { title: "Overview",          url: "/platform/dashboard",     icon: LayoutDashboard, plan: "free"  },
  { title: "Visitor Journeys",  url: "/platform/visitors",      icon: Users,           plan: "pro"   },
  { title: "Intent Signals",    url: "/platform/intent",        icon: Flame,           plan: "elite" },
  { title: "Leads",             url: "/platform/leads",         icon: UserCheck,       plan: "pro"   },
  { title: "Conversion Paths",  url: "/platform/conversions",   icon: GitFork,         plan: "pro"   },
  { title: "Acquisition",       url: "/platform/acquisition",   icon: Globe,           plan: "pro"   },
  { title: "Settings",          url: "/platform/settings",      icon: Settings,        plan: "free"  },
  { title: "Subscription",      url: "/platform/subscription",  icon: CreditCard,      plan: "free"  },
]

const NAV_SECONDARY = [
  { title: "Support", url: "#", icon: LifeBuoy },
]

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userPlan?: string
  siteDomain?: string | null
}

export function AppSidebar({ userPlan = "free", siteDomain, ...props }: AppSidebarProps) {
  const { user } = useUser()

  // Build nav items — locked items redirect to subscription page
  const navItems = NAV_ITEMS.map((item) => {
    const locked = (TIER[userPlan] ?? 0) < (TIER[item.plan] ?? 0)
    return {
      title: locked ? `${item.title} 🔒` : item.title,
      url: locked ? "/platform/subscription" : item.url,
      icon: item.icon,
      isActive: false,
    }
  })

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/platform/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  {/* Replace with your logo */}
                  <span style={{ fontSize: 14, fontWeight: "bold" }}>J</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">JellyHook</span>
                  <span className="truncate text-xs">{siteDomain ?? "No site connected"}</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      

      <SidebarFooter>
        {/* NavUser pulls from Clerk — shows avatar, email, logout */}
        <NavUser user={{
          name: user?.fullName ?? "User",
          email: user?.primaryEmailAddress?.emailAddress ?? "",
          avatar: user?.imageUrl ?? "",
        }} />
      </SidebarFooter>
    </Sidebar>
  )
}