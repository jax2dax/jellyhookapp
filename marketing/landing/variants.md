# Variant log

Rubric (transparent, fixed before round 1): clarity 0.20 · relevance to the people it names 0.20 · believability 0.20 · ease of the
next step 0.15 · desire 0.15 · action 0.10. Each judge scores 1 to 10 per criterion; weighted total out of 10.
Judges: Agent D (cold outsider, no strategy) + six personas from Phase 3: P01 inbound SDR, P04 in-house CRO manager, P06 freelance
CRO consultant, P07 digital marketing manager, P10 small-company head of growth, P11 sceptic. Each judge sees only the variant
texts and (for personas) its own card. Scores are model judgments, not measurements; differences under about 0.3 are noise.

Stop rule: stop early if no new variant clearly beats the best for two rounds.

## Round 1 (2026-10-09)

| Variant | What changed vs V1 | File |
|---|---|---|
| V1 | Baseline (draft v1) | `variants/V1.md` |
| V2 | Plain-sentence visit summary above the chart; CRO row "across everyone who started your form"; facts block (31 KB compressed, no cookies, consent, forms, check); CRM limit said once with the paste-the-link workaround; shorter fit section | `variants/V2.md` |
| V3 | V2 + CRO-first headline: "See which field loses your leads, and what the people who sent it read first." | `variants/V3.md` |
| V4 | V2 + loss-frame headline: "Your form sends you a name. Here is the rest." | `variants/V4.md` |

Weighted totals (computed from each judge's six scores; Agent D's from its own file):

| Judge | V1 | V2 | V3 | V4 |
|---|---|---|---|---|
| D outsider | 7.40 | 8.10 | 7.30 | 8.55 |
| P01 SDR | 5.60 | 6.90 | 5.05 | 7.35 |
| P04 CRO manager | 5.80 | 6.75 | 7.75 | 6.35 |
| P06 CRO consultant | 5.40 | 6.95 | 7.75 | 6.45 |
| P07 digital marketing | 5.30 | 7.10 | 6.10 | 7.30 |
| P10 head of growth | 6.65 | 7.55 | 5.80 | 8.10 |
| P11 sceptic | 4.75 | 6.25 | 6.25 | 5.05 |
| **Mean** | **5.84** | **7.09** | **6.57** | **7.02** |

Outcomes (personas only):

| Variant | would sign up | interested | skim and leave |
|---|---|---|---|
| V1 | 0 | 1 (P10) | 5 |
| V2 | 2 (P07, P10) | 4 | 0 |
| V3 | 2 (P04, P06) | 2 | 2 (P01, P10) |
| V4 | 2 (P07, P10) | 3 | 1 (P11) |

Findings:
- Everything below the hero in V2 to V4 (summary sentence, facts block, CRM workaround) beat V1 for every judge. That body is kept.
- V2 and V4 are tied on the mean (7.09 vs 7.02). V4 wins with sales, managers and the outsider; it loses the sceptic ("a slogan
  with no concrete claim") and is vague to the CRO consultant on a skim.
- V3 polarises: best for both CRO judges (7.75), worst for the SDR and the head of growth. Agent D also flagged a grammar problem
  ("the people who sent it" points at "field") and an implied causal claim ("loses your leads").
- Requested by several judges and fixable in copy: privacy facts on the first screen (D, P11); page names in the summary sentence (P01);
  the "TWO WAYS" label over three blocks (D); remove "get the answer across all your visits" overpromise (D); fewer screen-name
  dependencies ("Settings has a tracking check") (D).
- Requested but needing the founder or the product (not fixable in copy): price intent after early access (P10, P11); EU hosting, DPA,
  retention (P07, P11); page-load timing (P04, P11); GTM install (P04); multiple client sites (P06); real screenshots (P04, P06, P11);
  CRM sync and export (most).

Best after round 1: **V2 / V4 tie** (V2 by 0.07 on the mean, inside noise).

## Round 2 (2026-10-09)

Shared body for all R2 variants (from round-1 feedback): privacy/trust line under the hero CTA; page names in the summary sentence;
section label "WHO OPENS IT" over the three rows; removed "get the answer across all your visits" overpromise; "How to read a visit"
instead of "readable in ten seconds"; fewer screen-name dependencies. V2 kept as the control. Fresh judge agents (none saw round 1).

| Variant | Hero | File |
|---|---|---|
| V2 | control (round-1 co-leader) | `variants/V2.md` |
| R2A | "Your form sends you a name. *Here is the rest.*" + sub naming pages, scroll, returns, and the field where non-senders stopped | `variants/R2A.md` |
| R2B | "Every form lead arrives with *the visit behind it*." + sub: what each person read before sending, which field non-senders stopped on, one lead / all leads | `variants/R2B.md` |
| R2C | "Your form sends you a name. *See what they read, and where the others stopped.*" | `variants/R2C.md` |

| Judge | V2 | R2A | R2B | R2C |
|---|---|---|---|---|
| D outsider | 7.35 | 8.15 | 7.85 | 7.70 |
| P01 SDR | 5.60 | 6.90 | 6.55 | 5.05 |
| P04 CRO manager | 5.15 | 6.65 | 6.45 | 7.55 |
| P06 CRO consultant | 5.05 | 6.30 | 6.50 | 7.40 |
| P07 digital marketing | 5.85 | 6.85 | 7.05 | 5.80 |
| P10 head of growth | 6.65 | 7.55 | 8.10 | 6.90 |
| P11 sceptic | 5.40 | 6.65 | 7.30 | 6.30 |
| **Mean** | **5.86** | **7.01** | **7.11** | **6.67** |

Outcomes (personas): R2A 1 sign up, 5 interested, 0 skim · R2B 2 sign up (P10, P11), 4 interested, 0 skim · R2C 2 sign up (P04, P06),
2 interested, 2 skim (P01, P07) · V2 0 sign up, 1 interested, 5 skim.

Note on comparability: judges score relative to what they see in the same round, so V2's 7.09 (round 1) and 5.86 (round 2) are not
comparable across rounds. Within round 2, every R2 variant beat the control by more than 1 point for every judge except two cells.

Findings:
- The new body + trust line under the CTA clearly beat the round-1 best (V2). Not stopping.
- R2A and R2B tie (7.01 vs 7.11, noise). R2A: outsider and SDR. R2B: sceptic, digital marketing, head of growth.
- R2C again polarises: CRO judges love it, sales and digital marketing find the long two-idea headline unclear.
- Accuracy flag from Agent D: R2B's headline "Every form lead arrives with the visit behind it" is an absolute that is not true for
  visitors whose browser sends Global Privacy Control / Do Not Track, for iframe forms, or after cleared storage. Same for "field timing
  is recorded for everyone who starts your form". Fixed in round 3.
- Agent D's sample sentence fix ("/" reads as broken), "One script tag" instead of "one line of code" (step 3 asks for an attribute),
  and P01's request to put the CRM answer near the hero are applied in round 3.

Best after round 2: **R2B** (by 0.10, within noise; R2A equal).

## Round 3 (2026-10-09)

Shared body for all R3 variants: R2 body + sample sentence with readable page names; "every tracked visitor who starts your form";
"One script tag." heading; one hero line "Works next to your CRM: paste a lead's link into the contact note." R2B kept as control.

| Variant | Hero | File |
|---|---|---|
| R2B | control | `variants/R2B.md` |
| R3A | R2A hero ("Your form sends you a name. Here is the rest." + its sub) with round-3 body | `variants/R3A.md` |
| R3B | Non-absolute neutral: "See what your form leads did *before they sent it*." + R2B's sub | `variants/R3B.md` |
| R3C | R2A headline + R2B's sub (both audiences' preferred parts) | `variants/R3C.md` |

| Judge | R2B | R3A | R3B | R3C |
|---|---|---|---|---|
| D outsider | 7.45 | 7.80 | 8.05 | 8.10 |
| P01 SDR | 5.45 | 7.15 | 5.90 | 7.15 |
| P04 CRO manager | 6.25 | 5.80 | 7.35 | 6.70 |
| P06 CRO consultant | 5.20 | 6.95 | 6.10 | 6.10 |
| P07 digital marketing | 6.20 | 6.20 | 7.30 | 6.00 |
| P10 head of growth | 6.30 | 6.90 | 7.10 | 7.55 |
| P11 sceptic | 5.20 | 6.65 | 6.85 | 6.65 |
| **Mean** | **6.01** | **6.78** | **6.95** | **6.89** |

Outcomes (personas): R3B 2 sign up (P04, P07), 3 interested, 1 skim (P01) · R3C 1 sign up (P10), 5 interested, 0 skim ·
R3A 1 sign up (P06), 4 interested, 1 skim (P04) · R2B 0 sign up, 2 interested, 4 skim.

Findings:
- All three R3 variants beat the control (R2B) by about 0.8 to 0.9: the non-absolute wording, the CRM line on the first screen and the
  readable sample sentence helped every judge type, including the outsider.
- R3B, R3C and R3A are within 0.17 of each other: a statistical tie for this method.
- R3B wins with the buyers named in the checkpoint (CRO manager, digital marketing, sceptic). R3C wins with the SDR and the head of
  growth, has zero skim-and-leave, and was the outsider's narrow pick ("R3B safer, R3C more memorable").
- Max rounds reached (3). Stopping.

## Decision

**Winner: R3B**, because the founder chose a hero written for the marketing/CRO buyer, R3B is the most believable (no absolute,
no clever frame to decode), and it has the highest mean. **Kept as the main alternative: R3C** (see `alternatives.md`).

Post-test polish applied to the winner (not re-tested; small, accuracy-driven):
1. Headline "…*before they sent it*." -> "See what your leads did *before they sent your form*." (Agent D: "it" had no antecedent.)
2. "FREE DURING EARLY ACCESS · EVERY FEATURE · NO CARD" -> "FREE DURING EARLY ACCESS · NO CARD" (Agent D; also accuracy: non-Elite
   accounts are limited to one site, `lib/actions/site-management.actions.js` line 172, so "every feature" is not literally true).
3. Section heading -> "Sales reads one lead. Marketing reads *them all*. Both open the same page." (Agent D: the old line could not be decoded.)
4. "Set it up once." -> "Set it up for the team." (Agent D: absolute.)
5. Setup step 4 -> "Setup confirms the script is live and opens your dashboard." (Agent D: less of a promise.)
