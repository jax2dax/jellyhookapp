---
name: write-post
description: Write one final, paste-ready piece of Jellyhook marketing copy for a specific place and person (outreach DM, LinkedIn post, community reply, launch post), using only ledger-approved claims. Use when the founder asks for a post, message or reply.
---

# Write post

Use the `copywriter` agent's rules (`.claude/agents/copywriter.md`). Needed inputs: where it will be posted, who it is
for (a row in `marketing/targets.csv` or a segment from `marketing/strategy.md`), and the goal. If one is missing,
choose the most defensible default from `marketing/strategy.md` and say which you chose. Output the exact text in a
code block, the best time, a follow-up line, and the metric. Save to `marketing/drafts/`.
