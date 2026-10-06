# Hook: field reference

Generated from `jh-hook/schema.ts` by `jh-hook/scripts/genReference.ts`. Do not edit by hand.

## Value types

| Type | You can compare with |
|---|---|
| number | is, is not, more than, at least, less than, at most, between, not between, is empty, is not empty |
| duration | is, is not, more than, at least, less than, at most, between, not between, is empty, is not empty |
| percent | is, is not, more than, at least, less than, at most, between, not between, is empty, is not empty |
| pixels | is, is not, more than, at least, less than, at most, between, not between, is empty, is not empty |
| text | is, is not, is any of, is none of, contains, does not contain, starts with, ends with, is empty, is not empty |
| one of a fixed list | is, is not, is any of, is none of, is empty, is not empty |
| date and time | after, on or after, before, on or before, between, not between, is empty, is not empty |
| yes / no | is true, is false, is empty |

## Measures

| Measure | Works on |
|---|---|
| number of | any rows |
| number of different | number, duration, percent, pixels, date and time, text, one of a fixed list, yes / no |
| total | number, duration |
| average | number, duration, percent, pixels |
| lowest | number, duration, percent, pixels, date and time |
| highest | number, duration, percent, pixels, date and time |
| median | number, duration, percent, pixels |
| percentile | number, duration, percent, pixels |

## page views

One row is one page view. Its id is a pageView id.

### Which page

| Field | Type | Notes |
|---|---|---|
| page | text |  |
| full url | text |  |
| page title | text |  |

### When and how long

| Field | Type | Notes |
|---|---|---|
| entered at | date and time |  |
| left at | date and time | empty while the page is still open |
| time on page (browser timer) | duration | the browser's own stopwatch, sent when the visitor leaves. Can differ by a second or more from 'time on page', which is what the session replay chart shows |
| time on page | duration | left at minus entered at, both stamped by the server. This is the 'Time on page' in the session replay chart's details |
| still on screen | yes / no |  |
| hour of day (UTC, 0-23) | number |  |
| day of week (UTC, 0 = Sunday) | number |  |

### How much of the page was seen

| Field | Type | Notes |
|---|---|---|
| share of page seen | percent | the share of the page that was on screen at least once (the light green band). Empty when the screen height was never recorded |
| share of page seen 2x+ | percent | the share of the page the visitor saw MORE THAN ONCE (scrolled back over): the dark green band. Not limited to exactly twice |
| share of page never seen | percent | the share of the page that was never on screen. Empty when the screen height was never recorded |
| where they entered (% down the page) | percent | where the top of the screen was on arrival, as a share of the page |
| furthest point reached (% down the page) | percent | the bottom of the deepest screen reached (the blue bulb), as a share of the page |
| where they left (% down the page) | percent | where the top of the screen was when they left |
| scrolled back up | yes / no |  |
| reached deepest point at | date and time |  |
| time to deepest point | duration |  |

### Place in the session

| Field | Type | Notes |
|---|---|---|
| page number in the session (1 = first) | number | 1 = the first page of the session |
| is the landing page | yes / no |  |
| is the exit page | yes / no |  |
| converted on this page | yes / no | the page view that was open when a form was submitted: the latest one entered at or before the submission. Same rule the conversions page uses |
| session converted | yes / no |  |

### Screen and page size

| Field | Type | Notes |
|---|---|---|
| page height | pixels |  |
| screen height | pixels |  |
| screen height was recorded | yes / no | false on older rows; seen percentages are empty for them |

### Ids

| Field | Type | Notes |
|---|---|---|
| page view id | text | an internal id, used to link queries together (for example a sub-hook that returns page view ids) |
| session id | text | an internal id, used to link queries together (for example a sub-hook that returns session ids) |
| visitor id | text | an internal id, used to link queries together (for example a sub-hook that returns visitor ids) |

### Connected rows

| Relation | Kind |
|---|---|
| its session | one row: can be matched |
| its visitor | one row: can be matched |
| its forms | several: can be counted or measured |


## sessions

One row is one session. Its id is a session id.

### When and how long

| Field | Type | Notes |
|---|---|---|
| started at | date and time |  |
| ended at | date and time | empty while the session is open |
| last activity at | date and time |  |
| session length | duration | start to end, or to last activity if still open |
| still open | yes / no |  |
| hour of day (UTC, 0-23) | number |  |
| day of week (UTC, 0 = Sunday) | number |  |

### Outcome

| Field | Type | Notes |
|---|---|---|
| converted | yes / no | a form was submitted in this session |

### Entry and exit

| Field | Type | Notes |
|---|---|---|
| landing page | text |  |
| exit page | text |  |

### Where they came from

| Field | Type | Notes |
|---|---|---|
| referrer | text |  |
| campaign source (utm) | text |  |
| campaign medium (utm) | text |  |
| campaign name (utm) | text |  |

### Visitor location

| Field | Type | Notes |
|---|---|---|
| country | text |  |
| visitor timezone | text |  |

### Ids

| Field | Type | Notes |
|---|---|---|
| session id | text | an internal id, used to link queries together (for example a sub-hook that returns session ids) |
| visitor id | text | an internal id, used to link queries together (for example a sub-hook that returns visitor ids) |

### Connected rows

| Relation | Kind |
|---|---|
| page views | several: can be counted or measured |
| away periods | several: can be counted or measured |
| form submissions | several: can be counted or measured |
| form activity | several: can be counted or measured |
| its visitor | one row: can be matched |


## form submissions (leads)

One row is one form submission. Its id is a lead id.

### Who

| Field | Type | Notes |
|---|---|---|
| name | text |  |
| email | text |  |
| phone | text |  |

### Submission

| Field | Type | Notes |
|---|---|---|
| submitted on page | text |  |
| submitted at | date and time |  |
| form quality (high = has an email) | one of a fixed list (high, low) | set automatically when the form is submitted: high if an email was present. Not a person's judgment |
| marked qualified by sales | yes / no | set by sales on the leads page. Empty = not reviewed yet |

### Ids

| Field | Type | Notes |
|---|---|---|
| lead id | text | an internal id, used to link queries together (for example a sub-hook that returns lead ids) |
| visitor id | text | an internal id, used to link queries together (for example a sub-hook that returns visitor ids) |
| session id | text | an internal id, used to link queries together (for example a sub-hook that returns session ids) |

### Connected rows

| Relation | Kind |
|---|---|
| its session | one row: can be matched |
| its visitor | one row: can be matched |


## visitors

One row is one visitor. Its id is a visitor id.

### Activity

| Field | Type | Notes |
|---|---|---|
| first seen | date and time |  |
| last seen | date and time |  |
| has submitted a form | yes / no |  |

### Device

| Field | Type | Notes |
|---|---|---|
| device | one of a fixed list (desktop, mobile) |  |
| browser | text |  |
| operating system | text |  |
| language | text |  |

### Ids

| Field | Type | Notes |
|---|---|---|
| visitor id | text | an internal id, used to link queries together (for example a sub-hook that returns visitor ids) |

### Connected rows

| Relation | Kind |
|---|---|
| sessions | several: can be counted or measured |
| page views | several: can be counted or measured |
| form submissions | several: can be counted or measured |
| form activity | several: can be counted or measured |


## form activity

One row is one form activity. Its id is a form id.

### Which form

| Field | Type | Notes |
|---|---|---|
| page | text |  |
| which form on the page (0 = first) | number | 0 = the first form on the page |

### Progress

| Field | Type | Notes |
|---|---|---|
| status | one of a fixed list (viewed, started, submitted, abandoned) |  |
| last field touched | one of a fixed list (name, email, phone, custom) |  |
| form fields touched | number | a lower bound: fields never focused are not counted |

### Timing

| Field | Type | Notes |
|---|---|---|
| first seen at | date and time |  |
| first typed at | date and time |  |
| ended at | date and time |  |
| time from seeing to typing | duration |  |
| time spent filling | duration | first keystroke to submit or abandon |

### Ids

| Field | Type | Notes |
|---|---|---|
| form interaction id | text | an internal id, used to link queries together (for example a sub-hook that returns form interaction ids) |
| session id | text | an internal id, used to link queries together (for example a sub-hook that returns session ids) |
| visitor id | text | an internal id, used to link queries together (for example a sub-hook that returns visitor ids) |

### Connected rows

| Relation | Kind |
|---|---|
| its session | one row: can be matched |
| its visitor | one row: can be matched |
| its fields | several: can be counted or measured |


## form fields

One row is one form field. Its id is a formField id.

### Which field

| Field | Type | Notes |
|---|---|---|
| field | text | email, name, phone, or the form's own name for any other field |
| field type | one of a fixed list (name, email, phone, custom) |  |
| order focused (1 = first) | number | the order in which the visitor first clicked into the fields |

### Friction

| Field | Type | Notes |
|---|---|---|
| time spent in the field | duration | total time the cursor was in this field, across every visit to it |
| typed in it | yes / no | false = clicked in but never typed a key |
| time before typing | duration | from first clicking into the field to the first keystroke |
| last field touched | yes / no | the field they were on when they stopped. On an abandoned form, this is where they gave up |
| form status | one of a fixed list (viewed, started, submitted, abandoned) |  |

### Timing

| Field | Type | Notes |
|---|---|---|
| first clicked into at | date and time |  |
| first typed at | date and time |  |
| last left at | date and time |  |

### Where

| Field | Type | Notes |
|---|---|---|
| page | text |  |

### Ids

| Field | Type | Notes |
|---|---|---|
| session id | text | an internal id, used to link queries together (for example a sub-hook that returns session ids) |
| visitor id | text | an internal id, used to link queries together (for example a sub-hook that returns visitor ids) |

### Connected rows

| Relation | Kind |
|---|---|
| its form | one row: can be matched |
| its session | one row: can be matched |


## pages (unique addresses)

One row is one page. Its id is a page id.

### Page

| Field | Type | Notes |
|---|---|---|
| path | text |  |

### Connected rows

| Relation | Kind |
|---|---|
| page views | several: can be counted or measured |
| form submissions on it | several: can be counted or measured |
| form activity on it | several: can be counted or measured |


## away periods

One row is one away period. Its id is a awayGap id.

### Timing

| Field | Type | Notes |
|---|---|---|
| left the site at | date and time |  |
| came back at | date and time |  |
| time away | duration |  |

### Ids

| Field | Type | Notes |
|---|---|---|
| session id | text | an internal id, used to link queries together (for example a sub-hook that returns session ids) |

### Connected rows

| Relation | Kind |
|---|---|
| its session | one row: can be matched |
