// app/platform/network/page.jsx
// Renamed to Team (2026-10-24): old links land on /platform/team.
import { redirect } from "next/navigation";

export default function NetworkPage() {
  redirect("/platform/team");
}
