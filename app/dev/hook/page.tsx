// app/dev/hook/page.tsx
// Developer test bench for the Hook engine: the same workspace as
// /platform/hook, in "dev" mode (also shows the SQL, the Postgres cost and
// raw ids). The server action still checks the signed-in user and their
// site, so this page can't read anything the product page can't.
"use client";

import { HookWorkspace } from "@/components/hook/HookWorkspace";

export default function HookDevPage() {
  return <HookWorkspace mode="dev" />;
}
