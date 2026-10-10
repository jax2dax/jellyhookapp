# Agent B: landing-page design and research

Date: 2026-10-09. Author: Agent B (design + research). Scope: one landing page (`app/page.tsx`).
Inputs read: `marketing/landing/synthesis.md`, `marketing/banned-claims.md`, `app/page.tsx`, `components/marketing/{MarketingTheme,fonts,MarketingPage,SiteHeader,SiteFooter}.tsx`,
`framePlate/` (index, defaultTheme, components), `components/leads/{SelectedFrameDetails,LeadStatsCard}.tsx`,
`app/docs/concepts/session-replay/{ExampleFramePlate.tsx,exampleSession.ts,page.tsx}`, `app/demo/{page.tsx,DemoLead.tsx,sampleLead.ts}`,
`app/platform/create-site/{InstallSteps.jsx,page.jsx}`, `app/layout.tsx`, `app/globals.css`.

Every product claim in this file is restricted to synthesis.md section 3. Draft copy here is a placeholder for Agent A's pitches (see section 6).

---

## 0. Decisions in one screen

- **Theme: keep the identity, cut the noise, fix contrast.** Instrument Serif / Inter Tight / JetBrains Mono, lime on near-black, hairline borders,
  square buttons all stay. The rope, seasonal ghost, marquee, pulsing dots, "Est. 2026", "Scroll ↓" and the lime row-flood hover go. Five text colours
  that fail WCAG AA get remapped (table in section 2). One real bug needs fixing: on a light-mode OS the product chart renders in light colours inside the dark page.
- **Proof = the product itself.** The hero shows the real `FramePlateChart` on the made-up `/demo` lead, labelled "Sample data". Then proof comes from
  setup shown in real code, from saying who it is not for, and from saying what it does not do. No logos, no numbers, no quotes.
- **Section order:** Hero (real chart) → How to read a visit → Two scales (one lead / all leads) → Setup in 4 steps + "what if" answers → For / not for → What it does not do → Final CTA with "what happens after you click" → Footer.

---

## 1. Research table

Evidence strength key:
- **Strong**: a W3C normative standard, or peer-reviewed work that has been replicated or meta-analysed.
- **Moderate**: NN/g eyetracking or usability studies, single peer-reviewed studies, or large first-party Google data.
- **Anecdotal**: agency blogs, practitioner rules of thumb, or **VENDOR** benchmarks. Vendor benchmarks come from companies that sell the thing being measured. They are flagged and never used as the only reason for a decision.

| # | Principle | Why it works (psychology / mechanism) | What it means for this page | Source | Evidence |
|---|---|---|---|---|---|
| 1 | Put the highest-priority content and the main CTA at the top | Attention falls off with distance from the top. In NN/g's 2018 study, about 57% of viewing time was above the fold and 74% in the first two screenfuls (120 participants, 130k fixations) | Hero holds headline, one-line "what you get", primary CTA, risk line and the product. Nothing decorative up there | https://www.nngroup.com/articles/scrolling-and-attention/ | Moderate |
| 2 | Avoid false floors. Let the next section peek in | Gestalt closure: a screen that looks complete suggests there is nothing below | Remove "Scroll ↓" and the big empty hero bottom (`mt-20 md:mt-28`). Let the top of section 2 show at 1366×768 and 390×844 | https://www.nngroup.com/articles/illusion-of-completeness/ | Moderate |
| 3 | Say plainly what the product does, in the user's words | Vague taglines read as hype and lower trust. NN/g found only 36% of sites state what they do | Keep the current hero idea ("what every lead did before they contacted you"). No category labels | https://www.nngroup.com/articles/top-ten-guidelines-for-homepage-usability/ | Moderate |
| 4 | Users judge a site's look in 17–50 ms; low visual complexity and high prototypicality (it looks like what a site of its kind should look like) score as most appealing | First impressions form before reading. Clutter lowers appeal straight away | Remove decorative layers. Use a standard SaaS layout (copy left, product right), styled in the brand | https://research.google/pubs/the-role-of-visual-complexity-and-prototypicality-regarding-first-impression-of-websites-working-towards-understanding-aesthetic-judgments/ | Moderate (peer-reviewed, Google Research, 2 studies) |
| 5 | Processing fluency: things that are easier to process are liked and believed more | Contrast, symmetry, repetition and familiarity make processing easier. That ease is felt as "good" and "true" | High text contrast, consistent section templates, one visual language (the product's chart) reused across sections | https://pages.ucsd.edu/~pwinkiel/reber-schwarz-winkielman-beauty-PSPR-2004.pdf | Strong (theory review, much replication) |
| 6 | Aesthetic-usability effect | People see attractive interfaces as easier to use and forgive small flaws | A reason to keep the distinctive theme rather than flatten it. Polish matters when there is no social proof | https://www.nngroup.com/articles/aesthetic-usability-effect/ | Moderate |
| 7 | Users look at images that carry information and ignore decorative ones | Eyetracking: decorative "feel-good" images get almost no fixations. Product photos get scrutiny | Show the real chart, not the current "illustration" with fake bars. The rope and ghost are pure decoration | https://www.nngroup.com/articles/photos-as-web-content/ | Moderate |
| 8 | Product UI in the hero instead of illustration | Shows what you actually get, which lowers uncertainty | Supports concept A. The figures quoted (57% of 21 sites show UI; illustrations "−5 to −15%") are unsourced agency numbers. Treat as weak | https://getillustrations.com/blog/saas-illustration-styles-that-convert/ , https://www.wearetenet.com/blog/saas-hero-section-best-practices | Anecdotal |
| 9 | Interactive demos engage buyers | Trying it yourself gives a sense of control and makes the product concrete | Supports making the hero chart clickable. Storylane's "7.9x" is self-selected (people who engage with a demo already convert more) | https://www.navattic.com/report/state-of-the-interactive-product-demo-2025 , https://www.storylane.io/blog/interactive-demo-statistics-2026 | Anecdotal, **VENDOR** |
| 10 | B2B buyers research on their own before talking to a supplier | Gartner: buyers spend about 17% of buying time meeting suppliers and the rest researching alone or with their group | The page must answer install, privacy and fit questions with no call. Self-serve proof (sample lead, setup steps, docs links) | https://growthmethod.com/gartner-b2b-buying-journey/ (secondary summary of Gartner) | Moderate (analyst data via a secondary source) |
| 11 | B2B sites must serve several roles (users and decision makers) | Different stakeholders look for different evidence | The "two scales" section: one lead for sales, patterns for CRO/marketing, team handoff for the head of growth | https://www.nngroup.com/articles/b2b-vs-b2c/ | Moderate |
| 12 | Show the price. In B2B, missing pricing is the top frustration | Hidden costs read as risk. NN/g: pricing ranked first of 28 information types | "Free during early access, every feature, no card" goes near every CTA. "What happens after early access" is a founder slot | https://www.nngroup.com/articles/show-price/ | Moderate |
| 13 | Trust comes from design quality, up-front disclosure, comprehensive and current content, and links to the rest of the web | Up-front disclosure means no surprises later. Outside links are trusted more than self-claims | Transparency block; links to /docs for every claim; a real person to contact (founder slot) | https://www.nngroup.com/articles/trustworthy-design/ | Moderate |
| 14 | Make claims easy to verify (Stanford guideline 1); show a real organisation behind the site | Links to evidence signal confidence even if nobody clicks them | Each section gets a small "How this works →" docs link. About link and a human contact | http://credibility.stanford.edu/guidelines/index.html | Moderate (4,500+ participants, older study) |
| 15 | Weak social proof backfires | NN/g users saw low counts as "not popular, maybe not good" | Never show small numbers ("3 teams…"), placeholder logos or "trusted by". Leave proof slots empty until there are real customers | https://www.nngroup.com/articles/social-proof-ux/ | Moderate |
| 16 | Two-sided messages (admitting limits) raise source credibility | Attribution theory: a source that admits drawbacks looks honest. Eisend's meta-analysis finds the strongest effect is on credibility | "What it does not do" and "Not for you if" sections. Honest limits make the rest believable | https://www.sciencedirect.com/science/article/abs/pii/S0167811606000267 | Strong (meta-analysis) |
| 17 | Operational transparency / labour illusion | Seeing how a service works raises its perceived value and trust | Show the real setup: the actual one-line tag, the form attribute, "setup checks every 3 seconds for your first visit" | https://pubsonline.informs.org/doi/10.1287/mnsc.1110.1376 | Moderate (5 experiments, peer-reviewed) |
| 18 | Loss aversion: losses weigh about 2x as much as gains | Reference-dependent choice: a new tool is judged against the current status quo | Frame the pain as what you lose today ("the lead arrives as a name and an email; the visit behind it is gone"). Never use fake urgency | https://econpapers.repec.org/RePEc:oup:qjecon:v:106:y:1991:i:4:p:1039-1061. | Strong |
| 19 | Status quo bias | People stick with the current option. Switching costs and regret are overweighted | Install anxiety is the real wall (synthesis §1). Make the switch look small and reversible: one tag, remove it to stop | https://rzeckhauser.scholars.harvard.edu//publications/status-quo-bias-decision-making | Strong |
| 20 | Risk reversal: no card, free | Removes the loss side of the decision. ChartMogul data: no-card trials bring in more sign-ups but convert to paid at lower rates | The goal right now is sign-ups and installs, so no-card fits. Show "No card" next to each CTA | https://chartmogul.com/reports/saas-conversion-report/ | Anecdotal, **VENDOR** (aggregate of their customers) |
| 21 | Uncertainty about the next step stops action. Show system status and the steps ahead | Visibility of system status (NN/g heuristic 1). Ambiguity aversion | Final CTA lists "what happens after you click" in 4 steps, with time and effort for each | https://www.nngroup.com/articles/ten-usability-heuristics/ | Moderate (canonical heuristic) |
| 22 | Goal-gradient: people speed up as a goal gets close, and pre-filled progress helps | Visible steps make the path feel short | Numbered setup steps. Step 1 ("account") is the easiest and is done in seconds | https://www.semanticscholar.org/paper/The-Goal-Gradient-Hypothesis-Resurrected:-Purchase-Kivetz-Urminsky/5d3c2c04678c691e8a053594acc528f1dbcdb10d | Moderate (field studies, JMR) |
| 23 | Specific, exact claims are believed more than round or vague ones | Exact numbers look measured, not estimated | Use exact facts that are true: "one script tag", "1 attribute: data-conversion=\"true\"", "checks every 3 seconds". Never invent precision | https://www.researchwithrutgers.com/en/publications/it-seems-factual-but-is-it-effects-of-using-sharp-versus-round-nu/ | Moderate (single study) |
| 24 | Cut cognitive load: avoid visual clutter, build on existing mental models, offload work | Working memory is limited, and clutter takes up capacity | One idea per section, no marquee, no lists of 6 Hook features. Teach the chart once, then reuse it | https://www.nngroup.com/articles/minimize-cognitive-load/ | Moderate |
| 25 | Fewer options make choosing easier (choice overload) | Too many options can reduce action. The original jam study gave 30% vs 3%, but meta-analyses find the effect depends on context | One primary CTA label sitewide ("Start free") plus one low-commitment secondary ("See a sample lead") | https://business.columbia.edu/faculty/research/when-choice-demotivating-can-one-desire-too-much-good-thing | Moderate (contested; effect is context-dependent) |
| 26 | "Get Started" labels stop exploration; labels should say what happens next | Vague labels with low information scent pull people into a flow before they are ready | Replace "Get started" (header) and "Get started free" (final) with "Start free". Secondary: "See a sample lead" | https://www.nngroup.com/articles/get-started/ | Moderate |
| 27 | Layer-cake scanning: people scan headings, then read the body under the one they need | Clear headings make scanning work | Every section: a heading that makes the point alone, a sub of ≤2 lines, the visual. Headlines must carry the message without body text | https://www.nngroup.com/articles/layer-cake-pattern-scanning/ | Moderate |
| 28 | F-pattern: the first words of lines and the left edge get the most attention | Text-heavy pages are read in a skim pattern | Front-load key words ("Pages read…", "Time on each field…"). Keep the left-aligned label column used site-wide | https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content-discovered/ | Moderate |
| 29 | Zigzag image/text layouts slow scanning | Unpredictable placement breaks the scan path | Keep product visuals on the same side (right on desktop) in consecutive sections. No alternating | https://www.nngroup.com/articles/zigzag-page-layout/ | Moderate |
| 30 | Visual hierarchy via contrast, scale, grouping | The eye follows contrast and size | Lime is the single highest-contrast accent: CTA plus at most one emphasis per headline. Never lime for decoration | https://www.nngroup.com/articles/visual-hierarchy-ux-definition/ | Moderate |
| 31 | Simple copy converts better | Easier reading means more fluency. Unbounce: copy at 5th–7th grade reading level had 11.1% median conversion vs 5.3% at college level (correlational) | Short sentences, plain words, no jargon ("intent", "insights") | https://unbounce.com/conversion-benchmark-report/saas-conversion-rate/ | Anecdotal, **VENDOR** (correlational) |
| 32 | Mobile: hard text is harder to understand on small screens | Less context is visible, which adds working-memory load | On mobile, cut subs to 1–2 sentences and move details into "How it works" links. The chart needs a "swipe" hint | https://www.nngroup.com/articles/mobile-content/ | Moderate |
| 33 | Dark mode reads slightly worse than light mode, especially at small sizes | Light backgrounds give higher luminance and a smaller pupil, so sharper focus | Not a reason to drop the dark theme, but it means no tiny grey text: body ≥16 px, labels ≥11 px with ≥4.5:1 contrast | https://www.nngroup.com/articles/dark-mode/ | Moderate |
| 34 | Text contrast ≥4.5:1 (AA), ≥3:1 for large text and for UI parts and graphics | WCAG 1.4.3 / 1.4.11; covers low vision and screens in glare | Contrast table in section 2. Five current colours fail | https://www.w3.org/TR/WCAG20-TECHS/G18.html , https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html | Strong (W3C standard) |
| 35 | Moving content that runs over 5 s needs pause/stop/hide (Level A) | Motion pulls attention, which is harmful for ADHD and vestibular users | The infinite marquee and infinite pulse dots fail 2.2.2 as built. Remove them | https://www.w3.org/WAI/WCAG20/Understanding/pause-stop-hide | Strong (W3C standard) |
| 36 | Respect `prefers-reduced-motion`; motion from interaction must be able to be turned off | Vestibular disorders (WCAG 2.3.3) | All transitions go through `motion-safe:`. No parallax, no scroll-jacking | https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html | Strong (W3C standard, AAA) |
| 37 | UI animation duration 100–500 ms | Under 100 ms goes unnoticed; over 500 ms feels slow | Hover/focus 150–200 ms; panel open 200–250 ms | https://www.nngroup.com/articles/animation-duration/ | Moderate |
| 38 | Target size ≥24×24 CSS px (WCAG 2.2 AA) | Motor accessibility; thumbs on touch screens | Buttons are already 56 px (h-14). Tab chips and chart-alternative buttons must be ≥44 px tall on touch | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html | Strong (W3C standard) |
| 39 | Core Web Vitals: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 at the 75th percentile | Slow pages lose people. BBC lost an extra 10% of users per extra second (case study on web.dev) | LCP element = the h1 text. No priority hero images. Reserve the chart's height to avoid CLS | https://web.dev/articles/vitals , https://web.dev/articles/why-speed-matters | Moderate (Google first-party, case studies) |

Notes on sourcing. The widely repeated "bounce probability +32% from 1 s to 3 s" (Think with Google, 2017) could not be checked: the original URL now redirects to a page without the stat, so it is left out. The Gartner 17% figure is cited through a secondary summary because the Gartner page is paywalled.

---

## 2. Theme decision: keep, with the minimum changes

### 2.1 Keep (and why)

| Element | Keep? | Reason |
|---|---|---|
| Instrument Serif (display), italic lime emphasis | **Keep** | Distinctive, readable at display sizes, and already consistent across /, /pricing, /about, /docs, /demo (synthesis §4). Aesthetic-usability (row 6) matters most when there is no social proof. Rule: display only (≥24 px), never body text. |
| Inter Tight (body) | **Keep** | Neutral, legible sans. Raise body from 14–15 px to 16 px on this page. |
| JetBrains Mono (labels, buttons) | **Keep, with limits** | Gives labels a technical, "measured" voice that suits a data product. Minimum 11 px, letter-spacing ≤0.22em, never for sentences (10 px mono at 0.3em tracking is hard to read; row 33). |
| Lime on near-black | **Keep** | Brand recognition. Lime on #070706 is 17.0:1 and black on lime is 17.7:1, both excellent. |
| Hairline borders, square buttons, 12-col label/content grid | **Keep** | Predictable template, which supports scanning (rows 27, 29) and fluency (row 5). |
| `primaryBtn`, `ghostBtn`, `MarketingPage`, `Wordmark` | **Keep** | Reuse; no new button styles. |
| Grain overlay (`GrainOverlay`, 5% opacity, fixed, mix-blend overlay) | **Keep for now, then measure** | Shared site-wide; at 5% it does not change contrast in practice. It is a full-viewport fixed blend layer at z-100, though, which can cost scroll smoothness on low-end phones. If field INP or scroll jank shows up on mobile, drop it on mobile first (`hidden md:block`). |

### 2.2 Remove from the landing page (decorative noise)

| Remove | Why |
|---|---|
| Rope + hook animation (hero and CTA), `/ropeWithHook.png` with `priority` | Decorative, ignored (row 7); the `priority` image competes with LCP (row 39). |
| Seasonal ghost (`RandomIconBadge` with `HALLOWEEN_ICONS`) | Decorative; a random element on each load works against consistency and fluency. Seasonal flavour belongs on social, not on the page that has to earn trust. |
| Lime marquee ticker | Fails WCAG 2.2.2 (moves forever, no pause); repeats feature words, so it adds load and no information (rows 24, 35). |
| `animate-pulse` dots (hero eyebrow; footer "All systems go") | Infinite motion (row 35). **"All systems go" is also an unverified status claim** (there is no status page behind it). Remove it in `SiteFooter` or link it to a real status check. |
| "Est. 2026", "Scroll ↓" | Noise; "Scroll ↓" is a symptom of a false floor (row 2). |
| Lime row-flood hover + `ArrowUpRight` on non-link rows (current Audiences rows) | False affordance: an arrow on hover says "clickable", but the rows go nowhere. |
| `jh-grid` vertical lines behind the hero | Optional. Low value, but harmless at its contrast. Remove from the hero so the product panel is the only structure. |
| The "illustration" panel with fake bars | Replaced by the real chart (sample data, labelled). |

### 2.3 Contrast audit (WCAG 2.x relative luminance, computed)

Computed with the WCAG formula; lime resolves to `#c5ff3d`, lime-bright `#ddff8f`, lime-dim `#9dd912`.

| Colour (current use) | on #070706 (page) | on #0a0a09 (panel) | AA normal text (4.5) | Decision |
|---|---|---|---|---|
| `#f4f2ea` headlines | 17.98 | 17.67 | Pass (AAA) | keep |
| `#e9e7e0` base text | 16.29 | 16.01 | Pass (AAA) | keep |
| `#cac8bf` ghost button text | 12.02 | 11.81 | Pass (AAA) | keep |
| `#a8a69d` header sign-in | 8.26 | 8.12 | Pass (AAA) | keep |
| **`#8b8980` body grey** | **5.75** | **5.65** | **Pass AA, fails AAA (7.0)** | keep for body ≥16 px. For long paragraphs, consider `#9d9b92` (7.23, AAA) |
| `#77756d` labels, captions | 4.37 | 4.29 | **Fail** | **raise to `#8b8980`** (or `#9d9b92`) |
| `#5f5d57` "illustration", "Works with", "Est." | 3.06 | 3.01 | **Fail** | never for text; borders/dividers only |
| `#4a4a43` icons, "© 2026" | 2.26 | 2.22 | **Fail** (also fails 3:1 for meaningful icons) | decorative only, or raise to `#8b8980` |
| lime `#c5ff3d` | 17.03 | 16.73 | Pass | keep |
| lime/60 (nav index numbers) | 6.32 | 6.21 | Pass | keep |
| black on lime (primary button) | 17.74 | n/a | Pass | keep |
| black/65 on lime (CTA body) | 6.57 | n/a | Pass | keep |
| **black/50 on lime** (CTA eyebrow "04 / Get started") | 3.85 | n/a | **Fail** | **use black/70 (7.91)** |
| ghost button border `#2b2b25` | 1.42 (non-text) | n/a | WCAG 1.4.11 asks 3:1 for the visual cue that identifies a control | The label text identifies the button, so this is not a hard fail. Still, raise the border to `#5f5d57` (3.06) for a clearer target |

**Product chart (framePlate default theme) on the panel `#0a0a09`.** Bulbs and form colours pass 3:1 for graphics: enter 8.69, exit 5.26, deepest 5.39, form 10.33, form submitted 15.02, converted frame 5.5, abandoned 4.64, seen-once 4.62. Weak spots: the normal-visit frame `#1c1c1c` (1.16), plate border `#3a3a3a` (1.74), away frame `#5a4080` (2.34), live frame `#0e7490` (3.7). Do not restyle the product to pass. Instead give the chart a full text alternative (section 3.6) so no information relies on those low-contrast shapes, and use the sample lead (which has no "live" frame).

### 2.4 One real bug to fix before showing the chart on the landing page

`app/layout.tsx` uses `ThemeProvider attribute="class" defaultTheme="system"`. The chart's colours (`--fp-*`) and `SelectedFrameDetails`' shadcn tokens (`bg-card`, `text-muted-foreground`, `Badge`) take their **light** values from `:root` unless `.dark` is set on an ancestor. The marketing pages are hard-coded dark. On a light-mode OS, the chart canvas becomes `#f5f5f5` with light plates and the detail panel uses light tokens, which looks broken inside the dark page.
**Fix (minimum):** wrap every product embed in `<div className="dark">…</div>`. The `.dark { --fp-…; --card…; }` block in `globals.css` then applies to that subtree whatever the system theme. The same bug most likely affects `/demo` and `/docs/concepts/session-replay` today. Check it in a light-mode browser.

---

## 3. Design system for this page

### 3.1 Type scale (fluid; mobile → desktop)

| Token | Use | Family | Size | Line height | Tracking |
|---|---|---|---|---|---|
| `display-xl` | Hero h1 | Instrument Serif 400 | `clamp(2.5rem, 5.6vw, 4.5rem)` (40 → 72 px) | 0.98 | -0.025em |
| `display-l` | Section h2 | Instrument Serif | `clamp(2rem, 4vw, 3.25rem)` (32 → 52 px) | 1.04 | -0.02em |
| `display-m` | Card/step titles h3 | Instrument Serif | 24 px (1.5rem) | 1.15 | -0.01em |
| `lead` | Hero sub, section sub | Inter Tight 400 | 18 px desktop / 17 px mobile | 1.6 | 0 |
| `body` | Paragraphs | Inter Tight 400 | 16 px | 1.65 | 0 |
| `small` | Captions under visuals, FAQ answers | Inter Tight 400 | 14 px | 1.55 | 0 |
| `label` | Eyebrows, tags ("Sample data"), button text | JetBrains Mono 600, uppercase | 11 px (minimum) | 1.4 | 0.2em |
| `code` | Snippets in setup | JetBrains Mono 400 | 13 px | 1.6 | 0 |
| `figure` | Numbers inside sample-data stats | Instrument Serif | 28 px | 1 | 0 |

Rules: at most one italic lime phrase per headline (none in h3). Paragraph measure ≤ 62ch (`max-w-[38rem]`). Headlines ≤ 12 words; subs ≤ 2 sentences.

### 3.2 Colour tokens (add to `MarketingThemeStyles` `:root`; the lime trio stays as is)

| Token | Value | Role | Contrast on page `#070706` |
|---|---|---|---|
| `--bg` | `#070706` | page | n/a |
| `--panel` | `#0a0a09` | product frames, cards | n/a |
| `--panel-2` | `#0f0f0d` | chips, code blocks | n/a |
| `--line` | `#1b1b18` | hairlines (decorative separators) | 1.17 (decorative only) |
| `--line-strong` | `#5f5d57` | ghost button border, input borders, focus-adjacent | 3.06 (passes 3:1 non-text) |
| `--ink` | `#f4f2ea` | headlines | 17.98 |
| `--ink-2` | `#e9e7e0` | body emphasis | 16.29 |
| `--muted` | `#9d9b92` (new) | long body paragraphs | 7.23 (AAA) |
| `--muted-2` | `#8b8980` | captions, labels, secondary text (was #77756d) | 5.75 (AA) |
| `--lime` | `#c5ff3d` | primary CTA fill, single headline emphasis, focus ring | 17.03 |
| `--on-lime` | `#000` / `rgb(0 0 0 / .7)` | text on lime / secondary text on lime | 17.74 / 7.91 |
| `--sample` | `#8b8980` on `--panel-2` with `--line-strong` border | "Sample data" tag | 5.65 |

Product colours (framePlate) are **not** brand colours: never use chart yellow, orange or purple for marketing UI. That keeps their meaning (converted / abandoned / away) intact when the chart is taught in section 2 of the page.

### 3.3 Spacing and layout

- 4 px base. Section padding `py-20` mobile / `lg:py-28` desktop (down from `py-32`, which shortens the page by about 1.5 screens).
- Container `max-w-[1200px]` for content sections (header/footer keep 1400). Side gutters `px-5` (20 px; meets the ≥16 px rule) / `lg:px-10`.
- Desktop grid: the existing pattern, **label column (cols 1–4) + content (cols 5–12)**, for text sections. Product sections use **copy 5 cols / visual 7 cols**, with the visual always on the right (row 29).
- Mobile: single column, order = eyebrow → h2 → sub → visual → caption → CTA/link. No horizontal page scroll; only the chart scrolls inside its own frame.
- Hero height: content-driven, not `min-h-screen`. The top of section 2 must show at 1366×768.

### 3.4 Components (reuse first)

| Component | Status | Spec |
|---|---|---|
| `MarketingPage` | reuse | unchanged shell |
| `primaryBtn` | reuse | the single CTA style. Label **"Start free"** everywhere (header, hero, final). Add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lime)]` |
| `ghostBtn` | reuse | secondary only ("See a sample lead", "Read the setup guide"). Border → `--line-strong`. Same focus ring |
| `SectionHeader` | new, tiny | `{eyebrow, title, sub, docsHref?}`. Eyebrow uses the `label` token in `--muted-2`. Optional "How this works →" link (Stanford row 14). Replaces the hand-rolled header blocks repeated 4× in the current page |
| `ProductFrame` | new | wrapper for every product visual: `className="dark"` (bug fix 2.4), `--panel` bg, 1 px `--line` border, a **top bar**: left = what it is ("Lead page · visit chart"), right = **"SAMPLE DATA"** tag. Below the frame: one-sentence `small` caption saying what to look at |
| `StepList` | new | numbered steps (1–4) with title, one line, optional code chip. `<ol>` semantics |
| `FitList` | new | two columns "For you if" / "Not for you if", `<ul>`; check/minus glyphs in `--muted-2` (glyphs are `aria-hidden`; meaning sits in the text) |
| `Disclosure` | new | `<details>/<summary>` for the "What if…" install answers. Native, keyboard-accessible, no JS |
| Header CTA | change | `SiteHeader`: rename "Get started" → "Start free"; **show a compact "Start free" on mobile in the bar itself** (today it is hidden in the hamburger menu, so mobile has no visible CTA after the hero) |

### 3.5 How product visuals are framed and labelled

1. **Real component, made-up data, said in three places**: the `ProductFrame` top-bar tag "SAMPLE DATA", the caption ("A made-up visitor, drawn by the same chart your leads get"), and the lead name chip ("Sam Rivera · sample"). This follows `/demo`, which already says "Sample data. Not a real person or company."
2. **Source of data:** reuse `app/demo/sampleLead.ts` (`buildSampleSession`, `SAMPLE_FIELD_TIMINGS`, `SAMPLE_LEAD`), not the docs fixture. The docs fixture includes a "live" (blue) frame and an always-open session, which would suggest real-time data on a marketing page. One fixture also keeps `/` and `/demo` consistent.
3. **Never** show invented aggregate numbers as if they were measured. Any "all leads" view (field timing across leads, sources) is either the single sample lead's own data or an explicitly labelled sample.
4. **Do not animate fake "live" activity** (counters, typing, cursors). The product does not record cursors, so drawing one would also be a false claim.
5. Every chart has a **text equivalent** (section 3.6) and a caption.
6. Screenshots, if the founder supplies them later (synthesis §6), get the same frame and tag. Real customer screenshots need written permission and blurred PII.

### 3.6 Accessibility rules specific to the chart

- `FramePlateChart` frames are SVG `<g onClick>` with no `tabIndex`/keyboard handling, so the "click a frame" interaction is mouse-only. On the landing page, render a **visit list** under the chart: one `<button>` per page visit (`/ · 1m 40s`, `/features · 3m`, `/pricing · 4m 20s`, `/demo-request · form sent`). Each button selects that visit and opens `SelectedFrameDetails` (build items with the exported `buildTimeline`). This gives keyboard and screen-reader users the same content, and on mobile it doubles as a tap-friendly control (≥44 px rows).
- Start with the converted visit **pre-selected** (its detail panel open), so the value shows without any interaction. Many visitors never click (rows 9, 24).
- The SVG already has `role="img" aria-label="Session activity chart"`. Add a visually hidden summary: "Sample visit: 4 pages over 38 minutes, 26 minutes away before returning, form submitted on /demo-request."
- Mobile: the chart scrolls horizontally inside the frame (`overflowX: auto` in `SessionStrip`). Add a right-edge fade plus a "Swipe →" label in the top bar, under 640 px.

### 3.7 Motion rules

| Allowed | Duration | Reduced motion |
|---|---|---|
| Colour/border transitions on hover/focus | 150–200 ms | kept (no movement) |
| CTA arrow nudge `group-hover:translate-x-1` | 200 ms | `motion-safe:` only |
| Detail panel open after selecting a frame | 200–250 ms fade/translate 6 px (`jh-step-in` exists) | already disabled under reduce |
| `<details>` open | native, none | n/a |

Not allowed on this page: infinite loops (marquee, pulse, rope bob, glow pulse), scroll-triggered reveals of text (they hide content from fast scrollers and screenshot tools), parallax, auto-advancing tabs/carousels, auto-playing video. Anything that has to move for more than 5 s needs a pause control (WCAG 2.2.2), so the rule is simply: nothing moves for more than 5 s.

### 3.8 Performance budget

- LCP element = hero h1 (text, self-hosted font via `next/font`): target ≤2.5 s on a mid-range phone over 4G. Remove the `priority` rope PNG.
- The chart is the only client island in the hero. Server-rendering it is safe for hydration (labels are durations, not clock times), but **reserve its height** (frame height 340 + ribbon ≈ 400 px desktop) so it adds no CLS.
- JS on the page today: Clerk (`Show`, `UserButton`), GA4 gtag, the Jellyhook tracker, the chart. Add nothing else (no animation libraries, no video).
- Ask (product, not page): the HTML install snippet is a plain `<script src>` in `<head>` with no `async`/`defer`, which blocks rendering on customers' sites. Adding `defer` would let the setup section say something true about loading order. Until that is measured, the page says nothing about speed (synthesis §3: "page speed impact (unmeasured)").

---

## 4. Section blueprint

Copy below is **placeholder** in the right shape and within the claim boundary. Slots marked **[A]** are to be filled from Agent A's chosen pitches (section 6).

### S1. Hero: show the product
- **Purpose:** in 5 seconds: what it is, who it is for, what you see, that it is free, and the real thing.
- **Visual device:** `ProductFrame` with the **real `FramePlateChart`** on the sample lead. Top bar: "Lead page · Sam Rivera · SAMPLE DATA". Inside: the lead chip (name, form answer "See why demo requests drop off") → the chart with the converted visit pre-selected → under it, the 5 field-timing bars from `SAMPLE_FIELD_TIMINGS` (longest bar in lime: "41 s on 'What are you hoping to improve?'").
- **Layout:** desktop copy 5 cols / visual 7 cols; mobile copy first, CTA inside the first viewport, visual second.
- **Microcopy slots**
  - Eyebrow **[A]**: e.g. "For websites whose main job is form leads"
  - Headline **[A]**: e.g. "See what every lead did *before they contacted you*."
  - Sub **[A]**: e.g. "Add one script tag. When someone sends your form, you see the pages they read in order, how long they stayed, how far they scrolled, and how long they spent on each field."
  - CTA: primary "Start free" → `/sign-up`; secondary ghost "See a sample lead" → `/demo`
  - Risk line (under CTA, `label`): "Free during early access · every feature · no card"
  - Honesty line (`small`, `--muted-2`): "Visitors stay anonymous until they send a form. No screen, mouse or keystroke recording."
  - Caption (under the frame): "A made-up visitor, drawn by the same chart your leads get. Click a page to see what they reached."
  - Signed-in: the existing `Show when="signed-in"` block ("Go to dashboard"), unchanged.

### S2. How to read a visit (teach the visual once)
- **Purpose:** processing fluency (row 5). The chart is new to everyone, so 3 labels make it readable in 10 seconds, and every later section reuses that reading.
- **Visual device:** a static, annotated crop of the same sample chart (or the live chart with 3 numbered callouts beside it, not on top of it), with the visual on the right.
- **Content:** three numbered points, each mapping to synthesis §3 rows 1 and 3:
  1. "Each column is one page, in the order they read it. Wider = longer on that page."
  2. "Green = what they scrolled past. Marks show the headings they reached." (headings reached)
  3. "Yellow = where they sent the form. Purple = time away before they came back." (returning visits)
- **Microcopy slots:** Eyebrow "How to read it" · Headline **[A]** e.g. "A visit you can read in ten seconds." · Sub: "It is a chart, not a video. It draws pages, time and scroll." · Docs link: "How the visit chart works →" `/docs/concepts/session-replay`.

### S3. Two scales: one lead, then all your leads
- **Purpose:** serve both audiences without blurring them (synthesis §5). Lead with the single-lead moment, then the pattern view.
- **Visual device:** two stacked rows (not a zigzag: the visual stays on the right in both), each with a `ProductFrame`.
  - **Row A, "For the reply" (sales, inbound SDR, nurture):** the sample lead's at-a-glance stats as on `/demo` (Pages read 4 · Time engaged 12m · Avg scroll 80% · Time to convert 38m, "after 1 earlier visit" only if true for the fixture; otherwise "first page to form") + the Qualified / Junk toggle drawn static.
    - Headline **[A]** e.g. "Before you reply, read what they read."
    - Sub: pages, time, scroll and headings for this one person; whether they came back before converting; mark them Qualified or Junk.
    - Caption: "Sample data."
  - **Row B, "For the page and the form" (CRO, digital marketing, demand gen):** field-timing bars + one orange "started, never sent" frame (from the docs fixture's `/pricing` visit, cropped, no live frame) + a "where they came from (first touch)" list labelled sample.
    - Headline **[A]** e.g. "See where the form loses people, and the route converters took."
    - Sub: time on each field; forms started but never sent; the path from first page to form; where new visitors and converted leads came from.
    - Caption: "Sample data. One made-up lead; your account shows every lead."
- **Handoff line (buyer → user, under both rows):** "Set it up once, invite your team with roles, and send sales the lead page." (ledger row 14)
- **Hook slot (GATED):** show only if the founder confirms Hook works in production (synthesis §6). If confirmed: one line, no feature grid: "Ask your own questions across every visit and lead: *Which form field do people give up on most?*" → `/docs/hook`. No "AI" wording, and never "Ask Hook uses AI" (banned-claims).

### S4. Setup: remove install anxiety (its own section, not a footnote)
- **Purpose:** the real wall (synthesis §1, §5). Show the actual work (operational transparency, row 17); make the switch small and reversible (row 19).
- **Visual device:** `StepList` with real code chips (copied from `InstallSteps.jsx`, with the key shown as `YOUR-KEY`), visual on the right: a static code block with tabs **HTML / Next.js / Vite** (tabs are real tab buttons, or static labels if JS is unwanted).
- **Steps (all verified in synthesis §3):**
  1. "Create your site." Free during early access, no card.
  2. "Paste one script tag." `<script src="https://jellyhook.com/tracker.js" data-key="YOUR-KEY"></script>`. Snippets for HTML, Next.js (App / Pages) and Vite/React.
  3. "Choose which forms count." Add `data-conversion="true"` to your form, or count every form. HubSpot: wrap the embed. No form yet? Get a ready-made one at setup.
  4. "Open your site." Setup sees your first visit by itself and opens your dashboard. Your first lead page appears with your next real form submission.
- **"What if…" (`Disclosure`, 5 items):**
  - "My forms are HubSpot / WordPress / Marketo." → works with HTML, HubSpot, Marketo, Contact Form 7, Gravity Forms, WPForms, Salesforce Web-to-Lead, Mailchimp. "Full list and limits →" `/docs/concepts/supported-forms`.
  - "A developer has to add it." → it is one line; send them `/docs/installation`.
  - "We use a consent banner." → the script honours Global Privacy Control and Do Not Track and has an optional consent mode. "How consent works →" `/docs/concepts/privacy-consent`. (Never "compliant".)
  - "How do I know it's working?" → a built-in check in Settings tells you if the script and form are set up right.
  - "Will it slow my site?" → **honest answer slot**: "We have not published a speed measurement yet. Remove the one line and it's gone." (Change only after the founder measures.)
- **Microcopy slots:** Eyebrow "Setup" · Headline **[A]** e.g. "One line of code. Your next lead arrives with the visit behind it." · CTA "Start free" + ghost "Read the setup guide" → `/docs/installation`.
- **Do NOT say:** "takes 2 minutes" (unmeasured), "works with Google Tag Manager" (untested), "integrates with HubSpot" (it reads HubSpot forms; there is no integration).

### S5. Who it is for / not for (self-selection)
- **Purpose:** two-sided credibility (row 16). Sends wrong-fit visitors away early, which also tells right-fit visitors the rest is honest.
- **Visual device:** `FitList`, two equal columns, plain text, no icons beyond check/minus.
- **For you if** **[A wording]**: your website's main job is to bring in form leads (demo requests, quote requests, contact forms); someone follows up on each lead by hand; you work on landing pages and forms and want to see per-lead detail, not only totals.
- **Not for you if:** you run an online store checkout; your site has no form; you want to learn the names or companies of anonymous visitors; you need video recordings of sessions; you need A/B testing or a CRM sync today.
- **Microcopy slots:** Eyebrow "Fit" · Headline **[A]** e.g. "Built for sites that live on their contact form."

### S6. What it does not do (transparency block)
- **Purpose:** up-front disclosure (row 13); defuses the top objections before they become reasons to leave.
- **Visual device:** a bordered two-column list on `--panel`: left "Does", right "Does not". Short lines; each "does not" gets a reason or an alternative.
- **Does not (all from synthesis §3, "not claimable"):** identify anonymous visitors or companies · record screens, mouse movements or keystrokes (it is a chart, not a video) · sync to your CRM (not yet) · run A/B tests · export data (not yet) · make you compliant: it honours GPC/DNT and offers a consent mode, and the legal call is yours · promise results.
- **Early access line (founder slot):** "Free during early access, every feature, no card. **[FOUNDER: what happens when early access ends: notice period, data kept?]**"
- **Microcopy slots:** Eyebrow "Plainly" · Headline **[A]** e.g. "What Jellyhook does not do." · Link: "Privacy →" `/privacy`.

### S7. Final CTA: what happens after you click
- **Purpose:** remove ambiguity about the next 10 minutes (rows 21, 22). The final CTA should not restate features (synthesis §4, fail 8).
- **Visual device:** the lime band (keep it, it is the brand's signature block) with a 4-step strip: `1 Sign up → 2 Name your site → 3 Paste the tag → 4 Visit your site; the dashboard opens`. Black text on lime (secondary text black/70).
- **Microcopy slots:**
  - Eyebrow (black/70): "Next"
  - Headline **[A]** e.g. "See what your next lead *did*."
  - Sub: "Here is what happens after you click:" + the 4 steps.
  - CTA: "Start free" (black button with lime text, existing style) + ghost "Read the setup guide first"
  - Risk line: "Free during early access · no card · remove the tag any time"
  - Human contact **[FOUNDER slot]**: "Questions before you install? Write to [founder email]." (A real person behind the site, row 14.)

### Footer
Existing `SiteFooter`, minus "All systems go" (unverified) and with "© 2026" raised to `--muted-2`.

### Proof map (where proof lives without customers)

| Kind of proof | Where |
|---|---|
| The product itself (real component) | S1, S2, S3 |
| Verifiability (docs links next to claims) | S2, S3, S4 |
| Operational transparency (real code, real steps) | S4, S7 |
| Two-sided honesty | S5, S6 |
| Risk reversal (free, no card, reversible) | S1, S4, S7 |
| Social proof | **Empty slot**, below S3. Add only real, permissioned quotes or logos, never counts below a meaningful threshold (row 15) |

### Header nav note
`SiteHeader` "Features" links to `/#features`. Put `id="features"` on S3, or rename the nav item "How it works" → `/#setup` (S4). Pick one so the anchor does not break.

---

## 5. Hero concepts

### Concept A: "The lead, opened" (recommended default)
- **Layout:** split. Copy left (5 cols), `ProductFrame` right (7 cols). Mobile: copy → CTA → frame.
- **Headline slot [A]:** the universal promise, e.g. "See what every lead did *before they contacted you*."
- **Visual:** the sample lead page in miniature: name chip + form answer → the real visit chart, converted visit pre-selected → field-timing bars. "SAMPLE DATA" tag.
- **CTA:** "Start free" + "See a sample lead" (`/demo`) + risk line.
- **Favours:** everyone, slightly sales-first (the single-lead moment is the most concrete). CRO gets field timing in the same frame. Lowest risk; matches synthesis §5 ("lead with the single-lead moment").

### Concept B: "Where the form loses people" (CRO-first)
- **Layout:** split, visual right. The frame shows **field-timing bars** large, plus a small strip of two visits: one orange "started, never sent" and one yellow "sent".
- **Headline slot [A]:** a CRO framing, e.g. "See which field people stall on, and which forms they never sent."
- **Visual:** field timing + abandoned vs submitted frames (both from fixtures, labelled sample).
- **CTA:** "Start free" + "See a sample lead".
- **Favours:** CRO specialists and digital marketers (the founder's strongest fit). Risk: sales users and heads of growth may not see themselves; the single-lead view moves down to S3 Row A. Best on a CRO-targeted variant URL (`/for/cro`, same components) rather than as the homepage hero.

### Concept C: "One visit, full width" (neutral, buyer-first)
- **Layout:** stacked. Centred headline + sub + CTA, then the **chart full container width** below with a thin annotation rail above the frames ("/ · 1m 40s", "away 26 min", "/demo-request · form sent"). Two small tabs under the chart switch only the caption: "For the reply" / "For the page and the form".
- **Headline slot [A]:** a neutral promise that all three vocabularies read as theirs, e.g. "Every form lead arrives with the visit behind it."
- **Visual:** the widest, most legible view of the chart; the frames lay out naturally left to right.
- **CTA:** "Start free" + "See a sample lead", centred.
- **Favours:** heads of growth and demand gen (the "both scales" story from the first screen). Risk: the stacked layout pushes the visual partly below the fold on 1366×768; keep the chart ≤ 340 px tall there.

### Concept D (optional challenger): "Before / after the form"
- **Layout:** split. Visual = two cards side by side (stacked on mobile): left, "What a form notification gives you" (name, email, one line; drawn generically, labelled "Illustration", no vendor branding); right, "The same lead in Jellyhook" (chart + field timing, "SAMPLE DATA").
- **Headline slot [A]:** loss framing (row 18), e.g. "Your form sends a name. The visit behind it is lost."
- **Favours:** inbound sales and demand gen. Risk: two visuals add cognitive load; the "before" card must never look like a real product's UI.

**Recommendation:** ship **A**. Use **B** as a CRO-specific URL for outreach to CRO people. Traffic is too low for a meaningful A/B test now (and A/B testing is not a product feature, so no tie-in either). Compare A and C with 5-second tests (ask "what does this product do, and who is it for?") with 5–8 target-role people before choosing.

---

## 6. Integration with Agent A (marketing pitches)

Checked at finish time: `marketing/landing/agent-a-marketing.md` **did not exist** (the folder held only `synthesis.md` and this file). So every headline, sub and wording slot above is marked **[A]** and keeps a placeholder that stays within synthesis.md §3.

Slot list for the orchestrator to fill from Agent A:

| Slot | Section | Constraint |
|---|---|---|
| A1 eyebrow + A2 headline + A3 sub | S1 hero | headline ≤12 words; sub ≤2 sentences; neutral vocabulary across sales/CRO/managers |
| A4 headline | S2 how to read | teaches, does not sell |
| A5 Row A headline + sub | S3 one lead | sales vocabulary (reply, first call, follow-up) |
| A6 Row B headline + sub | S3 all leads | CRO/marketing vocabulary (field, drop, route, source) |
| A7 handoff line | S3 | buyer → user |
| A8 headline | S4 setup | must contain "one" (script tag) and no time claim |
| A9 for / not-for wording | S5 | not-for must include the synthesis §2 wrong-fit list |
| A10 headline | S6 transparency | plain, no irony |
| A11 headline + sub | S7 final | "what happens after you click" stays |
| A12 hero concept choice | §5 | A by default |

When Agent A's file lands: fit its chosen pitch into A1–A3 and A11 first, map segment-specific pitches to A5/A6, and drop any pitch that needs a claim outside synthesis §3 (e.g. speed, AI, identification, outcomes).

---

## 7. Open items for the founder (design-relevant)

1. Confirm Hook works in production. This gates the S3 Hook line.
2. What happens when early access ends (S6 line).
3. A contact email to show publicly (S7).
4. Fix `.dark` scoping for product embeds (section 2.4). It probably also affects `/demo` and the docs visit-chart page today.
5. Remove or verify the footer "All systems go".
6. Consider `defer` on the HTML install snippet, then measure; until then the page makes no speed claim.
7. Keep `/demo`: the hero's secondary CTA depends on it.
