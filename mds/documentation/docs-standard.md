# Documentation standard (for the docs-writer agent and for humans)

Public docs live in `app/docs/**`. The goal is simple: a stranger reads a page and knows (1) what the feature is for,
(2) how to use it, (3) what a number means and how it was produced, and (4) when it will look empty or wrong.
Generic "docs tactics" are not the goal. These rules are.

## Four kinds of page. Never mix them.
| Kind | Job | Reader's question |
|---|---|---|
| Start here | Get from nothing to the first useful thing | "What is this and how do I begin?" |
| Use case | A real situation and which screens answer it | "Is this for me, and what would I do with it?" |
| Feature reference (one per screen/feature) | What each element shows and means | "What am I looking at?" |
| How it works | The mechanism: where data comes from and how a number is made | "Can I trust this number?" |
| Troubleshooting | Symptom to cause to fix | "Why is it empty/wrong?" |

## Feature reference: required sections, in this order
1. **What it answers**: one sentence, in the reader's words ("Which pages did this person read before submitting?").
2. **When you would use it**: one concrete scenario (2 to 4 sentences, plain, with a made-up but realistic example).
3. **What you see**: each element top to bottom with its exact on-screen label. No invented labels. Verify against the component.
4. **What it needs**: the setup or data that makes it appear (a form submission, a labelled form, N sessions).
5. **How it is calculated**: the rule behind each number, in plain steps. Where a number can differ from a similar one elsewhere
   (e.g. Leads counts every submission, Conversions counts people), say so explicitly.
6. **When it is empty or looks wrong**: the empty state's wording, and the likely causes.
7. **Limits**: what it does not do, honestly.
8. **Related**: links to the concept page, the use case, and troubleshooting.

## How deep to go
Depth follows how easily something is misread, not how much code it has.
- A number with a trap in it (two counts that disagree, "online" meaning a page is open, "Direct" not always direct) gets its own
  explanation with an example.
- A control that explains itself (a date filter) gets one line.
- The mechanism behind a measurement that a curious or sceptical person would question (how time on page is measured, what
  "seen" means on the visit chart, how a session ends) goes on a How it works page, with the exact rule and its limits.

## Grouping
Group by what the reader is trying to do, not by code folders. One page, one job. If a page needs "and" in its title, split it.
Order within a section: the thing most people need first. Put the use cases before the reference.

## Writing rules
No em dashes. No marketing words (powerful, seamless, unlock). Short sentences. Define a term once, where it first appears, and use
it the same way everywhere. Say what is NOT collected or NOT done when a reader would assume it is. Every claim must match the code
today; cite the file in `mds/documentation/doc_source_map.md`, not on the page. Do not document the excluded items in `roadmap.md`
(lead confidence, /intent, Engagement Score, /acquisition). Do not call the visit chart "session replay".

## Definition of done for a feature
A feature that changes what a user sees is not finished until: its feature-reference page exists or is updated, the use case page
mentions it if it opens a new use case, the doc-to-source map has a row for the files it depends on, `npm run docs:check` passes,
and the docs index/nav links to it.

## Review test (apply to every page before finishing)
1. Can someone who has never seen the app say what this feature is for after reading only the first paragraph?
2. Is there one realistic scenario?
3. Could a sceptic tell where each number comes from?
4. Does every on-screen label in the page exist in the code?
5. Does it say when it will be empty?
