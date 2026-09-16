// components/siteSwitcher.jsx
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronsUpDown, Check, Plus, Globe } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
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
import { switchSite } from "@/lib/actions/site-management.actions"

export function SiteSwitcher({ sites = [], currentSiteId = null }) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)

  const current = sites.find((s) => s.id === currentSiteId) || sites[0] || null

  async function handleSwitch(siteId) {
    if (siteId === currentSiteId || busy) return
    setBusy(true)
    try {
      const res = await switchSite(siteId)
      if (res.success) {
        router.refresh()
        router.push("/platform/dashboard")
      }
    } finally {
      setBusy(false)
    }
  }

  // No sites yet — show a create prompt
  if (!current) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" asChild>
            <a href="/platform/create-site">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Plus className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Create site</span>
                <span className="truncate text-xs">No sites yet</span>
              </div>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              disabled={busy}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Globe className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {current.name || current.domain}
                </span>
                <span className="truncate text-xs">{current.domain}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Sites
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {sites.map((site) => {
              const isCurrent = site.id === currentSiteId
              return (
                <DropdownMenuItem
                  key={site.id}
                  onClick={() => handleSwitch(site.id)}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <Globe className="size-3.5 shrink-0" />
                  </div>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">
                      {site.name || site.domain}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {site.domain}
                    </span>
                  </div>
                  {isCurrent && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
              )
            })}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() => router.push("/platform/create-site")}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                <Plus className="size-4" />
              </div>
              <div className="text-sm font-medium text-muted-foreground">
                New site
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}