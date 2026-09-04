# Session Log: 2026-09-04 (Nomer Laptop) — Portal centering/animation fixes, high-end design mockup exploration

Continues `docs/session-logs/Nomer Laptop/SESSION_LOG_2026-09-03_migrated_loan_balance_penalty_resync_and_notification_planning.md`.

## 1. Synced two upstream pulls from the Office Server PC session

- `git pull` #1: fast-forwarded `d904290` -> `1f8e4deb` (Docker Desktop was found stopped again -
  same recurring gotcha as before, asked the user to start it, then continued). Brought in the
  event-driven notification redesign the user and I had scoped together the previous day but left
  paused ("huwag muna, balikan ko na lang") - implemented instead on the Office Server PC session:
  new `NotificationScanScheduler.ts` replacing `OverdueNotificationScheduler.ts`, new
  `NotificationType` enum values (migration `20260903024621_add_event_driven_notification_types`),
  hooks added directly in `AdjustLoanUseCase`/`CompromiseSettleLoanUseCase`/`ProcessPaymentUseCase`/
  `RestructureLoanUseCase`, a new `NotificationToaster.tsx` component, and a portal chat sound
  (`chatNotificationSound.ts`). Also brought in a second migration
  (`20260903052238_add_soa_accrued_interest_rate_override`) and a portal PWA
  install-ability feature (`vite-plugin-pwa`, `virtual:pwa-register` in `main.tsx`) that had
  apparently already shipped from an earlier Office Server PC commit
  (`deb19b09 feat: make the client Portal an installable PWA...`) - this laptop just hadn't run
  `npm install` for `portalfrontend` yet, surfaced as a `tsc` error until fixed.
  Applied both migrations, ran `npm install` for `portalfrontend`, typechecked all three apps
  clean, rebuilt `easycashbackend`/`lmsfrontend`/`portalfrontend`, confirmed healthy.
- `git pull` #2 (docs + one small fix): fast-forwarded to `ebe6951d` via merge (Office Server PC's
  own session-log addition, no conflict).

## 2. Ran the two migrated-loan resync scripts pulled in from Office Server PC (from the
   previous day's carry-over)

Not from this day's own work - noting only that the notification/PWA context above assumes
migrations were current; no new resync run happened today.

## 3. Diagnostic/education requests (no code changes)

Walked the user through: the notification bell's mechanics (15-min scheduler ->
now event-driven, explained before discovering it had already been rebuilt elsewhere), what the
"Disburse Loan" confirmation dialog shows (no manual date field - `activatedAt = new Date()` at
click time), a real data-quality bug found in the CIC Monthly Report Excel export (589 of 4,834
`addresses` rows have raw PSGC numeric codes sitting in `barangay`/`cityMunicipality`/`province`
instead of place names, traced to `backfill-mambu-customfield-addresses.ts` copying Mambu's coded
custom-field value verbatim - flagged, not fixed, needs a PSGC code->name lookup table that
doesn't exist in the system yet), and confirmed Mambu notes (20,292, `legacyId` prefixed/shaped
per `migrate-mambu-notes.ts`) and SDevTech notes (216, 24-char Mongo ObjectId `legacyId`) coexist
in `profile_notes` - gave the user `SML-PDC_X9X6S` (Delwin Ferrer) as a loan with both.

## 4. Portal landing page: centering bug fix, badge-offset bug, hover polish (committed)

User spotted the "Easy & convenient / Flexible terms / Safe & secure" feature cards left-aligned
instead of centered (they'd just been redesigned into bordered cards on the Office Server PC
session the day before) - centered the icon/text (`text-center` + `mx-auto`), commit `311c1b7c`.

Then user reported the "How it works" numbered badges (1/2/3) still visually off-center even after
the fix landed - found a real, non-obvious bug via direct DOM measurement (screenshots weren't
rendering reliably at scrolled positions in this session's preview tool all day, so verification
leaned on `getBoundingClientRect`/computed-style JS checks instead): framer-motion's `variants`
prop makes it own the element's entire `transform` once assigned, so `badgePop`'s `{ scale: 0/1 }`
variant was silently discarding the Tailwind `-translate-x-1/2` centering class - the badge center
was landing 22px (half its own width) right of the card center. Fixed by adding `x: '-50%'` to
both variant keyframes instead of relying on the CSS class, verified via measured center
coordinates matching to <0.02px. Also added hover micro-interactions (icon rotate/scale, a soft
blurred glow behind the "How it works" cards, border color tint) to both card sections per user
request - same commit `311c1b7c`, pushed.

## 5. Notification-system redesign: user asked Office Server PC to implement, gave it a full brief

User wanted this feature done on Office Server PC ("dahil ito yung main"). Wrote and handed the
user a self-contained brief (event list, recipients, the "Past Due isn't a stored status" gotcha,
Restructured=Rescheduled clarification, Closed's 4 sub-transitions, the dead
`markCurrent()` recovery path, existing `SendPortalChatMessageUseCase` hook point) to paste into
that session - confirmed later (§1 above) it was implemented there and pulled in here.

## 6. High-end design direction exploration (Artifact mockup, not application code)

User asked for a "high-end, advanced, sophisticated" design direction for the Portal. Built and
iterated a static HTML mockup as a Claude Artifact (not touched the app repo for this) at
`https://claude.ai/code/artifact/d89050ce-e1af-45c3-b883-fa0b5ba3e1b9` - glassmorphism cards,
gradient-mesh backgrounds, Fraunces display type paired with the Portal's existing Plus Jakarta
Sans. Went through several correction rounds against real user feedback and direct pixel-sampled
brand colors:
- First pass used an invented emerald+champagne-gold palette - user said "sundin ang easycash
  theme color... tignan ang easycash logo" - re-sampled the actual logo PNG pixel values via
  PowerShell `System.Drawing` (`#22316A` navy, `#7CC142` lime green) and rebuilt every gradient/
  accent around exactly those two, renaming CSS variables from `--emerald`/`--champagne` to
  `--brand-navy`/`--brand-green` for clarity.
- Found and fixed a real light-mode contrast bug in the mockup itself (an inverted `--ink` token -
  near-white text on a light background) and a UTF-8 mojibake bug (₱/→/· rendering as garbled
  bytes) by adding `<meta charset="utf-8">` - both caught by actually rendering the file (via a
  disposable local Node static server, since the Browser pane's screenshot tool was unreliable at
  scrolled positions most of this session) rather than trusting the code alone.
- User asked to stop following system/OS dark-mode and always render light - removed the
  `prefers-color-scheme`/`[data-theme="dark"]` blocks entirely, verified the page stays light even
  with the OS emulated to dark.
- Expanded the mockup from a hero-only teaser to the full real Portal page structure end-to-end
  (mission statement, products, eligibility+calculator widgets, how-it-works steps, features,
  ways-to-pay, testimonials, FAQ accordion, CTA, and the real regulatory-disclosure footer),
  copy pulled verbatim from `translations.ts`/`companyInfo.ts`/`SiteFooter.tsx` rather than invented.
- Centered several section headings that inherited a `flex-end` cross-axis alignment from the
  shared `.section-head` class when overridden to `flex-direction:column` (needed
  `align-items:center`, not just `text-align:center` - a genuine CSS gotcha, not just "add more
  centering"), and removed the interest-rate line from the product cards per user request.
- Added scroll-triggered fade-up reveals (IntersectionObserver + CSS transitions, staggered per
  card group) and hover polish across every card type, explicitly excluding the hero so the page's
  first paint is always fully visible without depending on JS/scroll (per this session's own
  design-system convention for Artifacts). Verified the CSS mechanics directly (manually toggling
  the `.in` class and reading computed opacity) since IntersectionObserver callbacks were not
  firing at all in this session's Browser-pane environment all day - isolated as a tooling
  limitation, not a code defect, since a hand-fired observer on the same element also produced no
  callback.
- Brainstormed ~20 alternative headline/subheadline copy options at the user's request (various
  angles: lending-directness, Taglish, social-proof, trust/tenure, urgency) after the user
  clarified "lending kami" (wanted copy that names lending directly rather than staying abstract
  "financial voyage" language) - user is still deciding, none picked yet.
- **This mockup lives only in the Artifact, not in the repo** - nothing here has been applied to
  `app/portalfrontend/src/pages/LandingPage.tsx`. If the user picks a direction, it still needs to
  be built into the real component (whichever machine/session picks this up next).

## Current state / follow-ups for next session (including Macbook Nomer, per user's plan)

- Laptop Nomer is caught up to `main` @ `ebe6951d`, all migrations applied, all three containers
  (`easycashbackend`/`lmsfrontend`/`portalfrontend`) rebuilt and healthy.
- User said they'll continue tomorrow on **Macbook Nomer** - that machine will need its own
  `git pull` to `ebe6951d`+ before picking this up; the Portal Concept Artifact
  (`https://claude.ai/code/artifact/d89050ce-e1af-45c3-b883-fa0b5ba3e1b9`) is account-level, not
  machine-specific, so it's reachable from any session once the user shares the link/asks for it.
- Outstanding decision: which headline/subheadline copy (of ~20 options) to commit to, and whether
  to proceed with implementing the glassmorphism/navy-green/Fraunces direction into the real
  `LandingPage.tsx` at all - explicitly not decided yet ("pag-isipan ko muna").
- The CIC Monthly Report address data-quality bug (589 rows with PSGC codes instead of place
  names, §3 above) is flagged but unresolved - needs a PSGC code->name lookup table before it can
  be fixed; not scheduled.
- Carried over, still unresolved as of this entry: Office Server PC's own Facebook Link backfill,
  3-client Drive document recovery, and 6 test-account removal (from 2026-08-28's log) - not
  re-checked this session.
