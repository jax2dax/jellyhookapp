"use client";
// components/nav/PlatformShell.tsx
// The platform's frame around every /platform page: the sidebar and the top bar, except during onboarding.
// Creating a site and waiting for its verification (/platform/create-site, which also shows the "pending" state the
// verification gate redirects to) is one focused task: no sidebar, no top bar, only the logo, so nothing pulls a new
// user away before the script is installed. The sidebar and top bar are built by the server layout and passed in.
import * as React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const ONBOARDING = ["/platform/create-site"];

export function PlatformShell({ sidebar, topBar, children }: { sidebar: React.ReactNode; topBar: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (ONBOARDING.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return (
      <div className="min-h-screen bg-background">
        <header className="flex h-14 items-center gap-2 border-b px-5">
          <Image src="/jellyhook-nobg.png" alt="" width={24} height={24} className="size-6 object-contain" />
          <span className="font-semibold tracking-wide text-primary">Jellyhook</span>
        </header>
        <main className="flex min-w-0 flex-col">{children}</main>
      </div>
    );
  }
  return (
    <SidebarProvider>
      {sidebar}
      <SidebarInset>
        {topBar}
        {/* min-w-0: a wide child (a visit chart strip) scrolls inside its own card instead of widening the shell */}
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
