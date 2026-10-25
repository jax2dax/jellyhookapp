// lib/notifications/decide.ts
// Which notification rules fire for a batch of new leads. Pure (no database), so it is tested on its own
// (lib/notifications/tests/decide.test.ts). The server feeds it what it read and writes what it returns
// (lib/notifications/check.ts). Design: mds/build/notifications/notifications.md.
//
// A rule fires for a lead when:
//   - the rule is ON and every one of its marks still exists and is switched ON (otherwise the rule is "paused");
//   - the lead has ALL of the rule's marks;
//   - the same person (visitor) has not fired this rule in the last 24 hours (the cooldown; the caller passes the ones
//     that did). A lead whose cooldown blocks the notification is still added to the rule's group, if it has one.
// Recipients: the rule's chosen members that are still active members of the site, or every active member when the
// rule names nobody. External messages never carry personal data: {lead} becomes "a new lead" there.

export interface RuleIn {
  id: string;
  title: string;
  body: string;
  markIds: string[];
  /** member user ids; empty = every member */
  recipients: string[];
  channelIds: string[];
  addToGroupId: string | null;
  /** "every": notify for every matching lead; default: once per visitor per 24 hours */
  repeat?: "daily" | "every";
}

export interface LeadIn {
  id: string;
  visitorId: string | null;
  name: string | null;
  email: string | null;
}

export interface Fire {
  ruleId: string;
  leadId: string;
  visitorId: string | null;
  /** false when the cooldown holds it back: no notification, but the group add still happens */
  notify: boolean;
  recipients: string[];
  title: string;
  /** in Jellyhook: may name the lead */
  body: string;
  /** Slack and webhooks: never personal data */
  externalBody: string;
  markIds: string[];
  markNames: string[];
  channelIds: string[];
  addToGroupId: string | null;
}

export interface Decision {
  fires: Fire[];
  /** rules that could not run because one of their marks is gone or switched off */
  paused: { ruleId: string; missing: string[] }[];
}

const DEFAULT_BODY = "{lead} matched {marks}";

/** Fills {lead} and {marks}. At the start of the text "{lead}" is capitalised ("A new lead ..."). */
export function fillTemplate(template: string, lead: string, marks: string[]): string {
  const t = (template || DEFAULT_BODY).trim();
  const list = marks.join(", ");
  return t
    .replace(/^\{lead\}/, lead.charAt(0).toUpperCase() + lead.slice(1))
    .replace(/\{lead\}/g, lead)
    .replace(/\{marks\}/g, list);
}

export function decide(input: {
  rules: RuleIn[];
  leads: LeadIn[];
  /** lead id -> the ids of the marks it has (from lead_marks, just written by the check) */
  leadMarks: Map<string, Set<string>>;
  /** mark id -> its name and whether it is switched on */
  marks: Map<string, { name: string; active: boolean }>;
  /** "<rule id>|<visitor id>" for each rule a visitor fired in the last 24 hours */
  recent: Set<string>;
  /** active members of the site (user ids) */
  members: string[];
}): Decision {
  const fires: Fire[] = [];
  const paused: Decision["paused"] = [];
  const memberSet = new Set(input.members);
  for (const rule of input.rules) {
    const ids = [...new Set(rule.markIds)];
    const missing = ids.filter((id) => !input.marks.get(id)?.active);
    if (!ids.length || missing.length) {
      paused.push({ ruleId: rule.id, missing });
      continue;
    }
    const names = ids.map((id) => input.marks.get(id)!.name);
    const recipients = rule.recipients.length ? rule.recipients.filter((u) => memberSet.has(u)) : [...input.members];
    const firedNow = new Set<string>(); // the same person twice in one batch: only the first notifies
    for (const lead of input.leads) {
      const has = input.leadMarks.get(lead.id);
      if (!has || !ids.every((id) => has.has(id))) continue;
      const key = rule.id + "|" + (lead.visitorId ?? "lead:" + lead.id);
      // a hook set to "every time" (message_options.repeat) notifies for every lead; otherwise once per visitor per 24 h
      const cooled = rule.repeat !== "every" && (input.recent.has(key) || firedNow.has(key));
      firedNow.add(key);
      fires.push({
        ruleId: rule.id,
        leadId: lead.id,
        visitorId: lead.visitorId,
        notify: !cooled && recipients.length > 0,
        recipients,
        title: rule.title,
        body: fillTemplate(rule.body, lead.name || lead.email || "a new lead", names),
        externalBody: fillTemplate(rule.body, "a new lead", names),
        markIds: ids,
        markNames: names,
        channelIds: rule.channelIds,
        addToGroupId: rule.addToGroupId,
      });
    }
  }
  return { fires, paused };
}
