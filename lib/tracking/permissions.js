// lib/tracking/permissions.js
// Who may do what on a site. Pure. One table, one function, used by every
// server action, so adding a role (or making permissions custom per role
// later) means editing this file and nothing else.
//
// Roles (decided 2026-10-07):
//   owner  everything, including transferring ownership and changing/removing admins
//   admin  everything the owner can do EXCEPT override the owner: cannot remove or
//          demote the owner, cannot transfer ownership, cannot delete the site
//   member can see the site's data, nothing else

export const ROLES = ["owner", "admin", "member"];

export const PERMISSIONS = [
  "site.view",
  "site.rename",
  "site.change_domain",
  "site.toggle_tracking",
  "site.regenerate_key",
  "site.manage_hosts",
  "site.change_form_mode",
  "site.delete",
  "members.invite",
  "members.remove",
  "members.set_role",
  "ownership.transfer",
];

const ADMIN_DENIED = new Set(["site.delete", "ownership.transfer"]);

/** The permission set per role. Edit here to customise a role. */
export const ROLE_PERMISSIONS = {
  owner: new Set(PERMISSIONS),
  admin: new Set(PERMISSIONS.filter((p) => !ADMIN_DENIED.has(p))),
  member: new Set(["site.view"]),
};

export function can(role, permission) {
  return !!ROLE_PERMISSIONS[role]?.has(permission);
}

/**
 * Whether `actor` may act on a member who currently has role `target`.
 * Nobody acts on themselves here (handled by the callers), and an admin can
 * never touch an owner or another admin's ownership-level rights.
 */
export function canManageMember(actorRole, targetRole, permission) {
  if (!can(actorRole, permission)) return false;
  if (targetRole === "owner") return false; // the owner is changed only by transferring ownership
  if (actorRole === "admin" && targetRole === "admin" && permission === "members.set_role") return false;
  return true;
}

/** Roles `actor` may hand out. Admins may create members and admins; only the owner transfers ownership. */
export function assignableRoles(actorRole) {
  if (actorRole === "owner") return ["admin", "member"];
  if (actorRole === "admin") return ["member"];
  return [];
}
