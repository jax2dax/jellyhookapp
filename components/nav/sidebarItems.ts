// components/nav/sidebarItems.ts
// The platform sidebar's pages, in order: label, address, icon, minimum plan. Read by the real sidebar
// (components/app-sidebar.tsx) and by the home page demo's copy of it (components/showcase), so both list the same pages.
// Locked items still show but route to /platform/subscription.
import type * as React from "react";
import { Bell, Bookmark, FishingHook, Globe, LayoutDashboard, Plug, Route, Settings, UserCheck, Users } from "lucide-react";

export interface SidebarItem {
  title: string;
  url: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  plan: string;
}

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { title: "Overview", url: "/platform/dashboard", icon: LayoutDashboard, plan: "free" },
  // { title: "Visitor Journeys", url: "/platform/visitors", icon: Users, plan: "free" },
  // { title: "Intent Signals", url: "/platform/intent", icon: Flame, plan: "free" },
  { title: "Leads", url: "/platform/leads", icon: UserCheck, plan: "free" },
  { title: "Marks", url: "/platform/marks", icon: Bookmark, plan: "free" },
  { title: "Conversion Paths", url: "/platform/conversions", icon: Route, plan: "free" },
  { title: "Acquisition", url: "/platform/acquisition", icon: Globe, plan: "free" },
  // "Hook" (the query builder) is now called Query builder and hidden for now (founder 2026-10-24); /platform/hook still works
  { title: "Hooks", url: "/platform/hooks", icon: FishingHook, plan: "free" },
  { title: "Notifications", url: "/platform/notifications", icon: Bell, plan: "free" },
  { title: "Integrations", url: "/platform/integrations", icon: Plug, plan: "free" },
  { title: "Settings", url: "/platform/settings", icon: Settings, plan: "free" },
  // { title: "Subscription", url: "/platform/subscription", icon: CreditCard, plan: "free" }, // hidden for now
  { title: "Team", url: "/platform/team", icon: Users, plan: "free" },
];
