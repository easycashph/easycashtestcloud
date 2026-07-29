# Easycash Portal — Official Website Strategy & Overhaul Roadmap

**Status:** DRAFT FOR APPROVAL — no implementation started from this document yet
**Owner:** Easycash Lending Company, Inc. (MIS)
**Created:** 2026-07-28
**Scope:** `app/portal` — to become the **official public website of Easycash**, replacing the
legacy WordPress-style site archived in `legacy/website/`.

---

## 0. How to read this document

This is a **strategy + gap analysis + phased roadmap**, not a spec to build blindly. Per
`CLAUDE.md`, every phase must be analyzed, designed, approved, then implemented — one at a time.

Confidence labels are used throughout:

| Label | Meaning |
|---|---|
| **CONFIRMED** | Verified in this repo, in legacy data, or in a regulation document we hold |
| **PARTIAL** | Partly verified; the rest needs business/legal confirmation |
| **ASSUMED** | Industry best practice applied to Easycash; needs management sign-off |
| **UNKNOWN** | Requires verification before it can be published — must never be invented |

⚠️ **Nothing in the "Content & Compliance" sections may be published with placeholder or invented
values.** A lending website that states a wrong SEC number, a wrong interest rate, or a wrong
Certificate of Authority is a regulatory violation, not a typo.

---

## 1. The goal, restated

> "Gusto ko gumawa ng overhaul update sa Easycash Portal para ito na ang maging official Easycash
> website in the future… makikita ang Easycash news… katulong ng mga clients and future clients
> para makapag-submit ng loan applications at ma-track ang kanilang loan account… tulungan mo ako
> na maging one of the top 10 best lending website ang Easycash Portal."

Translated into product terms, the portal must serve **three distinct audiences on one domain**:

| Audience | What they need | Current support |
|---|---|---|
| **A. Stranger / future client** (never heard of Easycash) | Trust signals, what products exist, how much will it cost me, am I eligible, is this legit and SEC-registered | Partial — landing page exists |
| **B. Applicant** (decided to apply) | Fast, resumable, mobile-first application; clear requirements; visible status | Good — already built |
| **C. Existing borrower** (has an active loan) | Balance, next due date, amortization schedule, payment channels, receipts, SOA | **Missing — this is the biggest gap** |

Plus a fourth, cross-cutting audience:

| **D. Regulator / partner / job seeker** | Corporate identity, SEC/CA disclosure, complaints channel, DPO contact | Partial |

A "top 10 lending website in the Philippines" is not a design award — it is a site that **wins all
four of these at once** while being legally airtight. That is the north star of this document.

---

## 2. Where Easycash stands today

### 2.1 What is already built (CONFIRMED — read from the repo)

**Frontend — `app/portal/src`:**

- Landing page (`LandingPage.tsx`, 489 lines) with hero, products, how-it-works, features,
  testimonials, FAQ sections; framer-motion reveal animations; image fallback handling
- Auth flow: sign up → email verification → login → forgot/reset password
- Applicant dashboard (`DashboardPage.tsx`)
- Multi-step loan application form (`LoanApplicationFormPage.tsx`), resumable via `/apply/:id`
- Loan products page, profile page (view/edit + avatar), security page (change email/password)
- Privacy Policy and Terms pages
- Notification bell, PSGC-backed address picker, light/dark theme toggle
- Design system: Tailwind + a local `components/ui` set (Button, Card, Dialog, Input, Select, …)
- **HashRouter** — deliberately chosen for GitHub Pages static hosting (see `App.tsx:17-20`)

**Backend — `app/backend/src/modules/client-portal`:** a full Clean Architecture module —
portal auth (JWT), OTP challenges, profile read/update, loan application CRUD, document
upload/download, branch listing, notifications. Portal identity is deliberately **separate** from
staff identity (`ADR-044-separate-customer-identity-for-public-portal.md`).

**Supporting backend capability that the portal does NOT yet expose:** `loan-account`, `ledger`,
`repayment`, `statement-of-account` (ADR-052), `loan-document` (ADR-051), `interest-rate-chart`,
`payment-reminder` / `sms-reminder` / `email-reminder`.

> **This is the single most important finding of the analysis.** The hard part — the ledger,
> the amortization schedule, the SOA generator — **already exists in the backend.** Audience C
> (existing borrowers) is unserved not because the data isn't there, but because no portal
> endpoints and no portal pages have been wired to it yet. This is the highest-value, lowest-risk
> work available.

### 2.2 Known blockers (CONFIRMED)

| Blocker | Evidence | Impact |
|---|---|---|
| Backend is not publicly reachable | `App.tsx:92-103` — a `PreviewBanner` shows whenever `VITE_API_BASE_URL` still points at localhost | **Site cannot go live.** Sign-up/login are dead in the deployed build |
| GitHub Pages cannot run at all yet | **2026-07-29, root-caused:** the deploy workflow lived at `app/portal/.github/workflows/deploy.yml` — invisible to GitHub Actions in a monorepo, which only scans `.github/workflows/` at the repo root (confirmed zero Actions runs in the repo's history). Fixed: relocated to `.github/workflows/deploy-portal.yml`. **Still blocked**: `gh api repos/.../pages` → 422 "Your current plan does not support GitHub Pages for this repository" — this repo is private, and private-repo Pages needs a paid GitHub plan | No public URL. Needs an org billing decision: upgrade the plan, make the repo public, or switch to a host that doesn't require either (Netlify/Cloudflare Pages) |
| No real domain | — | `easycash.ph` (or equivalent) status **UNKNOWN** — must confirm ownership |
| No landing images | `public/images/README.md` lists 4 expected files, none present | Hero/product cards render placeholder gradients |
| No news/blog capability | No route, no data model | Cannot satisfy the stated "makikita ang Easycash news" requirement |

### 2.3 Corporate facts on hand

| Fact | Value | Confidence |
|---|---|---|
| Legal name | Easycash Lending Company, Inc. | CONFIRMED |
| SEC Registration No. | **CS201001882** | CONFIRMED — appears twice in the archived legacy site |
| Registered address | Unit 9, G/F The Midland Plaza, M. Adriatico St., Brgy. 669, Ermita, Manila | CONFIRMED (legacy site) |
| Telephone | (02) 5 310-3708 | CONFIRMED (legacy site) |
| DPO contact | dataprivacyofficer@easycash.ph | CONFIRMED (legacy site) |
| Product lines | Seafarer Loan, Personal Loan, SME Loan | CONFIRMED (legacy site) — internal LMS has more (`SP-Flash`, `SL-LAZ`, `SML-REG`, `PFL-GAD`, …) |
| **Certificate of Authority (CA) No.** | **640** | CONFIRMED — appears twice in the archived legacy site, and was already rendered in the portal footer. Recommend a one-time cross-check against the SEC's own records before launch |
| SEC OLP registration status | — | **UNKNOWN — MUST VERIFY.** See §3.1 |
| Branch list / addresses | Backend has `ListPortalBranchesUseCase` | PARTIAL — verify which are public-facing |
| Official mobile numbers | Smart 0947 595 6151 · Globe 0927 784 7091 | CONFIRMED (legacy site) |
| Social media accounts | — | UNKNOWN |

**Action item before any public launch:** management/legal must fill every UNKNOWN above in
writing. Nothing here may be guessed.

All CONFIRMED values above are now centralised in **`app/portal/src/lib/companyInfo.ts`** — the
single source of truth every public page reads from. Never hardcode a disclosure value in a
component again.

---

## 3. What actually separates a top-tier PH lending site

Benchmarked against the sites Filipino borrowers actually compare (Home Credit, Tala, Cashalo,
Digido, JuanHand, BillEase, Tonik, SB Finance, Asialink, Radiowealth, Global Dominion, plus bank
personal-loan pages from BPI/Security Bank/PSBank). Five things consistently separate the leaders.
All five are **ASSUMED** as strategy and need your sign-off, but each is grounded in a specific
Philippine regulation or a repeatedly observed market pattern.

### 3.1 Radical, regulation-grade cost transparency

This is #1 for a reason: it is both the top trust driver **and** a legal obligation in the
Philippines. The leaders publish their numbers; the scam-adjacent apps hide them.

**Legal basis Easycash must satisfy (verify each with counsel — regulation text should be obtained
and read in full before implementation, the same way `legacy/SEC/BSP1133.pdf` was for ADR-053):**

| Regulation | Requirement (summary — verify text) | Confidence |
|---|---|---|
| **RA 9474** (Lending Company Regulation Act of 2007) | Must operate under an SEC Certificate of Authority; disclose it | CONFIRMED (statute exists) / PARTIAL (our CA no. unknown) |
| **RA 3765** (Truth in Lending Act) | Must disclose finance charges and the **effective interest rate** to the borrower before consummation | CONFIRMED |
| **SEC MC 18-2019** | Prescribes disclosure/advertising conduct for lending & financing companies — company name, SEC Reg. No. and CA No. must appear in all ads/websites/online platforms | PARTIAL — text to be obtained and read |
| **SEC MC 10-2021** | Online Lending Platforms must be registered/reported to the SEC; unregistered OLPs are prohibited | PARTIAL — our registration status UNKNOWN |
| **BSP Circular 1133 / SEC MC 3-2022** | Rate ceilings for unsecured, general-purpose loans ≤ ₱10,000 with tenor ≤ 4 months: 6%/mo nominal, 15%/mo EIR, 5%/mo penalty, 100%-of-principal total cost cap | **CONFIRMED — already analyzed in `docs/Architecture/ADR-053`** |
| **RA 10173** (Data Privacy Act) | Registered DPO, privacy notice, lawful basis, data subject rights | CONFIRMED — DPO contact already published |

> **Direct link to existing engineering work:** ADR-053 records that **43 real loan accounts**
> currently satisfy the BSP-1133 coverage criteria, and that the EIR cap, total-cost cap, and
> non-compounding penalty are still **open gaps** in the calculation engine. A public website that
> advertises rates for those products is a *disclosure surface* for a rule the engine does not yet
> fully enforce. **ADR-053 Phases 3–5 should be treated as a launch dependency for publishing any
> covered product's pricing**, not as unrelated backlog.

**What to build:**

- A **Rates & Fees page** — one canonical, public table per product: nominal rate, all fees
  (processing, service, notarial, insurance, handling), penalty rate, and the representative EIR.
- A **loan calculator** on every product page: user moves amount + term sliders and immediately
  sees monthly amortization, total interest, total fees, **total amount payable**, and EIR — with a
  "this is an estimate, final terms subject to approval" disclaimer.
  *Engineering note:* this must be driven by the **same calculation engine** as the LMS
  (`docs/Architecture/CALCULATION_ENGINE_SPEC.md`), exposed through a public, unauthenticated,
  rate-limited endpoint. A second, hand-written calculator in the frontend would drift from the
  real product terms and become a mis-disclosure. **Never duplicate financial logic.**
- A **Representative Example** block under every advertised rate (the UK/EU convention, and the
  clearest way to satisfy RA 3765 in an advertising context).
- **Persistent footer disclosure** on every page: legal name, SEC Reg. No. CS201001882, CA No.,
  registered address, contact number, and the SEC's own borrower-protection advisory line.

### 3.2 Eligibility clarity before the form

The most common complaint about PH lending sites is wasting 20 minutes on a form only to be
rejected. The leaders solve this with a **60-second pre-qualification check** — 4–6 questions
(age, citizenship/residency, employment type, monthly income, existing obligations) that returns
"you likely qualify for ₱X–₱Y" **without a credit pull and without creating an account.**

This is also the single highest-leverage conversion feature: it turns Audience A into Audience B.
It must be explicitly labelled as **indicative, not an approval**.

Alongside it: a **Requirements Checklist** per product (valid IDs accepted, proof of income, proof
of billing, and for Seafarer — contract/allotment documents), downloadable as PDF so applicants can
prepare before starting.

### 3.3 A real self-service borrower account (the biggest gap)

Today the portal's authenticated area serves *applicants*. A top-tier site serves *borrowers* for
the whole loan lifecycle. Required:

- **Loan summary** — outstanding balance, next due date, next amount due, days past due if any
- **Full amortization schedule** — every installment: due date, principal, interest, fees, status
- **Payment history** — every posted payment with OR/reference number, downloadable receipt
- **Statement of Account** — on-demand PDF (ADR-052 already implements generation server-side)
- **Where and how to pay** — the exact payment channels with step-by-step instructions and the
  borrower's own reference number, copy-to-clipboard
- **Loan documents** — signed contract, disclosure statement (ADR-051 generates these)
- **Payoff / early settlement quote** — "what do I owe if I pay in full today?"
- **Renewal / re-loan eligibility** — for good payers, a one-click path back into the funnel.
  This is where lending sites make their margin; it is also genuinely useful to the borrower.

**Engineering note:** this is a new set of read-only, borrower-scoped endpoints on the
`client-portal` module, reading through the existing `loan-account`, `ledger`, `repayment`,
`statement-of-account`, and `loan-document` modules. Strict authorization: a portal account may
only ever read loans belonging to its own linked borrower. This needs a dedicated ADR and a
security review before implementation — it is the first time real ledger data leaves the internal
network.

### 3.4 Trust architecture

Filipino borrowers have been burned by predatory apps; the SEC publishes shutdown lists regularly.
Trust must be **designed in**, not asserted:

- **Security & anti-scam page**: "Easycash will never ask for a fee before releasing your loan.
  Easycash will never ask for your OTP or password. Our only official channels are …" — this single
  page prevents real fraud against your real clients
- **Verifiable identity**: SEC Reg. No. + CA No. + a link to the SEC's own company-search page
- **Data privacy transparency**: what is collected, why, retention, DPO contact, and — critically
  for the PH market — an explicit **"we do not access your phone contacts or photos"** statement.
  Contact-list harvesting for debt shaming is the #1 reason Filipinos distrust online lenders
- **Real testimonials, honestly labelled.** The three testimonials currently in `LandingPage.tsx`
  are inherited from the legacy site and are **unattributed**. Either obtain documented consent and
  attribute them (first name, role, year), or replace them. Unverifiable review content on a
  regulated financial site is a liability
- **Complaints & escalation page**: internal complaint channel, expected response SLA, and the
  SEC / BSP consumer-assistance escalation path. The legacy site had a "File Complaint" page —
  restore this
- **Physical presence**: branch directory with map, hours, and phone per branch

### 3.5 Content that ranks and educates (the "news" requirement)

Your stated requirement — *"makikita ang Easycash news"* — is also the SEO engine. Recommended
structure, in priority order:

1. **Announcements** — service advisories, holiday schedules, new branches, system maintenance.
   *This is what existing borrowers actually need*, and it reduces call volume.
2. **Financial literacy / guides** — "How much can a seafarer borrow?", "Understanding your
   amortization schedule", "How to avoid loan scams in the Philippines". This is what ranks on
   Google and brings in Audience A.
3. **Company news** — milestones, CSR, partnerships. Lowest traffic value, highest corporate value.

**Implemented 2026-07-28 — repo-committed content, no CMS, no new dependencies.**
Posts live in `app/portal/src/content/news.ts` as typed structured blocks. Rationale: zero
infrastructure cost (aligned with the project's low-cost philosophy), no database tables, no CMS to
secure or patch, and full git history and review on every published word — which matters enormously
when a regulator can read your blog.

MDX was the original recommendation, but it needs a build plugin plus a markdown-rendering
dependency, which `CLAUDE.md` discourages. Typed blocks give the same git-review benefit, add type
safety (a malformed post fails the build rather than rendering broken), and cost nothing. The
upgrade path to MDX or a real CMS stands, justified once non-technical staff are publishing weekly.

**No posts have been written.** The page ships with a proper empty state. Easycash's real
announcements must come from the business — inventing company news would be fabrication. The file
carries a copy-paste template and rules for authors, including: **never state rates, fees, or loan
terms in a post** — those belong on the Rates & Fees page, driven by real product configuration, so
they cannot silently go stale.

**SEO prerequisites (currently blocked):** `HashRouter` URLs (`/#/products`) are poor for SEO and
social sharing, and a pure client-rendered SPA gives crawlers little to index. See §5, Phase 0.

---

## 4. Gap analysis summary

Status as of **2026-07-28**.

| # | Capability | Now | Priority |
|---|---|---|---|
| 1 | Public hosting + real domain + reachable API | ❌ | **P0 — blocks everything** |
| 2 | Full regulatory footer disclosure (SEC Reg/CA) on every public page | ✅ **DONE** | P0 — legal |
| 3 | Rates & fees transparency page | ❌ | **P0 — legal + trust** |
| 4 | Loan calculator (engine-backed) | ❌ | P1 |
| 5 | Pre-qualification check | ❌ | P1 |
| 6 | Borrower self-service (balance/schedule/SOA/payments) | ❌ | **P1 — biggest product gap** |
| 7 | News / announcements / blog | ✅ **PLATFORM DONE** — awaiting real content from the business | P1 — explicitly requested |
| 8 | Security & anti-scam page | ✅ **DONE** | P1 — trust |
| 9 | Complaints & escalation page | ✅ **DONE** | P1 — legal (restored from legacy) |
| 10 | Requirements checklist (per product, engine-source-of-truth with the form) | ✅ **DONE** | P1 — conversion |
| 11 | Contact page | ✅ **DONE** | P1 — trust |
| 12 | Branch directory | ⚠️ backend only | P2 |
| 13 | SEO: meta, Open Graph, structured data | ✅ **DONE** | P2 |
| 14 | SEO: per-page titles & descriptions | ✅ **DONE** | P2 |
| 15 | SEO: real (non-hash) URLs + sitemap | ❌ blocked by HashRouter | P2 |
| 16 | Performance: route code-splitting | ✅ **DONE** — initial bundle 463 kB → 366 kB | P2 |
| 17 | Performance: Core Web Vitals budget in CI | ❌ | P2 |
| 18 | WCAG 2.1 AA accessibility | ⚠️ improved — skip link, focus-visible rings, reduced-motion, landmarks, per-page titles. Full audit still outstanding | P2 |
| 19 | Resilience: error boundary (no blank-page crashes) | ✅ **DONE** | P2 |
| 20 | Resilience: offline indicator | ✅ **DONE** — required by `CLAUDE.md`'s Offline-Friendly Design section | P2 |
| 21 | Resilience: real 404 page (was a silent redirect home) | ✅ **DONE** | P2 |
| 22 | Installability: web app manifest + home-screen icons | ✅ **DONE** | P2 |
| 23 | Loading skeletons on authenticated pages (Dashboard, Profile currently use plain "Loading…" text) | ❌ flagged, not started — larger UI effort, see batch 4 note | P2 |
| 24 | Landing imagery | ❌ placeholders | P2 |
| 25 | Testimonials verified/attributed or removed | ⚠️ partly mitigated — fabricated star ratings removed; attribution still a **pending business decision** | P2 |
| 26 | Bilingual EN / Filipino | ❌ | P3 |
| 27 | Support chat / chatbot | ❌ | P3 |
| 28 | PWA / installable + push (offline caching / service worker) | ❌ — manifest alone (row 22) covers home-screen install; no offline caching yet | P3 |
| 29 | Analytics (privacy-respecting) | ❌ | P3 |

### Completed 2026-07-28 — Phase 1 partial

Shipped without needing any answer from management, since every value used was already confirmed:

- `src/lib/companyInfo.ts` — single source of truth for all legal disclosure values
- `src/components/SiteFooter.tsx` — regulatory footer, replacing the copy hardcoded in
  `LandingPage.tsx`
- `src/components/PublicPageLayout.tsx` — shell guaranteeing the footer on every public page;
  Privacy and Terms retrofitted onto it
- `src/pages/SecurityTipsPage.tsx` (`/security-tips`) — anti-scam guide + official channels list
- `src/pages/ComplaintsPage.tsx` (`/complaints`) — complaints channel + SEC escalation path
- `index.html` — SEO title/description, Open Graph tags, `FinancialService` JSON-LD carrying the
  SEC identity
- Landing page: `Security` link added to desktop and mobile nav; **fabricated star ratings removed
  from testimonials**

Verified: `tsc -b` clean, `eslint` clean (2 pre-existing unrelated warnings), `vite build` succeeds,
all routes render correctly in the dev server with no console errors.

### Completed 2026-07-28 — batch 2 (non-legal quick wins)

Legal-dependent work (Rates & Fees, OLP registration) deferred at the user's instruction; this
batch is everything valuable that needs no external answer.

**News platform** (explicitly requested — "makikita ang Easycash news"):

- `src/content/news.ts` — typed post model, category taxonomy (Announcements / Guides / Company
  News), sorting and lookup helpers, author template, and content rules
- `src/pages/NewsPage.tsx` (`/news`) — listing with category filter (rendered only when more than
  one category is in use) and an empty state
- `src/pages/NewsArticlePage.tsx` (`/news/:slug`) — post detail with an exhaustive block renderer;
  an unknown slug shows a "not found" state rather than silently redirecting
- Linked from the landing nav (desktop + mobile) and the site footer

**Performance:**

- Route-level code splitting via `React.lazy` + `Suspense`. The landing page stays eager (it is the
  entry point for nearly every visitor); everything else loads on demand. Initial bundle
  **463 kB → 361 kB** (140 kB → 116 kB gzip). This matters disproportionately here — much of the
  audience is on mobile data.

**Accessibility:**

- Skip-to-content link (WCAG 2.4.1)
- `:focus-visible` rings site-wide (WCAG 2.4.7)
- `prefers-reduced-motion` honoured — CSS rule *and* framer-motion `MotionConfig reducedMotion="user"`,
  since framer-motion animates via inline JS transforms that CSS cannot reach
- Proper `<main>` landmark in `PublicPageLayout`
- Per-page document titles (WCAG 2.4.2) via the new `src/lib/usePageMeta.ts` hook, which also sets
  per-page meta descriptions and restores the previous values on unmount

**SEO:**

- `public/robots.txt`, documenting that its `Disallow` rules only take effect once the site moves
  off HashRouter

Verified: `tsc -b` and `eslint` clean; `vite build` succeeds with 26 route chunks; dev-server DOM
assertions confirm per-page titles and descriptions, title restoration on navigation, the news
empty state, the not-found state, the `<main>` landmark, the skip link, and the footer disclosure;
mobile (375px) and dark mode render with no horizontal overflow.

### Completed 2026-07-28 — batch 3 (requirements, contact, resilience)

Still non-legal, still needs no external answer.

**Requirements checklist** (§3.2 — the "wasted 20 minutes on a form" problem):

- `src/lib/loanRequirements.ts` — extracted the document-slot logic (`DOCUMENT_SLOTS`,
  `DOCUMENT_LABELS`) that previously lived only inside `LoanApplicationFormPage.tsx`, plus the
  eligibility criteria already published on the landing page's own FAQ. **Single source of truth**:
  `LoanApplicationFormPage.tsx` now imports from here instead of defining its own copy, so the
  public requirements page and the actual form can never disagree.
- `src/pages/RequirementsPage.tsx` (`/requirements`) — eligibility criteria, and a per-product
  document checklist derived from the same `DOCUMENT_SLOTS` the form evaluates, verified against
  the dev server to match the form's logic exactly (e.g. Salary Loan correctly lists Employee ID +
  Payslip in addition to the universal Valid ID + Proof of Billing).
- Linked from the landing nav (desktop + mobile), the site footer, and a new "See requirements"
  link on every product card next to "Apply for this loan".
- Eligibility criteria are taken verbatim from Easycash's own existing FAQ copy — nothing new was
  invented. Anything beyond that (minimum income, max age, tenure) is explicitly flagged in the file
  as requiring written management confirmation before it can be added.

**Contact page** (`src/pages/ContactPage.tsx`, `/contact`):

- All values read from `companyInfo.ts`. Deliberately omits office hours, a contact form, branch
  addresses, and social links — none are confirmed, and publishing a wrong hours-of-operation is
  worse than omitting it (§7 questions 6, 8, 10).
- Carries the same "beware of impostors" framing as the anti-scam page, linking to it.

**Resilience** (`CLAUDE.md`'s Offline-Friendly Design section requires "clear offline indicators";
neither existed before this batch):

- `src/components/ErrorBoundary.tsx` — catches render-time errors app-wide and shows a recoverable
  screen with a reload button and contact info, instead of an uncaught error silently blanking the
  whole page. Wraps the app in `App.tsx`.
- `src/components/OfflineBanner.tsx` — a persistent banner driven by the browser's
  `online`/`offline` events, with a comment noting the known `navigator.onLine` caveat (detects
  "no network interface", not "internet unreachable").
- `src/pages/NotFoundPage.tsx` — replaces the previous silent `<Navigate to="/" replace />` catch-all
  route. A mistyped or dead link now says so plainly and offers real destinations, instead of
  dumping the visitor on the homepage with no explanation.

Verified: `tsc -b` and `eslint` clean; `vite build` succeeds (28 route chunks, initial bundle
366 kB / 117 kB gzip); dev-server checks confirmed the requirements page's per-product document
lists match the form's own logic exactly, the contact page renders all confirmed values, the 404
page renders with working suggested links, the offline banner appears/disappears correctly on
simulated `offline`/`online` events, and mobile (375px) dark mode renders with no horizontal
overflow. The error boundary was verified by code review (class component, correct
`getDerivedStateFromError`/`componentDidCatch` usage) rather than a forced render error, since
deliberately crashing the dev server tree is not a safe way to test in this environment.

### Completed 2026-07-28 — batch 4 (installability + a small authenticated-app improvement)

**Installability:**

- `public/site.webmanifest` (new) + `public/icon-192.png` / `icon-512.png` (new) — lets mobile
  visitors "Add to Home Screen" with the real Easycash icon and brand colour instead of a generic
  shortcut. The icons are **not a new design asset** — `logo-easycash.png` is a wide 500×200
  wordmark, so a square icon was generated by padding it onto a transparent square canvas and
  resizing, not by inventing new artwork.
- `index.html` — linked the manifest and an `apple-touch-icon`.
- This covers "installable" (strategy doc row 22/28). It does **not** add offline caching or a
  service worker — that remains open (row 28) and is a materially larger effort (cache strategy,
  update handling) that shouldn't be bundled into a quick-win batch.

**Authenticated app:**

- `src/pages/LoanProductsPage.tsx` (the logged-in "which loan should I apply for" browser) — added
  a "See requirements" link next to "Apply Now" on each product card, matching the pattern already
  on the public landing page. Low-risk, additive, reuses the same `/requirements` route.

**Explicitly flagged, not attempted this batch:** `DashboardPage.tsx` and `ProfilePage.tsx` show a
plain "Loading…" string rather than a skeleton, which falls short of `CLAUDE.md`'s "Loading
Skeletons" requirement. Not attempted here because it touches working authenticated-app layouts in
several places and needs a proper skeleton shape per section to look right — a real improvement,
but scoped as its own follow-up rather than folded into this batch's quick wins. Recorded as gap
row 23.

Verified: `tsc -b` and `eslint` clean; `vite build` succeeds and `dist/` contains
`site.webmanifest`, `icon-192.png`, `icon-512.png`; dev-server confirmed the manifest is linked,
fetches successfully, and its icon paths resolve; no console errors.

---

## 5. Phased roadmap

Each phase ends at an approval gate. **Do not start the next phase without sign-off** (`CLAUDE.md`,
Development Workflow).

### Phase 0 — Make it real (infrastructure)
*Nothing below matters until the site is publicly reachable.*

- Decide and document the hosting model. **The current GitHub Pages + HashRouter choice conflicts
  with the SEO and news goals.** Recommendation: move to a static host with rewrite support
  (Cloudflare Pages / Netlify) and switch to `BrowserRouter`; or, if the news/SEO goal is weighted
  heavily, evaluate a move to a metaframework with static/server rendering. **This is an
  architectural decision that needs its own ADR before any code changes.**
- Expose the backend publicly: HTTPS, real domain, hardened CORS, rate limiting on all public
  endpoints, WAF/Cloudflare in front. Ties into the hosting plan already recorded in memory
  (local self-host primary, Neon as backup).
- Confirm domain ownership; configure DNS, TLS, SPF/DKIM/DMARC for transactional mail.
- Remove the `PreviewBanner` (`App.tsx:95`) only once the API is genuinely live.
- Uptime monitoring + error tracking (self-hosted or free tier).

**Gate:** a stranger on mobile data can load the site and successfully create an account.

### Phase 1 — Legal & trust baseline
Footer disclosure block · Rates & Fees page · Security/anti-scam page · Complaints & escalation
page · Privacy Policy and Terms reviewed by counsel against RA 10173 and SEC MC 18-2019 ·
testimonials verified or removed.

**Gate:** counsel signs off that the public site is compliant as published.

### Phase 2 — Conversion engine
Pre-qualification check · engine-backed loan calculator (public endpoint + ADR) ·
per-product requirements checklists · product page overhaul · application funnel analytics.

**Gate:** measurable improvement in start→submit completion rate.

### Phase 3 — Borrower self-service ⭐
The flagship phase. New borrower-scoped portal endpoints + pages for balance, amortization
schedule, payment history, SOA download, payment channels, loan documents, payoff quote, renewal
eligibility. **Requires a dedicated ADR and a full security review** before implementation.

**Gate:** a real borrower can answer "how much do I owe and when is it due?" without calling.

### Phase 4 — News & content platform
MDX content pipeline · Announcements / Guides / Company News · author + date + category ·
RSS · sitemap · Open Graph cards · an editorial workflow document for staff.

**Gate:** a non-engineer can get a post published through a documented process.

### Phase 5 — Polish & scale
SEO structured data (`Organization`, `FinancialProduct`, `FAQPage`) · Core Web Vitals budget with
CI enforcement · WCAG 2.1 AA audit · real photography · Filipino localization · PWA · support chat.

---

## 6. Non-negotiable engineering constraints

These follow from `CLAUDE.md` and from what already exists. They apply to every phase.

1. **One calculation engine.** Any number shown to the public — calculator, rate table,
   representative example — comes from the same backend engine that runs real loans. No duplicated
   financial math in the frontend, ever.
2. **Immutable snapshots respected.** A borrower viewing an old loan sees the terms as approved,
   from that loan's snapshot — never today's product configuration.
3. **Portal identity stays separate** from staff identity (ADR-044). No public page may ever reach
   a staff-scoped endpoint.
4. **Every new public endpoint is unauthenticated-hostile by default**: rate limited, input
   validated with Zod, no PII in query strings, no internal IDs leaked, audit logged.
5. **Borrower data access is loan-scoped and ownership-checked** at the use-case layer, not the
   controller. Add integration tests that specifically attempt cross-borrower access and assert 403.
6. **Publish nothing marked UNKNOWN.** A missing CA number blocks launch; it does not get a
   placeholder.
7. **Documentation is part of the deliverable.** Each phase updates its ADR, this file, and the
   session log.

---

## 7. Open questions for management

Blocking answers, needed before Phase 1 can be designed:

1. ~~What is Easycash's **SEC Certificate of Authority number**?~~ **ANSWERED — CA No. 640**,
   confirmed from the legacy site 2026-07-28. Please still cross-check once against SEC records.
2. Is Easycash **registered as an Online Lending Platform** under SEC MC 10-2021? If not, does this
   portal trigger that requirement? (Likely yes — needs counsel.)
3. Which **domain** will be used, and who controls the registrar and DNS today?
4. Which **loan products are public**, and what are their **publishable** rates, fees, terms, and
   eligibility criteria? (Internal LMS has more products than the legacy site advertised.)
5. Which **payment channels** are official, and what are the exact borrower instructions per channel?
6. Which **branches** are public-facing, with addresses and hours?
7. Are the three existing **testimonials** documented and consented, or should they be removed?
8. Who **owns content publishing** (news/announcements) day to day?
9. What is the **support SLA** we are willing to publish for complaints?
10. Do we have a **brand guideline** (logo variants, palette, typography) beyond `logo-easycash.png`?

---

## 8. Related documents

- `docs/Architecture/ADR-044-separate-customer-identity-for-public-portal.md` — portal identity model
- `docs/Architecture/ADR-051-loan-document-generation.md` — loan documents for §3.3
- `docs/Architecture/ADR-052-statement-of-account-generation.md` — SOA for §3.3
- `docs/Architecture/ADR-053-bsp-1133-sec-mc3-compliance.md` — **rate caps; a launch dependency**
- `docs/Architecture/CALCULATION_ENGINE_SPEC.md` — the single source of financial truth
- `legacy/website/` — archived legacy site (HTML + `legacy-site-content-2026-07-24.txt` text dump),
  the source of the confirmed corporate facts in §2.3
- `app/portal/public/images/README.md` — the landing images still needed
