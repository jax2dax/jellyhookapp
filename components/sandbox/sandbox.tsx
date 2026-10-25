"use client";
// components/sandbox/sandbox.tsx
// The sandbox: lets the real platform components run outside the platform, with sample data (the interactive demo on
// the home page, components/showcase). Inside a <Sandbox>:
//   - a component's server actions are swapped for the sandbox's own (in memory). An action the sandbox does not
//     provide answers "not in the demo"; inside a sandbox NO server action is ever called;
//   - links and router pushes go to the sandbox's navigate(), which switches the demo's page;
//   - the address bar is left alone (lib/urlState.ts keeps the state in memory instead).
// Outside a sandbox nothing changes: every hook here returns the real thing.
//
// To make a component sandbox-ready: call its server actions through useAction("name", realAction), use AppLink for
// links and useNavigate() for router.push, and add the action's type to SandboxActions below.
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { deleteMark, leadMarksFor, markFromAi, recheckMark, saveMark, setMarkActive, setMarkVars, copySharedMark } from "@/lib/actions/marks.action";
import type { markFromAiV2 } from "@/lib/actions/marksAi.action";
import type { loadFormFields } from "@/lib/actions/formFields.action";
import type { loadPageHeadings } from "@/lib/actions/pageHeadings.action";
import type { addToGroup, createGroup, deleteGroup, removeFromGroup, updateGroup } from "@/lib/actions/groups.action";
import type { deleteRule, saveRule, setRuleActive, testHookMessage, markRead } from "@/lib/actions/notifications.action";
import type { listSitePages } from "@/lib/actions/hook.action";
import type { getWindowStat } from "@/lib/actions/dashboardStats.action";

export interface SandboxActions {
  saveMark: typeof saveMark;
  deleteMark: typeof deleteMark;
  recheckMark: typeof recheckMark;
  setMarkActive: typeof setMarkActive;
  setMarkVars: typeof setMarkVars;
  copySharedMark: typeof copySharedMark;
  leadMarksFor: typeof leadMarksFor;
  markFromAi: typeof markFromAi;
  markFromAiV2: typeof markFromAiV2;
  loadFormFields: typeof loadFormFields;
  loadPageHeadings: typeof loadPageHeadings;
  setLeadQualified: (siteId: string, leadId: string, qualified: boolean | null) => Promise<unknown>;
  createGroup: typeof createGroup;
  addToGroup: typeof addToGroup;
  removeFromGroup: typeof removeFromGroup;
  updateGroup: typeof updateGroup;
  deleteGroup: typeof deleteGroup;
  saveRule: typeof saveRule;
  setRuleActive: typeof setRuleActive;
  deleteRule: typeof deleteRule;
  testHookMessage: typeof testHookMessage;
  markRead: typeof markRead;
  listSitePages: typeof listSitePages;
  getWindowStat: typeof getWindowStat;
}

export interface SandboxValue {
  actions: Partial<SandboxActions>;
  /** a link or router push inside the sandbox */
  navigate: (href: string) => void;
  /** the page the sandbox shows, as an address (path and query) */
  location: { pathname: string; search: string };
}

const SandboxContext = React.createContext<SandboxValue | null>(null);

export function Sandbox({ value, children }: { value: SandboxValue; children: React.ReactNode }) {
  return <SandboxContext.Provider value={value}>{children}</SandboxContext.Provider>;
}

/** The sandbox around this component, or null on the real platform. */
export function useSandbox(): SandboxValue | null {
  return React.useContext(SandboxContext);
}

const NOT_IN_DEMO = "This is not part of the demo. Sign up free to use it on your own site.";
const notInDemo = async () => ({ ok: false as const, error: NOT_IN_DEMO });

/** The action to call: the sandbox's own inside a sandbox, else the real server action. */
export function useAction<K extends keyof SandboxActions>(name: K, real: SandboxActions[K]): SandboxActions[K] {
  const sb = useSandbox();
  if (!sb) return real;
  return sb.actions[name] ?? (notInDemo as unknown as SandboxActions[K]);
}

/** The current path and query: the sandbox's page inside a sandbox, else the browser's address. */
export function useAppLocation(): { pathname: string; params: { get(name: string): string | null; toString(): string } } {
  const sb = useSandbox();
  const pathname = usePathname();
  const params = useSearchParams();
  if (sb) return { pathname: sb.location.pathname, params: new URLSearchParams(sb.location.search) };
  return { pathname, params };
}

/** router.push, or the sandbox's navigate inside a sandbox. */
export function useNavigate(): (href: string) => void {
  const router = useRouter();
  const sb = useSandbox();
  return sb ? sb.navigate : router.push;
}

type AnchorProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string; replace?: boolean; scroll?: boolean; prefetch?: boolean };

/** next/link on the platform; inside a sandbox, an anchor that asks the sandbox to navigate. */
export function AppLink({ href, replace, scroll, prefetch, onClick, ...rest }: AnchorProps) {
  const sb = useSandbox();
  if (!sb) return <Link href={href} replace={replace} scroll={scroll} prefetch={prefetch} onClick={onClick} {...rest} />;
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e);
        e.preventDefault();
        sb.navigate(href);
      }}
      {...rest}
    />
  );
}
