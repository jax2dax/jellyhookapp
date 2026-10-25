// components/InitialsAvatar.tsx
// One avatar treatment for the whole app — a colored circle with initials.
// Always primary-tinted (the theme's brand color) so a person's avatar looks
// the same whether it's a lead, a team member, or anyone else, in every page
// and in both light/dark mode — no per-component hash-to-hue rainbow. A soft
// tint with primary initials (2026-10-25), not a solid green disc: a table of
// twelve solid discs was the loudest thing on the Leads page.
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function initialsOf(label: string | null | undefined) {
  const base = (label || "").trim();
  if (!base) return "?";
  if (base.includes("@")) return base.slice(0, 2).toUpperCase();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function InitialsAvatar({
  label,
  size = "default",
  className,
}: {
  label: string | null | undefined;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className="bg-primary/12 font-semibold text-primary ring-1 ring-inset ring-primary/20">{initialsOf(label)}</AvatarFallback>
    </Avatar>
  );
}
