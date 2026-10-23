// lib/notifications/tests/decide.test.ts - which rules fire for new leads (lib/notifications/decide.ts).
// Run: npx jiti lib/notifications/tests/decide.test.ts  (also in npm run test:marks)
import { decide, fillTemplate, type RuleIn } from "../decide";

let fails = 0;
let passes = 0;
const ok = (c: boolean, m: string) => {
  if (c) { passes++; console.log("ok:", m); } else { fails++; console.log("FAIL:", m); }
};

const marks = new Map([
  ["m1", { name: "Pricing reader", active: true }],
  ["m2", { name: "Came back", active: true }],
  ["m3", { name: "Big budget", active: false }],
]);
const rule = (id: string, markIds: string[], extra: Partial<RuleIn> = {}): RuleIn => ({ id, title: "Hot Lead new", body: "{lead} fulfills {marks} requirements", markIds, recipients: [], channelIds: [], addToGroupId: null, ...extra });
const leads = [
  { id: "L1", visitorId: "v1", name: "Anna Kebede", email: "anna@example.com" },
  { id: "L2", visitorId: "v2", name: null, email: "tom@example.com" },
  { id: "L3", visitorId: "v3", name: null, email: null },
];
const leadMarks = new Map([
  ["L1", new Set(["m1", "m2"])],
  ["L2", new Set(["m1"])],
  ["L3", new Set(["m1", "m2", "m3"])],
]);
const members = ["u1", "u2", "u3"];

let d = decide({ rules: [rule("R1", ["m1", "m2"])], leads, leadMarks, marks, recent: new Set(), members });
ok(d.fires.map((f) => f.leadId).join() === "L1,L3", "fires only for leads with ALL the rule's marks (L1, L3; not L2)");
ok(d.fires[0].body === "Anna Kebede fulfills Pricing reader, Came back requirements", "in Jellyhook the body names the lead: " + d.fires[0].body);
ok(d.fires[0].externalBody === "A new lead fulfills Pricing reader, Came back requirements", "outside Jellyhook no personal data: " + d.fires[0].externalBody);
ok(d.fires[1].body.startsWith("A new lead"), "a lead with no name or email is \"A new lead\"");
ok(d.fires[0].recipients.join() === "u1,u2,u3", "nobody named: every member is notified");

d = decide({ rules: [rule("R1", ["m1"])], leads, leadMarks, marks, recent: new Set(), members });
ok(d.fires.length === 3, "a rule with one mark fires for every lead that has it");

d = decide({ rules: [rule("R1", ["m1", "m3"])], leads, leadMarks, marks, recent: new Set(), members });
ok(d.fires.length === 0 && d.paused[0].missing.join() === "m3", "a rule with a switched-off mark is paused, not fired");
d = decide({ rules: [rule("R1", ["m1", "gone"])], leads, leadMarks, marks, recent: new Set(), members });
ok(d.fires.length === 0 && d.paused[0].missing.join() === "gone", "a rule with a deleted mark is paused");

d = decide({ rules: [rule("R1", ["m1"], { recipients: ["u2", "left-the-site"] })], leads, leadMarks, marks, recent: new Set(), members });
ok(d.fires[0].recipients.join() === "u2", "chosen recipients who left the site are dropped");
d = decide({ rules: [rule("R1", ["m1"], { recipients: ["left-the-site"] })], leads, leadMarks, marks, recent: new Set(), members });
ok(d.fires.every((f) => !f.notify), "nobody left to notify: no notification (the group add can still happen)");

d = decide({ rules: [rule("R1", ["m1"], { addToGroupId: "G1" })], leads, leadMarks, marks, recent: new Set(["R1|v1"]), members });
const l1 = d.fires.find((f) => f.leadId === "L1")!;
ok(!l1.notify && l1.addToGroupId === "G1", "same person within 24 hours: no notification, but still added to the group");
ok(d.fires.find((f) => f.leadId === "L2")!.notify, "others are not held back by someone else's cooldown");

const twice = [{ id: "A", visitorId: "v9", name: "X", email: null }, { id: "B", visitorId: "v9", name: "X", email: null }];
d = decide({ rules: [rule("R1", ["m1"])], leads: twice, leadMarks: new Map([["A", new Set(["m1"])], ["B", new Set(["m1"])]]), marks, recent: new Set(), members });
ok(d.fires[0].notify && !d.fires[1].notify, "the same person twice in one batch: notified once");

ok(fillTemplate("New: {lead} ({marks})", "a new lead", ["A", "B"]) === "New: a new lead (A, B)", "{lead} in the middle stays lower case");
ok(fillTemplate("", "a new lead", ["A"]) === "A new lead matched A", "an empty body uses the default");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
