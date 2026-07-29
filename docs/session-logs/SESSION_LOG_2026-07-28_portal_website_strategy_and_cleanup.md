# Session Log — 2026-07-28 — Portal Website Strategy, Repo Cleanup, Phase 1 Build-out

**Goal (user, in Filipino):** analyze the whole Easycash project folder; plan an overhaul so the
Easycash Portal becomes the *official Easycash website* (news, loan applications, loan-account
tracking); aim for "one of the top 10 best lending websites in the Philippines"; produce an MD
file for the goal; and clean up / organise cluttered files in the project folder.

Follow-up instruction mid-session: *"gawin mo muna yung mga pinaka madali, mag patuloy ka lang sa
pag ayos at sa pag gawa hanggang sa matapos mo ang mga ito"* — proceed with the easiest items and
keep going until done.

---

## 1. Analysis performed

Read the repo structure, `app/portal` (all pages/components), the backend module list, the
`client-portal` backend module, `docs/Architecture/` (notably ADR-053), the archived legacy
website, and git status.

### Key findings

1. **The borrower self-service gap is the biggest product gap, and it is cheap to close.** The
   backend already has `loan-account`, `ledger`, `repayment`, `statement-of-account` (ADR-052) and
   `loan-document` (ADR-051) modules. None of it is exposed through the portal. The authenticated
   portal area today serves *applicants*, not *existing borrowers* — a client cannot see their
   balance, amortization schedule, payment history, or SOA. The hard part (the ledger) exists; only
   endpoints + pages are missing.

2. **ADR-053 is a launch dependency, not unrelated backlog.** ADR-053 records 43 real loan accounts
   covered by the BSP 1133 / SEC MC 3 rate caps, with the EIR cap, total-cost cap, and
   non-compounding penalty still unimplemented. A public site that advertises rates for those
   products becomes a disclosure surface for a rule the engine does not yet enforce. This linkage
   was not previously documented anywhere.

3. **HashRouter conflicts with the stated news/SEO goal.** `App.tsx:17-20` documents the
   deliberate HashRouter choice for GitHub Pages. It produces `/#/products` URLs, which are poor
   for search indexing and social sharing — directly at odds with "makikita ang Easycash news".
   Flagged as needing its own ADR; **not changed in this session.**

4. **The Certificate of Authority number was already known.** Initially logged as UNKNOWN, then
   found as `COA No. 640` hardcoded in the landing-page footer and confirmed twice in the archived
   legacy site. Corrected in the strategy doc.

5. **Testimonials are a liability.** The three landing-page testimonials are inherited legacy
   marketing copy, unattributed, with undocumented consent, and were rendered with numeric star
   ratings implying a verified review system that does not exist.

---

## 2. Repo cleanup & organisation (done)

| Action | Detail |
|---|---|
| `docs/` reorganised | 22 `SESSION_LOG_*.md` + `STATUS_REPORT_*.md` → `docs/session-logs/`; `DEVICE_SYNC`/`MACOS_SETUP`/`WINDOWS_SETUP` guides → `docs/guides/`; single-file `docs/docker-cleanup-logs/` folded into `session-logs/`. Used `git mv` so history is preserved. |
| `docs/README.md` created | Index of the docs folder + naming conventions for session logs and ADRs. |
| `scratch_legacy_text.txt` archived | Moved from repo root → `legacy/website/legacy-site-content-2026-07-24.txt`. **Not deleted** — it is a text dump of the old Easycash site and the source of every confirmed corporate fact. |
| Build-artifact leak fixed (root cause) | `app/portal/vite.config.js` and `vite.config.d.ts` kept reappearing because `tsconfig.node.json` is a `composite` project with no output redirect, so `tsc -b` emitted them into the project root. `noEmit` is rejected for referenced projects (TS6310), so `outDir`/`tsBuildInfoFile` now point at `node_modules/.tmp/tsconfig.node`. Artifacts deleted; verified `tsc -b` no longer emits to root. |

**Not done, deliberately:** root `.bat`/`.command`/`.sh` launcher scripts were left in place — the
user double-clicks these and docs may reference the paths. Offered as a follow-up.

**Flagged, not acted on:** `MIS Jomer Login.md` at the repo root contains a plaintext password. It
is gitignored (not committed) but sits unencrypted on disk. Recommended moving to a password
manager; left to the user's decision.

---

## 3. Strategy document (main deliverable)

Created **`docs/PORTAL_WEBSITE_STRATEGY.md`** — gap analysis + phased roadmap, grounded in the
actual repo rather than generic advice. Contents:

- Three audiences the site must serve at once (stranger / applicant / existing borrower), plus
  regulators — with existing-borrower support identified as unserved
- Current state, confirmed from the repo, including the blockers list
- Corporate facts table with explicit CONFIRMED / PARTIAL / ASSUMED / UNKNOWN labels per
  `CLAUDE.md`'s no-fabrication rule
- What separates a top-tier PH lending site, in five areas: regulation-grade cost transparency
  (RA 9474, RA 3765, SEC MC 18-2019, SEC MC 10-2021, BSP 1133/SEC MC 3, RA 10173), eligibility
  clarity before the form, real borrower self-service, trust architecture, and content/SEO
- 20-row gap analysis with priorities
- Phases 0–5, each with an approval gate
- Non-negotiable engineering constraints (one calculation engine; immutable snapshots; portal
  identity separation; hostile-by-default public endpoints; ownership-checked borrower data)
- 10 blocking questions for management

---

## 4. Implementation — Phase 1 partial (done)

Scoped to what needed **no** answer from management, since every value used was already confirmed.

| File | Purpose |
|---|---|
| `src/lib/companyInfo.ts` *(new)* | Single source of truth for legal disclosure values (legal name, SEC Reg. No. CS201001882, CA No. 640, registered address, official contact channels). Documents provenance and the rule that these are legal disclosures, not copy. |
| `src/components/SiteFooter.tsx` *(new)* | Regulatory footer reading from `companyInfo`. Replaces the version hardcoded in `LandingPage.tsx`. |
| `src/components/PublicPageLayout.tsx` *(new)* | Shell guaranteeing the footer renders on every standalone public page — a visitor can deep-link to any route, so the disclosure cannot live only on the landing page. |
| `src/pages/SecurityTipsPage.tsx` *(new, `/security-tips`)* | Anti-scam guide: what Easycash will never do (advance fees, OTP requests, personal-account payments, contact harvesting, harassment), the definitive official-channels list, and self-protection tips. |
| `src/pages/ComplaintsPage.tsx` *(new, `/complaints`)* | Complaints channel, what to include, DPO route for privacy matters, and SEC escalation path. Restores a page the legacy site had. |
| `src/pages/PrivacyPolicyPage.tsx`, `TermsPage.tsx` | Retrofitted onto `PublicPageLayout` — they now carry the regulatory footer. Removed their duplicated shells. |
| `src/App.tsx` | Wired the two new public routes. |
| `index.html` | SEO title/description rewritten, `theme-color`, Open Graph tags, and `FinancialService` JSON-LD carrying the SEC identity. `og:url` deliberately omitted until the production domain is confirmed. |
| `src/pages/LandingPage.tsx` | Footer replaced with `<SiteFooter />`; `Security` link added to desktop + mobile nav; **fabricated star ratings removed** from testimonials (replaced with a neutral quote icon), with a comment recording the pending business decision on attribution. |

### Bugs found and fixed during verification

- Anti-scam page copy said channels were "listed below" when the section renders above → corrected
  to "above".
- Footer rendered `Easycash Lending Company, Inc.. All rights reserved.` (double period, since
  `legalName` already ends in `Inc.`) → extra period removed, comment added.

### Verification

`tsc -b` clean · `eslint` clean (2 pre-existing warnings in `PortalAddressPicker.tsx` and
`authContext.tsx`, unrelated) · `vite build` succeeds (463 kB JS / 140 kB gzip) · dev server on
port 5199: `/`, `/security-tips`, `/complaints` all render, no console errors, DOM assertions
confirmed nav link, SEC footer text, zero star SVGs, and correct copyright string.

---

## 4b. Implementation — batch 2 (done)

User instruction: *"registered at legit ang easycash, skip muna natin ang mga may kinalaman sa
legal, gawin mo ulit ang pinakamadali"* — Easycash is registered and legitimate; defer legal work;
do the easiest items again and keep going.

Legal-dependent items (Rates & Fees page, SEC MC 10-2021 OLP question) deferred accordingly. This
batch is everything else of value that needs no external answer.

### News platform — the explicitly requested feature

| File | Purpose |
|---|---|
| `src/content/news.ts` *(new)* | Typed post model + category taxonomy (Announcements / Guides / Company News), sort/lookup helpers, `formatPostDate`, author template, content rules. |
| `src/pages/NewsPage.tsx` *(new, `/news`)* | Listing with category filter (only rendered when >1 category is in use, so the filter can never produce an empty result) and an empty state. |
| `src/pages/NewsArticlePage.tsx` *(new, `/news/:slug`)* | Post detail. `Block` renderer is exhaustive over the `NewsBlock` union, so adding a block type without handling it is a compile error, not a blank section. Unknown slug → "not found" state, not a silent redirect. |

**Design decision — structured TypeScript blocks, not MDX.** The strategy doc originally
recommended MDX. Implementing it needs a Vite plugin plus a markdown renderer, and `CLAUDE.md` says
to avoid unnecessary dependencies. Hand-rolling a markdown parser was rejected as exactly the kind
of cleverness that turns into subtle bugs. Typed blocks keep the git-review benefit, add type
safety, and cost zero dependencies. The MDX/CMS upgrade path is documented in both the content file
and the strategy doc. Reversible if the trade-off stops paying.

**`NEWS_POSTS` ships empty, deliberately.** Writing sample Easycash announcements would be
fabricating company news on a lender's public site. The page renders a proper empty state and the
file carries a copy-paste template. One author rule is called out explicitly: never state rates,
fees, or loan terms in a post — a stale rate in a blog post is a mis-disclosure.

### Performance

Route-level code splitting (`React.lazy` + `Suspense`, with a `RouteFallback`). LandingPage stays
eagerly imported — it is the entry point for nearly every visitor, so lazy-loading it would only
add a round-trip before first paint. **Initial bundle 463 kB → 361 kB (140 kB → 116 kB gzip)**,
26 route chunks. The remaining main chunk is React + router + framer-motion.

### Accessibility

- Skip-to-content link (WCAG 2.4.1 Bypass Blocks)
- `:focus-visible` rings site-wide (WCAG 2.4.7) — `:focus-visible` not `:focus`, so mouse clicks
  don't leave rings
- `prefers-reduced-motion`: CSS rule in `index.css` **and** framer-motion
  `<MotionConfig reducedMotion="user">`. The CSS alone is insufficient — framer-motion animates via
  inline JS transforms that a CSS media query cannot reach. This was caught during implementation.
- `<main>` landmark in `PublicPageLayout`
- Per-page document titles + meta descriptions via `src/lib/usePageMeta.ts` (WCAG 2.4.2)

### SEO

`public/robots.txt`, with an honest comment that its `Disallow` rules are inert until the site
moves off HashRouter (crawlers never receive hash fragments).

### Bugs found and fixed during batch 2

- **Wrapped routes in `<main>` at the App level** — this put the landing page's sticky `<header>`
  nav *inside* `<main>`, which is invalid landmark structure. Changed to a plain
  `div#main-content` with `tabIndex={-1}`; page-level components own their own landmarks.
- **CSS-only reduced-motion was ineffective** against framer-motion (see above); added
  `MotionConfig`.

### Verification

`tsc -b` clean · `eslint` clean (same 2 pre-existing warnings) · `vite build` succeeds. Dev-server
DOM assertions confirmed: per-page title (`News & Announcements | Easycash`) and meta description,
title correctly *restored* to the index.html default on navigating back to landing, news empty
state, not-found state, `<main>` landmark, skip link, footer disclosure, and nav links. Mobile
(375px) and dark mode render with no horizontal overflow. Stale HMR errors in the console buffer
were from mid-edit states; a clean production build and a full DOM render confirmed they were not
live errors.

---

## 4c. Implementation — batch 3 (done)

User instruction (new session, model switched to Sonnet 5): *"mag patuloy ka lang sa pag ayos at
pag gawa hanggang sa matapos ang easycash portal website"* — continue fixing and building until
the Easycash Portal website is finished.

Continued the same non-legal-only constraint from batch 2. This batch: a public Requirements page,
a Contact page, and three resilience pieces `CLAUDE.md` requires but the portal didn't have yet.

### Requirements checklist — closes strategy doc §3.2

| File | Purpose |
|---|---|
| `src/lib/loanRequirements.ts` *(new)* | Extracted `DOCUMENT_SLOTS`/`DOCUMENT_LABELS` out of `LoanApplicationFormPage.tsx` (they were private consts inline in that file) plus the eligibility criteria already published on the landing page's FAQ. `getDocumentsForProduct()` returns the per-product checklist by evaluating the same `showWhen` logic the form itself uses. |
| `src/pages/LoanApplicationFormPage.tsx` | Now imports `DOCUMENT_LABELS`/`DOCUMENT_SLOTS` from the new module instead of defining its own copy — this is the point of the extraction: the public page and the real form read one definition and cannot drift apart. |
| `src/pages/RequirementsPage.tsx` *(new, `/requirements`)* | Public checklist per product. Verified against the dev server that, e.g., Salary Loan lists Employee ID + Payslip in addition to the universal Valid ID + Proof of Billing — matching `LoanApplicationFormPage.tsx`'s own slot logic exactly. |
| Landing page, footer | "Requirements" added to desktop + mobile nav, the footer, and a new "See requirements" link beside "Apply for this loan" on every product card. |

Eligibility criteria are copied verbatim from Easycash's own existing FAQ — nothing invented. The
file explicitly flags that anything beyond that (minimum income, max age, tenure) needs written
management confirmation before it can be added — this is the same no-fabrication discipline as
batch 1's `companyInfo.ts`.

### Contact page

`src/pages/ContactPage.tsx` (`/contact`) — reads only from `companyInfo.ts`. Deliberately does not
show office hours, a contact form, branch addresses, or social links, since none of those are
confirmed (§7 questions 6, 8, 10) and a wrong office-hours claim is worse than none. Shares the
"beware of impostors" framing with the security-tips page and links to it.

### Resilience — required by `CLAUDE.md`, previously missing entirely

`CLAUDE.md`'s Offline-Friendly Design section explicitly requires "clear offline indicators"; there
was no offline handling and no error boundary anywhere in the portal before this batch.

- `src/components/ErrorBoundary.tsx` *(new)* — class component (React has no hook equivalent of
  `componentDidCatch`) wrapping the whole app in `App.tsx`. Without it, any uncaught render error
  unmounts the entire tree and the visitor gets a blank white page — on a lending site that reads as
  "this company is broken" or "this is a fake site". Shows a reload button and Easycash's real
  contact info instead.
- `src/components/OfflineBanner.tsx` *(new)* — listens to `window`'s `online`/`offline` events.
  Comment documents the known caveat that `navigator.onLine` detects "no network interface" rather
  than genuine internet reachability; real request failures are still handled by each page's own
  error UI, this banner is the cheap immediate signal.
- `src/pages/NotFoundPage.tsx` *(new)* — replaces the previous `<Route path="*" element={<Navigate to="/" replace />} />`.
  A silent redirect home on any unmatched URL hides broken links and leaves the visitor guessing
  whether they mistyped. Now shows a plain message plus a list of real destinations.

### Verification

`tsc -b` and `eslint` clean (same 2 pre-existing warnings). `vite build` succeeds — 28 route chunks,
initial bundle 366 kB / 117 kB gzip (previous batch: 361 kB/116 kB; the added pages are code-split
so this barely moved the shared chunk). Dev-server checks: Requirements page's per-product document
lists confirmed to match the form's own `DOCUMENT_SLOTS` logic; Contact page renders all confirmed
values; 404 page renders with working suggested links; offline banner appears on a simulated
`offline` event and disappears on `online`; footer/nav link set confirmed complete
(`#/requirements`, `#/news`, `#/security-tips`, `#/contact`, `#/complaints`, `#/privacy-policy`,
`#/terms`, `#/login`, `#/signup`); mobile (375px) dark mode has no horizontal overflow; no console
errors. `ErrorBoundary` was verified by code review (correct `getDerivedStateFromError`/
`componentDidCatch` shape) rather than a forced crash, since deliberately breaking the dev server's
render tree isn't a safe way to test in this environment.

---

## 4d. Implementation — batch 4 (done)

Same "continue until the portal website is finished" instruction, in a fresh session (Sonnet 5
after a `/model` switch). Also answered two unrelated questions about `.claude/launch.json` preview
configs mid-session: renamed `frontend-preview` → `lms-preview` (confirmed `app/frontend` is the
internal staff-facing LMS, package name `easycash-frontend`) and updated the one live doc reference
in `docs/guides/MACOS_SETUP_GUIDE.md`; left `PROJECT_HANDOFF.md` and session-log quotes of the old
name alone since those quote historical commit messages, not live config.

**Installability:** `public/site.webmanifest` + generated `icon-192.png`/`icon-512.png` (padded the
existing 500×200 `logo-easycash.png` onto a transparent square canvas via PIL, not a new design),
linked from `index.html` with an `apple-touch-icon` tag. Lets mobile visitors add a proper Easycash
icon to their home screen. Does not add offline caching/a service worker — kept out of scope, and
logged separately (gap row 28) as materially bigger than a quick win.

**LoanProductsPage.tsx** (the logged-in product browser) — added the same "See requirements" link
already on the public landing page, pointing at `/requirements`.

**Explicitly not attempted:** DashboardPage/ProfilePage's plain "Loading…" text falls short of
`CLAUDE.md`'s loading-skeleton requirement, but fixing it means building a correctly-shaped skeleton
per section across working authenticated screens — judged too large and too risky to fold into a
quick-win batch. Logged as gap row 23 for a dedicated follow-up.

### Verification

`tsc -b` and `eslint` clean. `vite build` succeeds; `dist/` confirmed to contain
`site.webmanifest`, `icon-192.png`, `icon-512.png`. Dev-server confirmed the manifest link resolves,
`fetch('/site.webmanifest')` returns valid JSON with the right icon paths, and no console errors.

---

## 5. Current state & follow-up work

**Working:** portal builds and runs; all public pages carry the regulatory disclosure; trust pages
(security, complaints), the news platform, a requirements checklist, a contact page, baseline
resilience (error boundary, offline banner, real 404), and home-screen installability are all live;
SEO metadata and per-page titles in place; routes code-split.

**Reached the natural end of the "easy, no legal, no new business input needed" queue.** Everything
remaining requires one of: legal/regulatory input (Rates & Fees, OLP registration), a dedicated ADR
+ security review (borrower self-service — first time real ledger data would leave the internal
network), an infrastructure decision that isn't code (hosting/domain), real assets from the business
(landing photography, testimonial consent), or a properly-scoped UI effort of its own (loading
skeletons, bilingual support). Per `CLAUDE.md`'s workflow ("wait for approval" between milestones,
no auto-proceeding to the next major milestone), these are flagged rather than started blind.

**Waiting on the business, not on engineering:** the news platform is built but has no posts. The
first real announcement can be added by copying the template in `src/content/news.ts` — no
developer needed beyond a commit.

**Still blocked on infrastructure (Phase 0):** the site cannot go live — the backend is not
publicly reachable, so `App.tsx`'s `PreviewBanner` still shows and sign-up/login are dead in a
deployed build. No domain confirmed. GitHub Pages deploy unfinished.

**Next, in recommended order:**

1. **Phase 0** — hosting decision (needs an ADR: HashRouter/GitHub Pages vs. a host with rewrite
   support), public HTTPS backend, domain, DNS/TLS.
2. **Rates & Fees page** — blocked on management answering which products are public and what
   their publishable rates/fees are (§7 Q4), and coupled to ADR-053 Phases 3–5.
3. **Phase 3 borrower self-service** — the flagship. Needs a dedicated ADR and a security review
   before implementation; first time real ledger data leaves the internal network.

**Open decisions for the user:** testimonial attribution; whether to move root launcher scripts
into `scripts/`; the plaintext-password file; and the 10 questions in
`docs/PORTAL_WEBSITE_STRATEGY.md` §7.
