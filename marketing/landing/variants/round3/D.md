# Agent D: cold outsider review, round 3

The four pages are about 95% the same. They differ only in the hero headline, the hero subtext, the CRM line in the hero, the sample sentence (R2B uses URL paths), the setup heading, and "everyone" versus "every tracked visitor". Everything below the hero is effectively the same in all four, so the hero decides the ranking.

## R2B: "Every form lead arrives with *the visit behind it*."
**A) 5-second test:** what it is: partly ("the visit behind it" is abstract until you read the subtext). Who it is for: yes. Why care: partly. Next step: yes.
**B) Believability:** decent, but the sample sentence's "/, /features and /pricing ... /demo-request" reads like developer output, not something a salesperson would open. Hype: "Every" (as an absolute). Friction: the only CRM explanation is far down the page; you need site-code access; the lead page only appears after a real form submission.
**C) Future-proofing:** "Every form lead arrives with the visit behind it" is false for GPC/DNT visitors, people with blockers, iframe forms and consent mode. "Field timing is recorded for everyone who starts your form" has the same problem. "One line of code" clashes with step 3, which asks you to mark your form with an attribute. See also the shared list below.
**D) Scores:** clarity 7, relevance 8, believability 7, ease 8, desire 7, action 8.
1.4 + 1.6 + 1.4 + 1.2 + 1.05 + 0.8 = **7.45**

## R3A: "Your form sends you a name. *Here is the rest.*"
**A) 5-second test:** what: yes (the subtext lists pages, scroll depth and return visits). Who: yes. Why care: partly (it lists data but never says what you do with it). Next: yes.
**B) Believability:** "Here is the rest" overclaims, because you don't get the rest: the visitor's identity before the form and other-device visits are missing. Hype: "Here is the rest." Friction: same as R2B, though the CRM line in the hero helps.
**C) Future-proofing:** "for everyone who started your form and never sent it: the field where they stopped" is absolute and won't be literally true. The subtext drops the "read one / read them all" use framing, so it describes features with no job attached.
**D) Scores:** clarity 8, relevance 8, believability 7, ease 8, desire 8, action 8.
1.6 + 1.6 + 1.4 + 1.2 + 1.2 + 0.8 = **7.80**

## R3B: "See what your form leads did *before they sent it*."
**A) 5-second test:** what: yes (the most literal headline). Who: yes. Why care: yes (the subtext names both jobs). Next: yes.
**B) Believability:** the highest of the four, because it promises only what is shown. Hype: none. Friction: "sent it" has no antecedent, since "it" means the form but the headline never says "form" on its own. The headline is accurate but flat and could belong to any analytics tool.
**C) Future-proofing:** the hero itself is safe. Only the shared items below apply.
**D) Scores:** clarity 8, relevance 9, believability 8, ease 8, desire 7, action 8.
1.6 + 1.8 + 1.6 + 1.2 + 1.05 + 0.8 = **8.05**

## R3C: R3A's headline with R2B/R3B's subtext
**A) 5-second test:** what: yes. Who: yes. Why care: yes (the headline sets up a gap and the subtext gives two concrete uses: follow up, fix the page or form). Next: yes.
**B) Believability:** the measured subtext ("See what each person read") balances the "Here is the rest" overclaim. Hype: "Here is the rest" (mild). Friction: the same shared friction as the others.
**C) Future-proofing:** "Here is the rest" gets weaker if visitor identification is ever added, or if visitors start asking why their data is missing.
**D) Scores:** clarity 8, relevance 9, believability 7.5, ease 8, desire 8, action 8.
1.6 + 1.8 + 1.5 + 1.2 + 1.2 + 0.8 = **8.10**

## Shared future-proofing risks (all four)
- "FREE DURING EARLY ACCESS · EVERY FEATURE · NO CARD": "every feature" and "free" both expire.
- "If pricing ever starts, you get notice first, and nothing switches to paid on its own." This is a binding promise.
- "it does not sync to your CRM or export data" and "Works next to your CRM: paste a lead's link": the first becomes false once sync ships, and the second then looks weak.
- "About 31 KB compressed": this number will change.
- The form compatibility list (HubSpot, Marketo, ...) and "Snippets for plain HTML, Next.js and Vite/React" will drift.
- "Your first visit is detected automatically and your dashboard opens": a promise that breaks on CSP, blockers or GPC/DNT in the founder's own browser.
- "Set it up once. Everyone sees the same lead." "Once" is absolute.
- "it never records screens, mouse movement or keystrokes": fine today, but it locks you in if you ever add that.
- "No form yet? Setup gives you one." This is a commitment.

## Ranking
1. **R3C: 8.10**
2. **R3B: 8.05**
3. **R3A: 7.80**
4. **R2B: 7.45**

R3C and R3B are close to a tie. R3B is safer and R3C is more memorable. I'd ship R3C, because desire is what the hero is for.

## Differences that mattered
- **Subtext framing beat subtext detail.** "Read one lead before you follow up. Read them all before you change a page or a form" tells both audiences what they would do with the product. R3A's list of data points does not, which is why it lost on relevance.
- **The CRM line in the hero.** It answers a sales reader's first objection ("another tab?") on the first screen. R2B lacks it.
- **Plain page names versus URL paths in the sample.** "/demo-request" makes R2B feel built for developers.
- **"Every tracked visitor" versus "everyone".** It is a small change, but it is the only honest version. R2B's absolutes hurt it.

**Strongest headline:** "Your form sends you a name. *Here is the rest.*" It names the pain (a bare form submission) and the fix in nine words.

**Weakest line (all four):** "One lead for the follow-up. *Everyone* for the form. One page for the team." It is a riddle. A cold reader can't decode "Everyone for the form" without reading the three blocks below it.

## Up to 3 exact-wording changes to R3C
1. Replace "One lead for the follow-up. *Everyone* for the form. One page for the team." with **"Sales reads one lead. Marketing reads *them all*. Both open the same page."**
2. Replace "FREE DURING EARLY ACCESS · EVERY FEATURE · NO CARD" (hero and fit section) with **"FREE DURING EARLY ACCESS · NO CARD"**. "Every feature" adds nothing and will expire.
3. Replace "Visit your site. Your first visit is detected automatically and your dashboard opens." with **"Visit your site. The setup check confirms the script and your form are working."** This promises a check, not a guaranteed auto-open.
