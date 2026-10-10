# Draft v1: Jellyhook landing page

Date: 2026-10-09. Built from `synthesis.md`, `agent-a-marketing.md`, `agent-b-design.md` and the founder's checkpoint answers:
- Hero speaks to the marketing/CRO buyer; sales and managers get their own rows below.
- Theme: keep identity (Instrument Serif, Inter Tight, JetBrains Mono, lime on near-black), cut noise (rope, ghost, marquee,
  pulses, "Est. 2026", "Scroll"), fix contrast (labels to #8b8980, long text #9d9b92, nothing below 4.5:1 for text).
- Proof: the live sample chart now (code); real screenshots from a demo site later (founder will supply). No site data.
- Hook and Ask Hook work in production (founder, 2026-10-09): mentioned at capability level only, one line.
- CTA: "Start free" -> /sign-up. Secondary: "See a sample lead" -> /demo (kept; rebuilt later with screenshots).
- Tone: plain, confident. Length: about 600 to 800 words of copy.
- Free wording: "Free during early access. No card." plus the notice promise.

Preview: `app/landing-preview/page.tsx` (new file, noindex). `app/page.tsx` is untouched until the founder approves.

---

## S1. Hero (Concept A, "The lead, opened", buyer-first wording)

- Eyebrow: For websites that run on form leads
- H1: Every form lead arrives with *the visit behind it*.
- Sub: See what each person read, how far down they got, and how long every field in your form took them. Read one lead before
  you follow up. Read them all before you change a page.
- Primary CTA: Start free · Secondary: See a sample lead
- Risk line: Free during early access · Every feature · No card
- Honesty line: Visitors stay anonymous until they send a form. No screen, mouse or keystroke recording.
- Visual: ProductFrame "Lead page · sample data" containing the real visit chart (sample lead), a visit list (one button per page,
  converted page pre-selected, opens the real page-details panel), and the field-timing bars.
- Caption: A made-up visitor, drawn by the same chart your leads get. Pick a page to see what they reached.

## S2. How to read a visit

- Eyebrow: How to read it
- H2: A visit you can read in ten seconds.
- Sub: It is a chart, not a video. It draws what was measured: pages, time and scroll.
- 1. Each column is one page, in the order they read it. Wider means longer on that page.
- 2. Green shows what they scrolled past. Small marks show the headings on the page, so you can see which ones they reached.
- 3. A highlighted page is where they sent the form. A purple gap is time away from your site before they came back.
- Link: How the visit chart works -> /docs/concepts/session-replay

## S3. Same visit, two jobs (id="features", the header's "Features" anchor)

- Eyebrow: Two ways to use it
- H2: One lead for the follow-up. *All of them* for the page.
- Row A label: Following up (inbound sales, SDRs, nurture)
  - H3: Before you reply, read what they read.
  - Body: Open the lead and see the pages they read, how long they stayed, which headings they reached and whether they came
    back before converting. If the interest is clear, narrow the pitch. If it isn't, keep it general. Mark the lead Qualified or Junk.
  - Visual: sample stats (Pages read 4 · Time engaged 12m · Avg scroll 80% · Time to convert 38m), "Sample data".
- Row B label: Improving pages and forms (CRO, digital marketing, demand gen)
  - H3: See where your form slows people down, and the route converters took.
  - Body: Time on every form field. Forms people started and never sent. The path from first page to form, and where new
    visitors and converted leads came from. When you have a question of your own, Hook answers it across all your visits and
    leads: build it from plain choices, or type it in your own words.
  - Visual: field-timing bars, "Sample data".
- Row C label: Running the team (heads of growth, managers)
  - H3: Set it up once. Everyone sees the same lead.
  - Body: Invite your team with roles. Marketing and sales open the same lead page and agree on Qualified or Junk.
- Link: See everything a lead page shows -> /docs/reference/lead-profile

## S4. Setup (id="setup")

- Eyebrow: Setup
- H2: One line of code. Your next lead arrives with its visit.
- 1. Create your site. Free during early access, no card.
- 2. Paste one script tag. Snippets for plain HTML, Next.js and Vite/React. (code chip with YOUR-KEY)
- 3. Choose which forms count. Mark your form with one attribute, or count every form. No form yet? Setup gives you one.
- 4. Visit your site. Setup notices the first visit and opens your dashboard. Your first lead page appears with your next real
  form submission.
- What if:
  - My forms are HubSpot, WordPress or Marketo. -> Works with your own HTML forms, HubSpot, Marketo, Contact Form 7, Gravity Forms,
    WPForms, Salesforce Web-to-Lead and Mailchimp forms. Some iframe forms cannot be read. Full list and limits ->
  - Someone else edits our site. -> It is one line in the site's head. Send them the setup guide ->
  - We use a consent banner. -> The script stays off when the browser sends Global Privacy Control or Do Not Track, and has an
    optional consent mode that waits for your banner. The legal call stays yours. How consent works ->
  - How do I know it is working? -> Settings has a tracking check that tells you whether the script and your form are set up right.
  - Will it slow my site down? -> We have not published a speed measurement yet. It is one line; remove it and it is gone.
- CTA: Start free · Read the setup guide

## S5. Fit

- Eyebrow: Fit
- H2: Built for sites that live on their contact form.
- For you if: your website's main job is to bring in form leads (demo, quote or contact requests) · someone follows up on each lead
  by hand · you work on landing pages and forms and want detail per lead, not only totals.
- Not for you if: you run an online store checkout · your site has no form · you want names or companies of anonymous visitors ·
  you need video recordings of sessions · you need A/B testing or a CRM sync today.

## S6. Plainly

- Eyebrow: Plainly
- H2: What Jellyhook does not do.
- It does not identify anonymous visitors or their companies.
- It does not record screens, mouse movements or keystrokes. It draws a chart.
- It does not sync to your CRM or export data yet.
- It does not run A/B tests.
- It does not make you compliant. It respects browser privacy signals and offers a consent mode; the legal call is yours.
- It does not promise results. It shows what happened; you decide what it means.
- Early access line: Free during early access, every feature, no card. If pricing ever starts, you get notice first, and nothing
  switches to paid on its own.
- Link: Privacy -> /privacy

## S7. Final CTA (lime band)

- Eyebrow: Next
- H2: See what your next lead *did*.
- Sub: What happens after you click:
- 1 Sign up · 2 Name your site · 3 Paste the tag · 4 Visit your site, and the dashboard opens
- CTA: Start free · Read the setup guide first
- Risk line: Free during early access · No card · Remove the tag any time

Approximate copy length: about 720 words.

---

## Design spec (from agent-b-design.md, applied)

- Container 1200 px for sections, gutters 20/40 px. Section padding py-20 / lg:py-28.
- Type: display-xl hero (clamp 2.5 to 4.5 rem), display-l h2 (clamp 2 to 3.25 rem), h3 24 px serif, lead 18 px, body 16 px,
  labels JetBrains Mono 11 px, tracking 0.2em max.
- Colours: ink #f4f2ea, body #9d9b92 (7.23:1), secondary #8b8980 (5.75:1), lines #1b1b18 (decorative), control borders #5f5d57,
  lime only for the primary CTA and one italic phrase per headline. On lime: black and black/70.
- ProductFrame: wrapped in `className="dark"` (fixes the light-mode rendering bug), panel #0a0a09, top bar with "Sample data" tag.
- Chart accessibility: visit list buttons under the chart (keyboard and touch), converted page pre-selected, visually hidden summary.
- Motion: no infinite loops; hover colour transitions only; arrow nudge under motion-safe.
- Removed from the page: rope image, seasonal ghost, marquee, pulsing dots, "Est. 2026", "Scroll", lime row flood hover.

## Visual list

| Visual | Source now | Later |
|---|---|---|
| Hero lead frame (chart + visit list + details + field timing) | live sample (app/demo/sampleLead.ts, real components) | keep live; add screenshot thumbnail of a real lead page from the founder's demo site |
| S3 Row A stats | sample numbers from the same fixture | real screenshot of LeadStatsCard (sample data) |
| S3 Row B field timing | sample fixture | real screenshot of the Field Timing card (sample data) |
| S4 code chip | real snippet from InstallSteps.jsx with YOUR-KEY | unchanged |

## Known limits of the preview (not fixable without editing existing files)

- The chart's own frame highlight does not follow the visit-list pre-selection (selection state is internal to SessionStrip).
- The header still says "Get started" on desktop and has no CTA in the mobile bar (SiteHeader is outside the allowed folder).
- Footer still shows "All systems go" (SiteFooter is outside the allowed folder).
- Contrast tokens are applied locally on this page only; MarketingTheme is unchanged.
