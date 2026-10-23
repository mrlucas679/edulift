# 07 — Front End

Expo Router + TypeScript strict (ADR-0002). The wireframe PDFs in the repository root
are the visual reference. Layout pattern: hero band, cards, deadline row, five bottom tabs.

## Rules

- A screen collects input and displays what the API returned. It never computes a score,
  threshold, outcome or eligibility. That's the API's job.
- Every data screen has four states: **loading** (skeleton), **empty** (why + what to do),
  **error** (friendly message, request id, Retry), **offline** (cached data + banner).
- No raw colour, size or spacing literal in a screen; tokens only.
- API responses validated with zod; types generated from OpenAPI.
- External links open in the system browser after showing the destination domain; only
  allow-listed https domains.

## Screens

### Onboarding and sign-in (no tabs)
| Screen | Route | Data |
|---|---|---|
| Welcome | `/welcome` | — |
| Privacy notice | `/privacy` | static, versioned |
| Email | `/sign-in` | POST `/auth/start` |
| Code | `/sign-in/code` | POST `/auth/verify`; resend after 30 s |
| Date of birth | `/onboarding/age` | PUT `/me/profile` |
| Too young (<17) | `/onboarding/too-young` | GET `/handoffs` |
| Guardian details (17) | `/onboarding/guardian` | POST `/me/guardian-request` |
| Waiting for guardian | `/onboarding/guardian-pending` | GET `/me/guardian-request`; resend, change email |
| Guardian declined | `/onboarding/guardian-declined` | — |
| Consents | `/onboarding/consent` | POST `/me/consents` (only guardian-allowed purposes for 17) |
| Basics | `/onboarding/profile` | PUT `/me/profile` |
| Interests | `/onboarding/interests` | GET `/fields` (skip allowed) |
| Marks | `/onboarding/marks` | GET `/subjects`, PUT `/me/marks/{period}`, POST `/aps/preview` |

### Guardian (web, no account)
| Screen | Route | Data |
|---|---|---|
| Guardian approval | `/guardian/[token]` | GET/POST `/guardian/requests/{token}` |
| Guardian done | `/guardian/done` | — |
| Guardian withdraw | `/guardian/withdraw/[token]` | POST withdraw |

### Tabs: Home · Funding · Study · Work · Profile
| Screen | Route | Data | Empty state |
|---|---|---|---|
| Home | `/(tabs)/` | GET `/me`, `/deadlines`, `/me/applications` | no marks → main action "Add my marks" |
| Funding list | `/(tabs)/funding` | `/opportunities`, `/me/opportunities/matches` | NSFAS + "why nothing matched" |
| Funding detail | `/(tabs)/funding/[id]` | `/opportunities/{id}` | closed → "usually opens in …" |
| Study home | `/(tabs)/study` | `/programmes`, `/me/scores` | suggest broader field |
| Institution detail | `/(tabs)/study/institution/[slug]` | `/institutions/{slug}` | window-closed banner |
| Programme detail | `/(tabs)/study/programme/[id]` | `/me/eligibility/programmes/{id}` | signed out → requirements + "sign in to check" |
| Work list | `/(tabs)/work` | `/opportunities?kind=…`, `/handoffs` | out of season → "usually opens in …" |
| Work detail | `/(tabs)/work/[id]` | `/opportunities/{id}` | — |
| Profile | `/(tabs)/profile` | GET `/me` | signed out → benefits + sign in |

### Stacked screens
| Screen | Route | Data |
|---|---|---|
| My Plan | `/plan` | POST `/me/plan` |
| Ask about this | `/explain/[kind]/[id]` (sheet) | POST `/me/explain` |
| APS calculator (public) | `/aps` | POST `/aps/preview` |
| My scores | `/scores` | GET `/me/scores` |
| Edit marks | `/profile/marks` | GET/PUT `/me/marks` |
| Applications | `/applications` | GET `/me/applications` |
| Application detail | `/applications/[id]` | PATCH endpoints |
| Saved | `/saved` | `/me/saved` |
| Ask EduLift | `/ask` | POST `/me/ask`; answers with record cards + source lines |
| Drafts | `/drafts` | `/me/drafts` |
| New draft | `/drafts/new` | POST `/me/drafts/generate`; warning not to type ID/contact details |
| Draft detail | `/drafts/[id]` | GET/PUT/DELETE `/me/drafts/{id}`; copy, share as text |
| Settings | `/settings` | consents, low-data mode, sign out |
| My data | `/settings/data` | GET `/me/export`, DELETE `/me` |
| Help | `/help` | static + `/handoffs` |

### System
Not found, global offline banner, maintenance (API 503), top-level error boundary with
request id and Restart.

## Components (build first; screens are assembly)

AppScreen, HeroBand, Button (primary/secondary/text), Card, DeadlineCard + CountdownBadge,
VerdictBadge, CheckList, SourceLine, PlanRouteSection, MarksRow + SubjectPicker, ScorePill,
Carousel, FilterChips, SearchBar (300 ms debounce), ExternalLinkButton, ConsentToggle,
ChecklistItem, StatusPicker, Skeleton, EmptyState, ErrorState, ScamNotice, BottomTabs,
GuardianNotice.

## Design tokens (`mobile/src/theme/`)

| Group | Value |
|---|---|
| Text | Ink (very dark green-grey) on warm off-white; secondary ≥ 4.5:1 |
| Accent | Deep teal (starting value `#0B5F66`, contrast-check in both themes; not FNB green #16A637) — primary button, active tab, focus ring |
| Languages | English, isiZulu, Sesotho string tables in `src/i18n/`; fixed phrases human-reviewed |
| Status | Red, amber, green only for status, always with icon or word |
| Dark mode | Same tokens with dark values; both contrast-checked |
| Type | Atkinson Hyperlegible; body 16, small 14, headings 20/24/28; line height 1.4 |
| Spacing | 4, 8, 12, 16, 24, 32 |
| Radius | 8 cards/buttons; 999 badges only |
| Touch target | 44 × 44 minimum |
| Motion | State changes only; respect reduced motion |

## Accessibility

Every icon has a text or accessibility label. Colour never the only signal. Text scales
with the phone setting without clipping (QA-7). Web: full keyboard navigation, visible
focus, logical heading order. Low-data mode: no images in lists, cached reference data,
smaller pages.
