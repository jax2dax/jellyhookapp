// app/platform/page.jsx
// /platform has no content of its own: everything lives under /platform/*, inside the layout that
// already provides the sidebar. This used to be the shadcn sidebar demo, which rendered a SECOND
// sidebar inside the layout's (the "sidebar inside a sidebar" after sign-in). Now it only redirects.
import { redirect } from "next/navigation";

export default function PlatformIndex() {
  redirect("/platform/dashboard");
}
