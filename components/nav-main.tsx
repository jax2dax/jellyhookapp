/**components/nav-main.tsx */
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { ChevronRightIcon } from "lucide-react"

// The gooey active-row filter — declared once here (not per-row) since an
// SVG <filter> just needs to exist somewhere in the document to be
// referenced by id from any element's `filter: url(#jh-goo)`. Recipe is the
// standard "goo" trick: blur the shape, then push its alpha channel back
// toward 0/1 with an extreme contrast matrix so where two blurred shapes
// overlapped now reads as solidly merged — that's what turns the plain
// rounded blob + its little bottom nodule (see .jh-goo-blob in globals.css)
// into one melted, organic shape instead of two separate circles.
function GooFilterDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="jh-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  )
}

/** Exact match, or a nested route under it (e.g. /platform/leads/abc123 keeps "Leads" highlighted). Locked items point everyone at /platform/subscription, so this only ever runs against a real destination. */
function isNavItemActive(pathname: string, url: string) {
  if (!url || url === "#") return false
  return pathname === url || pathname.startsWith(`${url}/`)
}

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon: React.ReactNode
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <GooFilterDefs />
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {/**nav itmes */}
        {items.map((item) => {
          const active = isNavItemActive(pathname, item.url)
          return (
            <Collapsible key={item.title} asChild defaultOpen={item.isActive}>
              <SidebarMenuItem className="relative">
                <span aria-hidden="true" className={`jh-goo-blob ${active ? "jh-goo-blob--on" : ""}`} />
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  // text-sidebar-foreground is the token actually designed to
                  // contrast with THIS sidebar's own background in both
                  // themes (near-black text on the light-mode sidebar,
                  // near-white text on the dark-mode one) — --background,
                  // used here previously, is nearly the same dark value as
                  // --sidebar in dark mode (0.145 vs 0.205 lightness), which
                  // is exactly what made unselected rows read as blank.
                  //
                  // data-[active=true]: (bracket, exact-value) not
                  // data-active: (bare) — see the note on
                  // sidebarMenuButtonVariants in components/ui/sidebar.tsx;
                  // the bare form matches data-active="false" too, which was
                  // forcing text-primary-foreground (near-black in dark mode)
                  // onto every unselected row, invisible against the equally
                  // near-black sidebar background.
                  className="relative z-10 my-1 text-sidebar-foreground [&_svg]:text-sidebar-foreground data-[active=true]:bg-transparent data-[active=true]:text-primary-foreground data-[active=true]:[&_svg]:text-primary-foreground"
                >
                  <Link href={item.url}>
                    {item.icon}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
                {item.items?.length ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction className="data-[state=open]:rotate-90">
                        <ChevronRightIcon
                        />
                        <span className="sr-only">Toggle</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title} className="pl-8 my-2 ">
                            <SidebarMenuSubButton
                              asChild
                              isActive={isNavItemActive(pathname, subItem.url)}
                              className="pl-8 my-2 text-sidebar-foreground data-[active=true]:text-sidebar-accent-foreground"
                            >
                              <Link href={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
