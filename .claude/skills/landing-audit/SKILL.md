---
name: landing-audit
description: Audit and directly rewrite the Jellyhook landing page, pricing page, about page and docs wording for the target audience, applying edits to the code and logging them. Use when the founder asks to improve the landing page, headline, CTA, or docs copy.
---

# Landing audit

Run the `site-auditor` agent's process (`.claude/agents/site-auditor.md`) end to end:
read pages, judge as the target visitor in 10 seconds, apply the smallest honest fixes in the code, run
`npx tsc --noEmit`, and log before/after text in `marketing/changes.md`. Do not return suggestions without applying them,
unless a fix needs a founder decision or a real asset (state exactly what is needed).
