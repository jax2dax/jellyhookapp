// components/app-sidebar.tsx
"use client"

import * as React from "react"
import Image from "next/image"
import {
  LayoutDashboard, Users, Flame, UserCheck,
  GitFork, Globe, Settings, CreditCard, LifeBuoy,Network
} from "lucide-react"
import { SiteSwitcher } from "@/components/siteSwitcher"

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

interface NavItem {
  title: string
  url: string
  icon: React.ComponentType<any>
  plan: string
}
// Nav items — href, label, icon, minimum plan required
// locked items still show but route to /platform/subscription
const NAV_ITEMS = [
  { title: "Overview",          url: "/platform/dashboard",     icon: LayoutDashboard, plan: "free"  },
  // { title: "Visitor Journeys",  url: "/platform/visitors",      icon: Users,           plan: "free"   },
  // { title: "Intent Signals",    url: "/platform/intent",        icon: Flame,           plan: "free" },
  { title: "Leads",             url: "/platform/leads",         icon: UserCheck,       plan: "free"   },
  { title: "Conversion Paths",  url: "/platform/conversions",   icon: GitFork,         plan: "free"   },
  { title: "Acquisition",       url: "/platform/acquisition",   icon: Globe,           plan: "free"   },
  { title: "Settings",          url: "/platform/settings",      icon: Settings,        plan: "free"  },
  { title: "Subscription",      url: "/platform/subscription",  icon: CreditCard,      plan: "free"  },
   { title: "Network",           url: "/platform/network",      icon: Network,         plan: "free"  },
]

const NAV_SECONDARY = [
  { title: "Support", url: "#", icon: <LifeBuoy />  },
]

// jellyhookMark.png / jellyhookMarkLight.png are chroma-keyed, transparent
// versions of public/darkMainLogo.png / public/mainLogo.png (those two have
// an opaque canvas baked in — black for darkMainLogo, white for mainLogo —
// with no alpha channel at all, so dropped straight into a themed sidebar
// they render as a colored square smudge instead of a logo). The dark-canvas
// mark (black badge) reads correctly against a light sidebar background;
// the light-canvas mark (cream badge) reads correctly against a dark one —
// so light/dark mode picks the OPPOSITE-named asset from what you'd guess.
function BrandMark() {
  // CSS-only swap (same convention as DarkButton.jsx's sun/moon icons) —
  // both images render always, and Tailwind's `dark:` variant (this app's
  // ThemeProvider uses attribute="class") toggles which one is display:none.
  // Avoids a useTheme()-driven mounted/useEffect dance and the hydration
  // mismatch that comes with it entirely.
  return (
    <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
      <Image src="/jellyhookMarkLight.png" alt="" width={24} height={24} priority className="block h-full w-full object-contain dark:hidden" />
      <Image src="/jellyhookMark.png" alt="" width={24} height={24} priority className="hidden h-full w-full object-contain dark:block" />
    </span>
  )
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  userPlan?: string
  siteDomain?: string | null
  sites?: any[]
  currentSiteId?: string | null
}


export function AppSidebar({ userPlan = "free", siteDomain, sites, currentSiteId, ...props }: AppSidebarProps) {
  const { user } = useUser()

  // Build nav items — locked items redirect to subscription page
   const navItems = NAV_ITEMS.map((item) => {
    const locked = (TIER[userPlan] ?? 0) < (TIER[item.plan] ?? 0)
    const Icon = item.icon
    return {
      title: locked ? `${item.title} 🔒` : item.title,
      url: locked ? "/platform/subscription" : item.url,
      icon: <Icon />,
      isActive: false,
    }
  })

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1">
          <BrandMark />
          <span className="truncate font-semibold tracking-wide text-primary group-data-[collapsible=icon]:hidden">
            Jellyhook
          </span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              {/**@ts-ignore */}
              <SiteSwitcher sites={sites} currentSiteId={currentSiteId} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/**@ts-ignore */}
        <NavMain items={navItems} />
        {/**@ts-ignore */}
         <NavSecondary items={NAV_SECONDARY} className="mt-auto" />
      </SidebarContent>

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