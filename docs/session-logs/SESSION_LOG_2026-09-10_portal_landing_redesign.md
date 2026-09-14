# Session Log — 2026-09-10: Portal landing page visual redesign

## Context

User requested a "world-class CSS/UX" pass on `app/portalfrontend` (the public Easycash Client
Portal), following a long master-prompt brief covering token consolidation, imagery, responsive
design, and accessibility.

Before touching code, an audit (via the Explore subagent) established that the landing page
(`src/pages/LandingPage.tsx` + `src/pages/landingMockupClone.css`) was **not** a generic
unfinished template — it's a near-verbatim port of a mockup explicitly approved 2026-09-05, with
several dated, business-approved decisions already baked in (testimonial star ratings removed
because they implied a review system that doesn't exist; a curated, confirmed payment-methods
list; a real interactive loan calculator, etc.). This was flagged to the user before proceeding.
User chose: do a full visual redesign of the landing page (not just a token-cleanup pass), keep
the navy/lime brand palette, don't touch business-sensitive content (testimonials, disclaimers,
stats, curated lists), and build image slots as placeholders since no real photo assets exist yet
(confirmed via `public/images/README.md`, which documents expected filenames but no files were
present).

## What was done, in order

1. **Audit** (Explore subagent) of framework, CSS architecture, routes, components, assets, forms,
   responsiveness, and accessibility. Found: Vite + React 18 + TS + Tailwind 3, hand-rolled
   shadcn-style primitives, two parallel CSS/token systems (shared HSL tokens in `index.css` vs.
   `landingMockupClone.css`'s own hex vars), only one CSS breakpoint (`860px`) on the flagship
   landing page, no real photography, sparse `alt=`/`aria-*` coverage, and a stale PWA manifest
   `theme_color` (`#186d4e`, pre-rebrand emerald).
2. Fixed `public/site.webmanifest` `theme_color` → `#22316a` (current navy brand color).
3. Consolidated `landingMockupClone.css`'s `--brand-navy` to source from the shared `--primary`
   token (`hsl(var(--primary))`) instead of a duplicate hex value.
4. Added semantic status tokens (`--success-ink/bg/border`, `--warning-ink/bg/border`) derived from
   the shared `--success`/`--warning` HSL tokens, and an elevation scale (`--shadow-sm/md/lg`).
5. Replaced raw hex colors in `EligibilityCheckWidget.tsx`'s pass/fail result banner
   (`#4caf50`, `#b45309`, `#2e7d32`, `#92400e`) with the new semantic tokens.
6. Added a proper responsive breakpoint ladder to `landingMockupClone.css`: previously the page
   jumped straight from a 3-column desktop grid to a single mobile column at `860px`. Added a
   `1024px` tablet tier (2-column product/feature/testimonial grids, 2-column steps grid) and
   tightened the `640px` mobile tier (44px minimum touch targets on buttons/FAQ toggles, reduced
   section padding).
7. Wired up the existing (already-built, previously unused-here) `ImageWithFallback` component for
   imagery, using the exact filenames `public/images/README.md` already documented:
   - A hero background photo layer (`hero-seafarer.jpg`) behind the ambient mesh gradient, masked
     to fade into the page background — visible once the file exists, currently shows the existing
     branded gradient/texture fallback.
   - Product card images (`product-business.jpg`, `product-salary.jpg`, `product-seafarer.jpg`),
     mapped 1:1 by array index to `LOAN_PRODUCTS`' existing order (Business/Salary/Seafarer).
   - A small role-icon avatar circle on each testimonial card (not a fake photo — a generic
     `User` icon in a brand-gradient circle) for better visual attribution.
8. Verified build (`npm run build` — clean), lint (`npm run lint` — 3 pre-existing errors/4
   warnings, none in files touched this session), and Docker rebuild
   (`docker compose up -d --build portalfrontend` from `app/docker`) — container came back healthy.

## Bug found and fixed during this session

**Self-referential CSS custom property.** Step 3/4 above initially set
`--brand-green: hsl(var(--brand-green))` inside `.landing-mockup`. Because the shared token in
`index.css`/`tailwind.config.ts` is *also* named `--brand-green`, and this redeclaration happens on
a descendant of `:root`, this is a cyclic self-reference — CSS spec makes it a guaranteed-invalid
value, silently breaking every element on the landing page that reads `var(--brand-green)`
(buttons, product-card glows, step badges, etc. all use it in gradients). Fixed by keeping
`--brand-green` as a literal hex (`#7cc142`) locally, with a comment explaining why (documented
numeric equivalence to the shared token, not duplicated source of truth) — `--brand-navy` was safe
to alias since it references a *differently-named* token (`--primary`), so no cycle there. Verified
the fix via `getComputedStyle` in the browser: `--brand-green` now resolves to `#7cc142` and the
CTA gradient renders correctly (navy → lime).

## Known limitation surfaced (not fixed — pre-existing, out of scope)

The portal's nginx config (`app/portalfrontend`'s runtime container) uses
`try_files $uri $uri/ /index.html;` for SPA routing, which means a request for a **missing** image
(e.g. `/images/product-business.jpg` before a real file is dropped in) returns `200 OK` with
`index.html`'s HTML body, not a `404`. In this session's testing browser, the resulting `<img>`
element's `error` event did not appear to fire even after the image scrolled into view (`complete`
stayed `false`, `naturalWidth` stayed `0`) — it neither displayed nor visibly fell back to
`ImageWithFallback`'s gradient placeholder within the test window. `ImageWithFallback` is an
existing, previously-shipped component (not written this session) already used elsewhere in the
codebase for this exact "photo may not exist yet" scenario, so this may be specific to the
sandboxed test browser used this session rather than real browsers — but it's worth a manual check
in an actual browser once real photo files are added, to confirm the fallback (or lack of a
stuck/broken image icon) behaves as expected before shipping.

## Verification tooling caveat

The Browser-pane screenshot tool used for visual verification this session returned a blank white
frame whenever the page was scrolled away from the very top (reproduced on the unrelated
`/requirements` route too, which uses none of this session's CSS) — confirmed via `get_page_text`,
`getComputedStyle`, and `getBoundingClientRect` that the actual DOM/CSSOM state was correct and
visible at every scroll position tested; this is a pane-level screenshot/compositor artifact, not
an application bug. Verification below the fold relied on DOM/computed-style inspection instead of
screenshots for this reason.

## Current state

- Landing page (`/`) redesigned: unified color-token sourcing, 3-tier responsive grid (desktop/
  tablet/mobile), hero background photo slot, product-card photo slots, testimonial avatar icons,
  semantic status colors in the eligibility-check widget, 44px minimum mobile touch targets.
- All existing business content, copy, links, disclaimers, testimonials, and the interactive loan
  calculator / eligibility-check widget are unchanged — this was a visual/CSS pass, not a content
  or business-logic change.
- No real photo assets exist yet; hero and product cards currently render the pre-existing branded
  gradient/dot-pattern placeholder via `ImageWithFallback`. Dropping the four files documented in
  `public/images/README.md` into that folder (exact filenames already wired in `LandingPage.tsx`)
  is the only remaining step to light up real photography.
- Build, typecheck, and Docker rebuild all verified clean; lint has 3 pre-existing errors in files
  untouched this session (`PortalAddressPicker.tsx`, `PortalChatWidget.tsx` — a missing
  `react-hooks/exhaustive-deps` rule definition, unrelated to this work).

## Follow-up work (not done in the original CSS-token pass above — deferred per incremental-scope agreement)

- Auth pages (Login, SignUp, ForgotPassword, ResetPassword) and legal pages (Privacy, Terms,
  Security Tips, NotFound) still have zero responsive Tailwind classes — flagged in the initial
  audit as milestone 4, not started.
- Dashboard (loan/payment cards, tables) visual hierarchy pass — milestone 5, not started.
- React Hook Form + Zod are installed as dependencies but unused anywhere in the codebase (all
  forms use manual `useState` + inline validation) — noted in the audit, not addressed (out of
  scope for a CSS/UX pass; would be a form-layer refactor).
- Confirm real-browser behavior of `ImageWithFallback` against the SPA-fallback-returns-200 quirk
  described above once real photo files are available to test against.

---

## Addendum — same day, later: full art-direction rebuild (not incremental)

Later the same day, the user escalated twice: first asking for real terminology fixes
("financing" → "lending" language, missed in the pass above) and real photography (sourced 4 HD
Unsplash photos into `public/images/`, since none existed yet), then — after seeing the polished-
but-structurally-unchanged result — explicitly asked for a **full art-direction rebuild**, not a
CSS/token pass: reimagine the composition itself (hero, product cards, calculator, information
architecture), while keeping the brand palette, Fraunces/Plus Jakarta Sans, and all real business
content and functionality.

### What changed

1. **`landingMockupClone.css` rewritten from scratch** (previously ~1300 lines of mockup-clone CSS,
   now a real token-driven design system): typography scale (`--t-display` through `--t-label`,
   fluid via `clamp()`), spacing scale (`--s1`–`--s12`, viewport-responsive `--section`/`--gutter`),
   radius/elevation/motion tokens, and entirely new component classes (`.hero__*`, `.stage`/`.chip`
   for the hero's photo+floating-UI composition, `.prow` for editorial product rows, `.calc` for the
   immersive navy calculator section, `.flow` for the transparency breakdown, `.reason`/`.pay`/
   `.voice` replacing the old icon-card-grid pattern). The old `.product-card`/`.feature-card`/
   `.testi-card`/`.way-card`/`.glass-card` grid classes are gone; `.widget-card`/`.widget-head`/
   `.q-row`/`.yn`/`.icon-sq` were deliberately kept identical since `EligibilityCheckWidget.tsx`
   depends on that exact class contract and was not touched.
2. **`LandingPage.tsx` restructured** to match: hero is now a photo+floating-data-chip composition
   (not a text-block-beside-a-card), the interactive calculator moved out of the hero and into its
   own full-width dark-navy section (added a second slider for loan *term*, 1–24 months, matching
   `LoanCalculatorWidget`'s own bounds — previously only amount was adjustable here), loan products
   became alternating full-bleed editorial rows instead of a 3-card grid, the "features" list
   became a numbered editorial list (no icon squares), testimonials became one large pull-quote
   plus two smaller stacked ones instead of 3 equal cards, and a new "transparency flow" section
   (Loan amount → Interest → Monthly repayment → Total repayment) was added, computed live from the
   calculator's own state — no invented fees or numbers.
3. Kept exactly as before: `LandingFooter`, `MobileApplyBar`, `NewsFlashTicker`, `LanguageToggle`,
   `EligibilityCheckWidget`, all `t.landing.*`/`t.eligibilityCheck.*` translation content, testimonial
   quotes verbatim, `LOAN_PRODUCTS` data (this pass is the first to actually surface each product's
   `.details` field on the landing page, previously unused there), and the real
   `estimateMonthlyPayment`/`estimateTotalRepayment` flat-rate formula (see `loanEstimator.ts`) for
   every number shown — no fabricated rates, limits, or statistics.
4. Added a scroll-aware nav (`useScrollStuck` hook): transparent over the hero, gains a blurred
   surface once scrolled, per the brief's navigation requirement.

### Bugs found and fixed this pass

- **Typo**: `--lime-600: #5c9c２b` accidentally used a full-width Unicode "２" instead of ASCII "2"
  while hand-writing the token block — caught before it shipped by grepping for the token's only
  usage (none) and fixing the literal value directly.
- **Leftover tautology**: the "why borrow with us" heading was momentarily written as
  `{t.landing.howItWorksTitle === t.landing.howItWorksTitle ? '...' : ''}` (an always-true ternary
  left over from restructuring) — replaced with the literal string.
- **Slider + scroll-wheel interaction**: discovered while testing — scrolling the page with the
  mouse positioned over a focused `<input type="range">` changes its value in this browser instead
  of scrolling the page (standard browser behavior, not React-specific). Fixed by blurring the
  input on `onWheel` for both the amount and term sliders, so scrolling past the calculator can
  never silently change the numbers a visitor was looking at.

### Verification

- `tsc --noEmit`, `npm run build`, `npm run lint` all clean (same 3 pre-existing lint errors in
  `PortalAddressPicker.tsx`/`PortalChatWidget.tsx` as the original pass — untouched, unrelated).
- Docker rebuilt twice (once after the wheel-guard fix) — container healthy both times.
- Verified live in-browser at both desktop and mobile (375px) viewport presets: hero photo +
  floating chips render correctly, headline/typography scale confirmed, product rows alternate
  image side correctly, calculator sliders update the monthly figure/split bar/repayment-schedule
  ticks/transparency-flow numbers all in sync from one state change (confirmed via direct DOM
  inspection after dispatching an `input` event, since this session's screenshot tool has the same
  compositor quirk documented in the original pass above — reproduced again here as tiled/duplicated
  content in a scrolled screenshot that `getBoundingClientRect`/`naturalWidth` checks proved was not
  real DOM state).
- Mobile hero specifically confirmed as a deliberate recomposition (photo leads, chips stack at the
  top, headline follows below) rather than a collapsed desktop layout, per the brief's explicit
  requirement.

### Known limitation / not done this pass

- This rebuild covers the **homepage only**. The brief's dashboard/application-form/auth-page
  redesign is flagged as a comparably large follow-on phase, not started.
- The product mega-menu and mobile drawer were restyled to the new token system but not otherwise
  redesigned structurally.

---

## Addendum 2 — same day, third pass: 12-month cap, calculator reorder, consent gate

A third request the same day asked for: Filipino-specific photography, a hard 12-month installment
cap, moving the calculator before loan options, and a first-visit Data Privacy/Terms consent gate -
while keeping this pass's CSS system (refinement only, explicitly "do not overdesign").

### What changed

1. **12-month installment cap** - `TERM_MAX` lowered from 24 to 12 in both
   `LoanCalculatorWidget.tsx` and `LandingPage.tsx`'s own calculator section (user-confirmed real
   business rule: Easycash does not offer longer terms). Scoped deliberately to the two
   marketing/estimator calculators only - `LoanApplicationFormPage.tsx`'s `requestedTermMonths`
   field was left untouched: it's an open-ended numeric "preferred term" input with no existing
   cap at all (not a picker), tied to a real application review process where staff can adjust it,
   and the backend's `interest_rate_chart` term data is table-driven (not visible in code) - capping
   real application intake without confirming the backend can't/shouldn't accept a longer requested
   term for some product would risk silently blocking real submissions. Flagged to the user rather
   than guessed at.
2. **Calculator moved before loan products** on the homepage - straightforward JSX reorder in
   `LandingPage.tsx` (`section calc` now precedes `section products` in document order, confirmed
   via DOM inspection since the browser pane's screenshot tool still has the scroll-compositor quirk
   documented above).
3. **New `ConsentGate.tsx` component** - a branded, non-dismissible first-visit gate (Fraunces
   headline, brand icon, real Privacy/Terms content, a single required opt-in checkbox, disabled
   "Accept & Continue" until checked), mounted at the `App.tsx` root above every route. Persisted via
   `localStorage` (`easycash_portal_consent_accepted_v1`) - the right mechanism here since this gate
   targets anonymous pre-signup visitors who have no account/session yet.
   - **Content honesty note (flagged to user):** the only real "Privacy"/"Terms" content in this
     codebase (`PrivacyContent`/`TermsContent`, reused as-is - not fabricated) is the actual CIC/Data
     Privacy Act loan-application consent form, not a general website browsing/cookie notice. Reused
     it rather than inventing lighter copy (per CLAUDE.md: never fabricate legal content), but this
     is a content-fit question the business/legal owner should confirm - the gate's own framing
     paragraph is careful UI copy, not a legal claim, but the linked documents underneath describe
     loan-processing consent specifically.
   - No optional/marketing consent toggle exists to separate out (none in the real content), and the
     checkbox defaults unchecked (opt-in) - satisfies the anti-dark-pattern requirements without
     needing an explicit "decline and browse anyway" path that doesn't exist elsewhere in this app's
     real consent architecture.

### Bug found and fixed this pass

- **Z-index stacking**: the gate's "Read Privacy Notice"/"Read Terms & Conditions" buttons initially
  reused the shared `Dialog` component (hardcoded `z-50`) - it opened but rendered invisibly BEHIND
  the gate's own `z-[100]` overlay. Fixed by adding a small local `ReadPanel` in `ConsentGate.tsx`
  (same Escape/backdrop/X-to-close behavior as `Dialog`, just with its own `z-[110]`) instead of
  reusing `Dialog` for this specific case.

### Filipino photography - investigated, not changed

Searched Unsplash with several targeted terms ("filipino seafarer", "asian ship officer portrait",
"philippines sailor uniform", "merchant navy officer smiling", "filipino businessman"). Findings:
seafarer/maritime-specific searches returned almost entirely scenic Philippines travel photography
or unrelated content (one returned Philippine marching-band photos), not portraits of maritime
professionals; a few paid Unsplash+ results were watermarked (explicitly disallowed by the brief).
The existing four photos (from the first redesign pass) were kept rather than swapped for
equally-unverifiable alternatives - a stock photo's country of origin/ethnicity cannot actually be
confirmed from the image itself, and swapping to a "maybe-more-plausible" photo without being able
to verify it would be no more honest than what's already live. Flagged to the user: guaranteeing
authentic Filipino representation requires either a licensed stock library with verified
Philippines-based photographers/subjects, or commissioning real photography of actual (consenting)
Filipino staff/clients - not something resolvable by searching a free general stock library further.

### Verification

- `tsc --noEmit`, `npm run build`, `npm run lint` all clean (same 3 pre-existing lint errors,
  untouched files). No `test`/`verify` script exists in this package - confirmed via `package.json`
  before skipping them (section 27 of the brief: "use only commands that actually exist").
  Docker rebuilt twice (once after the z-index fix) - container healthy both times.
- Verified live: consent gate blocks the page on first visit, "Accept & Continue" stays disabled
  until the checkbox is checked, Privacy/Terms content opens correctly above the gate after the
  z-index fix, acceptance persists across a full page reload (no re-prompt), and the gate is
  properly scrollable/full-width-button on a 375px mobile viewport with no horizontal overflow.
  Calculator-before-products order confirmed via `document.querySelectorAll('section')` order
  (screenshot tool's scroll-compositor quirk from earlier passes reproduced again, unrelated to
  these changes). Term slider's `max` attribute confirmed as `"12"` via DOM inspection.

### Not done this pass

- CSS "refinement" was intentionally minimal - no over-designed elements were found needing dialing
  back beyond what the second pass already restrained (tokens, no excessive glass/glow); no
  additional CSS changes were made this pass beyond what the above features required.
- Dashboard/application-form/auth-page redesign remains a separate, un-started follow-on phase.

---

## Addendum 3 — same day, fourth pass: actually replacing the photography

User correctly pushed back on Addendum 2's photo conclusion - flagging limitations isn't the same
as doing the work. Searched more persistently (Pexels, not just Unsplash, with more specific
queries: "filipino seaman", "filipino seafarer portrait", "ofw seafarer", "manila office employee",
"filipino call center agent", "makati professional", "filipino employee portrait", "filipino office
worker desk") and found two clearly stronger, more defensible candidates:

1. **`hero-seafarer.jpg` replaced** - a deck/bridge officer on a container ship at sunset, using
   binoculars, in reflective safety gear (Pexels, photographer "jefe king"). Editorial quality,
   authentic maritime work context, and a portrait-oriented composition that actually fits the
   hero's `.stage__photo` aspect ratio (4:4.6) far better than the old landscape crop did - no CSS
   changes needed, it slots directly into the existing frame.
2. **`product-business.jpg` replaced** - a market vendor in Pasig, Manila (Pexels, photographer
   "visionsofnico") - genuinely location-confirmed (the photo's own title states Pasig, Manila),
   candid, authentic, warm expression. The strongest, most defensible find of the session - actual
   geographic confirmation, not visual guesswork.

**Not replaced, with reasons:**
- `product-salary.jpg` and `product-seafarer.jpg` - no confirmed-better candidate turned up in the
  time spent. One promising Filipino-tagged result (a studio portrait in Barong Tagalog with a
  ceremonial sash) was downloaded and reviewed but rejected - it reads as graduation/ceremonial
  attire, not "salaried employee," and would have been a mismatched fit for the Personal Loan
  card's "quick cash advance against your salary" context specifically, not a quality problem with
  the photo itself.
- Neither swap can be described as "verified Filipino" with certainty - a stock photo's raw pixels
  don't carry citizenship data. What changed is confidence: the market-vendor photo has an actual
  location credit tying it to Manila; the seafarer photo is a stronger visual match (features/
  hair consistent with Southeast Asian appearance, real maritime work context, no watermark, no
  AI-generated tells) than anything found in the previous pass's searches.

### Verification

- `npm run build` clean. `npm run lint` - same 3 pre-existing errors, no new issues.
- New files confirmed served correctly: `hero-seafarer.jpg` verified in-browser at full size
  (1600x2398, portrait) rendering correctly in the hero. `product-business.jpg` confirmed via a
  direct `fetch()` HEAD-equivalent check (200 OK, `image/jpeg`, 109512 bytes matching the file on
  disk) after the `<img>` element itself failed to report a loaded state - by this point in the
  session the browser pane's tab had the same stuck-rendering symptom documented earlier
  (IntersectionObserver callbacks never firing, blank/duplicated screenshots after scroll), so the
  network-level fetch was used as the source of truth instead of trusting the img element's own
  `complete`/`naturalWidth` in that state.
- Docker rebuilt and redeployed with the new images.

---

## Addendum 4 — same day, fifth pass: Requirements & Security page redesign

User asked for a premium redesign of the public Requirements page and Security & Anti-Scam page
(the "Security Page" that communicates trust to visitors - not the authenticated `/security`
account-settings form, which is a different page entirely and out of scope here), plus the SME Loan
product photo the user pasted inline in chat.

### Photo blocked, flagged

The pasted image (a woman on a phone call at a fashion/sewing workspace) could not be extracted to
a file - this session's tools have no way to save an inline pasted image's bytes to disk, only to
read files that already exist at a path. Searched the session's temp/scratchpad directories for a
recently-written image matching it; found none. Flagged to the user to drop the file directly into
`public/images/product-business.jpg` or provide a path/URL - not resolved this pass.

### Real regression found and fixed

`RequirementsPage.tsx` (last touched 2026-09-05, before any of this session's homepage rewrites)
depended on CSS classes - `.elig-grid`, `.elig-card`, `.doc-list`, `.doc-item`, `section.mission`,
`section.products`, `footer.tease`, `.footer-card`, `.product-row`, `.product-card` - that no longer
exist in `landingMockupClone.css` after this session's earlier homepage redesign passes replaced
that file's entire class system. The page had been silently rendering unstyled since then. Confirmed
via `grep` before assuming - none of those selectors exist in the current file. This pass's rewrite
fixes it as a side effect of doing the requested redesign properly on the current class system,
rather than leaving it broken.

### What changed

1. **`landingMockupClone.css` extended** (not replaced) with six new sections (§23-27): `.subhero`/
   `.medallion`/`.trust-chip` for a compact interior-page hero, `.reqgrid`/`.reqcard` for eligibility
   criteria, `.doccards`/`.doccard` for per-product document checklists, `.infolist`/`.infocard` for
   the Security page's "never does"/"protect yourself" rows, `.alert-banner` for the critical scam
   warning, and matching responsive rules. Deliberately reused existing sections instead of adding
   new ones wherever the content shape matched: `.reasons`/`.reason` (added a `.reasons--four`
   modifier - the base 3-column grid would have orphaned a 4th item), `.steps`/`.step`, `.flow`,
   `.faq-item`/`.faq__grid`, `.close`, `.widget-card`, `.shell`, `.section`, `.eyebrow`, `.btn`.
2. **Two components extracted** to stop duplicating code across pages, per the request to "use
   existing components, avoid unnecessary duplicate styles": `Reveal` (scroll-triggered fade-in,
   was local to `LandingPage.tsx`) → `src/components/Reveal.tsx`; `FaqAccordionItem` (was also local
   to `LandingPage.tsx`) → `src/components/FaqAccordionItem.tsx`. Both pages plus the redesigned
   Security page now import these instead of each keeping a copy - `LandingPage.tsx` updated to
   match.
3. **`RequirementsPage.tsx` rebuilt**: `.subhero` (checklist-icon medallion, eyebrow, headline,
   intro) → eligibility `.reqgrid` (4 cards) → per-product `.doccards` (3 cards, still generated
   from `getDocumentsForProduct` - zero drift from the real application form) → new "Before you
   apply" section using `.reasons--four` (4 practical tips - added to `translations.ts` as
   `requirements.prepTips`, both locales, non-fabricated UX guidance, not a business claim) → "Simple
   application process" reusing `.steps` with the same 3 steps already published on the homepage
   (`t.landing.steps` - no new content invented) → `.close` CTA (existing `readyHeading`/`readyBody`
   content, same buttons as before).
4. **`SecurityTipsPage.tsx` rebuilt**: `.subhero` with a shield medallion and two real trust chips
   (SEC-registered, no-advance-fee - both already-published facts) → the critical scam warning in
   its own `.alert-banner` → "never does" as `.infolist` (bad/X icon) → official channels in a
   `.widget-card` (unchanged data) → "protect yourself" as `.infolist` (good/check icon, kept the
   real sec.gov.ph link on the correct tip) → **new FAQ accordion** (`t.securityTips.faq`, 5
   questions, both locales - composed entirely by rephrasing facts already stated elsewhere on this
   same page - OTP policy, no-advance-fee policy, SEC registration, official channels - into a Q&A
   format; no new claims) → the "think you've been targeted" report-it callout, unchanged content.
5. Fixed a bug caught while writing `SecurityTipsPage.tsx`: an early draft of its local `FaqItem`
   had a nonsensical conditionally-called `useState` (violates React's rules of hooks) - caught
   before building/testing and replaced with the plain, correct version (moot anyway once
   `FaqAccordionItem` was extracted and both pages switched to importing it).

### Verification

- `tsc --noEmit`, `npm run build`, `npm run lint` all clean (same 3 pre-existing errors, untouched
  files).
- Hit a stale-bundle error after the first Docker rebuild (`Failed to fetch dynamically imported
  module ... RequirementsPage-<oldhash>.js`) - the browser tab still had the pre-rebuild `index.html`
  loaded, referencing a chunk filename that no longer existed post-rebuild. Resolved with a full
  hard navigation/reload, not a real app bug.
- Verified both pages render correctly at desktop (hero, medallion, trust chips, alert banner all
  confirmed via screenshot) and mobile 375px (no horizontal overflow, single-column stacking,
  confirmed via screenshot). Verified structurally via DOM where the screenshot tool hit its
  now-familiar scroll-compositor quirk: 4 eligibility cards, 3 document cards (correct titles), 4
  prep tips, 3 process steps, 12 total infocards (5 bad + 7 good, correct split), 5 FAQ items with
  correct questions, FAQ accordion open/close interaction confirmed via a dispatched click.
  `.reasons--four` confirmed rendering as 4 columns at 1400px and collapsing to 1 column at the
  pane's native ~730px width.
- Docker rebuilt and redeployed.

### Not done this pass

- The SME Loan product photo swap (blocked on file access - see above).
- No further CSS "refinement" beyond what these two pages' new sections needed - the existing
  homepage token system was reused as-is throughout, per the request not to replace the design
  system.
- Dashboard/application-form/auth-page redesign remains a separate, un-started follow-on phase.

---

## Addendum 5 — same day, sixth pass: CSS-only polish (no rebuild, no functional change)

After reviewing a top-to-bottom outline of all three pages together, the user asked for a
CSS-and-light-presentation enhancement pass targeting the specific sections identified as
thinnest: Requirements' document cards, Security's two info-lists, and the homepage's "Why borrow"
section - explicitly scoped as "do not rebuild, do not change functionality, keep existing colors/
typography/content."

### What changed (`landingMockupClone.css`, edited in place - no new files, no duplicate rules)

1. **`.reqcard`** (Requirements "Who can apply", 4 cards): added a soft corner glow, gradient
   surface, icon shadow + hover rotate/scale, slightly stronger lift on hover.
2. **`.doccard`** (Requirements "Documents by loan type", 3 cards - the explicitly named biggest
   target): a 5px top accent bar that varies per card via `:nth-child` (navy→lime / lime→navy /
   navy-800→lime-700 - alternating mix of the *same two brand colors*, no new hues), a matching
   corner glow, a new icon badge (reuses each product's existing `product.icon`), a new document-
   count badge ("7 documents"), and the flat merged document list split into two visually distinct
   groups ("Always required" / "For this loan type" - two new i18n labels, EN+FIL, added to
   `translations.ts`, purely organizational, not a new claim). Hover lift increased, shadow now
   uses the `--e3` tier.
3. **`.infocard`** (Security's "never does" / "protect yourself" rows, 12 total): added a persistent
   (not just on-hover) left accent border and faint tinted wash - destructive-red for the 5 "never
   does" rows, lime for the 7 "protect yourself" rows - using `:has(.infocard__ico--bad)` /
   `:has(.infocard__ico--good)` selectors so no JSX changes were needed to apply it. Icon containers
   enlarged with a soft ring glow. Added a `:nth-of-type(3n+1)` spacing rule so the 7-item list
   reads as loose clusters of three rather than one unbroken column - pure CSS rhythm, no new
   grouping labels invented.
4. **`.reason`** (homepage "Why borrow", 3 items): bigger ghost numeral, a new icon badge per item
   (reused already-imported `Smartphone`/`CalendarClock`/`ShieldCheck` icons - paired by index with
   `t.landing.features` the same way `PRODUCT_TAGS` already pairs with `LOAN_PRODUCTS`), a small
   decorative underline rule, and a hover state (soft tinted background wash, icon flips to the
   brand gradient, numeral brightens).
5. **New `.section--glow-navy` / `.section--glow-lime` utility classes**: a very subtle radial
   brand-tinted glow (6-8% opacity) applied via `::before` on `.section`, added to the Requirements
   documents section, both Security info-list sections, and the homepage's "Why borrow" section -
   so those specific sections gain quiet depth instead of sitting on flat `--surface-2`.
6. Every new hover/transform effect above composes with the pre-existing `prefers-reduced-motion`
   block (§22, untouched) - transitions collapse to 0.01ms and stay functionally identical.

### JSX changes (minimal, additive, presentational only - no structural/functional change)

- `RequirementsPage.tsx`: doccard render now includes an icon badge, a computed count badge
  (`always.length + productSpecific.length`), and renders `always`/`productSpecific` as two labeled
  groups instead of one flattened array - same underlying data from `getDocumentsForProduct`,
  same document list, just organized on-screen.
- `LandingPage.tsx`: "Why borrow" render now includes a `REASON_ICONS` array (3 already-imported
  icons, no new dependency) and renders an icon + decorative rule per item.
- `SecurityTipsPage.tsx`: no JSX change needed - the bad/good accent styling attaches via `:has()`
  to the icon class already present on each row.

### Verification

- `tsc --noEmit`, `npm run build`, `npm run lint` all clean (same 3 pre-existing errors, untouched
  files).
- Verified via DOM/computed-style inspection (the browser pane hit its now-familiar scroll-
  compositor blank-screenshot quirk again for anything below the first fold - same tool limitation
  documented in every prior addendum, unrelated to these changes): all 3 doccards show icon +
  correct per-product count (7/5/8) + both group labels + three distinct accent gradients; Security
  page's `:has()`-based accent styling confirmed applying the correct destructive-red border to all
  5 "never does" rows and lime border to all 7 "protect yourself" rows; homepage's 3 reason items
  confirmed all carrying an icon and a decorative rule. Screenshots did succeed above the fold on
  both Requirements (eligibility cards, showing the new glow/gradient/icon-shadow treatment) and
  Security (hero) pages.
- Mobile (375px) checked on all three pages via `document.body.scrollWidth` vs `window.innerWidth`
  - no horizontal overflow on any of them.
- Docker rebuilt and redeployed.

### Not done this pass

- The SME Loan product photo swap remains blocked on file access (see Addendum 4).
- No section-spacing-scale or global-typography-scale overhaul - the existing `--section`/`--t-*`
  tokens were judged already well-considered from prior passes, and reworking them site-wide would
  have risked exactly the "rebuild" the user explicitly said not to do.

---

## Addendum 6 — same day, seventh pass: pushing past "styled cards" into art direction

User's verdict on Addendum 5: technically correct, but still reads as "an improved version of the
existing design" rather than genuinely premium. Asked for a further pass focused on composition -
asymmetry, oversized typography, layering - specifically on the sections that still felt like lists
in boxes, while still not rebuilding the site or changing functionality. This pass required some
real (small, contained) markup restructuring in the three named sections, not CSS alone - grouping
content and varying visual weight can't be done with CSS on a flat, ungrouped array.

### What changed

1. **`.doccards` (Requirements, the named centerpiece)**: broke the equal 3-up grid into a quiet
   asymmetric waterfall - card 2 sits higher, cards 1 and 3 sit lower (`translateY`, `clamp()`-
   capped so it never gets excessive, resets to a flush stack below 960px). Each card now carries
   an oversized Fraunces ghost numeral ("01"/"02"/"03") bleeding into its top-right corner at 5%
   opacity (9% on hover) - the same ghost-numeral device the homepage already uses, scaled up and
   turned into a corner watermark instead of an inline label. Document list items got a refined
   treatment: circular lime check-badges instead of bare checkmarks, hairline dividers between rows,
   and a subtle indent-on-hover. `RequirementsPage.tsx` gained two new elements per card
   (`.doccard__ghost`, `.doccard__glow`) - no data or logic changes, `getDocumentsForProduct` and
   the always/product-specific split are untouched.
2. **Security "never does" (5 warnings) → severity hierarchy**: the first item (the advance-fee
   scam - already first in the source array, and the same pattern the page's own alert banner leads
   with) is now a full-width `.infocard--spotlight` with a 56px icon and a Fraunces heading; the
   remaining four render in a tighter 2-up `.infogrid` with a smaller footprint. This uses the
   array's own existing order as the hierarchy signal rather than the AI inventing a severity
   ranking not implied by the source.
3. **Security "protect yourself" (7 tips) → 3 real clusters**: replaced the flat list with
   `.infocluster` groups - "Verify before you trust" (tips 1-2), "Protect your credentials"
   (tips 3-5), "Stay in control" (tips 6-7) - each with a large ghost numeral and a two-column head/
   body layout (stacks on mobile). Added `t.securityTips.protectGroups` (3 short labels, EN+FIL) -
   pure regrouping of existing content, no new advice. A `PROTECT_GROUPS` constant in
   `SecurityTipsPage.tsx` maps cluster → original array indices, so the sec.gov.ph link (previously
   attached via `index === 1`) still attaches to the exact right tip regardless of which cluster
   renders it - verified via DOM query, not just visual inspection, since silently detaching that
   link would be a real regression.
4. **Homepage "Why borrow" (3 items)**: numeral enlarged from 3.2rem to 4.75rem and the icon badge
   now overlaps its bottom-right corner as one layered mark (small bordered circle floated via
   absolute positioning) instead of sitting beside it in a row - a more deliberate "designed mark"
   than a label-and-icon pair, per the request to add "meaningful visual anchors rather than more
   cards" without the section becoming oversized.

### Verification

- `tsc --noEmit`, `npm run build`, `npm run lint` all clean (same 3 pre-existing errors, untouched
  files).
- The browser pane's scroll-compositor quirk (documented in every prior addendum) blocked most
  below-the-fold desktop screenshots again this pass; relied on DOM/computed-style checks instead:
  confirmed the three `.doccard` elements carry `translateY` values of 28px/0px/40px (the waterfall),
  confirmed all three ghost numerals render at the correct opacity, confirmed the spotlight card
  shows the fee-scam warning with 4 items in the compact grid, confirmed all 3 clusters contain the
  correct tips (2/3/2, matching `PROTECT_GROUPS`) and that the sec.gov.ph link lands inside the
  correct cluster item's text.
- Mobile (375px) verified with real screenshots (not just DOM) this pass, since the pane happened to
  render correctly at this viewport size: the severity spotlight, the 4 compact "never does" cards,
  and all 3 "protect yourself" clusters all confirmed visually - stacking correctly, no overflow,
  ghost numerals and dividers intact, ordering preserved.
- Docker rebuilt and redeployed.

### Not done this pass

- The SME Loan product photo swap remains blocked on file access (see Addendum 4).
- Did not touch the homepage hero or calculator, per explicit instruction that they're already
  among the strongest sections.
- Did not attempt a second "Documents by loan type" pass beyond the waterfall + ghost-numeral
  treatment - if this still doesn't clear the bar on review, the next lever would be differentiating
  the three panels' *proportions* (not just position), which would need slightly more markup change
  than this pass made.

---

## Addendum 7 — same day, eighth pass: homepage depth and composition

A further request focused entirely on the homepage: more visual depth/richness around the hero,
stronger section-to-section storytelling, a substantially reworked products section, a more
"flagship" calculator feel, and trust signals distributed throughout rather than only in the stats
band/footer - all without rebuilding the page or touching functionality.

### What changed

1. **Hero depth**: a single quiet decorative ring (two concentric circle outlines, brand-tinted,
   desktop only) anchored behind the stage photo, plus a very slow (22s) ambient drift on the
   existing `hero__wash` gradient (`prefers-reduced-motion` disables it entirely, not just slows it).
2. **Products section reworked from three equal rows into a featured item + connected pair**: the
   first product (SME/Business Loan - first in `LOAN_PRODUCTS`' existing order, not a claim of
   superiority) keeps the full editorial `.prow` treatment plus a real trust badge in its footer
   (reused `t.landing.trustSecRegistered`, the same already-published fact used elsewhere); the
   other two products now render as a connected `.product-pair` of compact cards with their own
   image, index badge, and CTA - genuine visual hierarchy instead of three identical rows. Hit a
   real JSX error while wiring this up: `<LOAN_PRODUCTS[0].icon .../>` isn't valid JSX (array-index
   member expressions can't be used as tag names, only simple dotted ones) - fixed by destructuring
   the featured product and its icon into local capitalized consts before the return.
3. **Oversized ghost typography** (`.section__ghost`): a single very-low-opacity ("Loans") Fraunces
   word bleeding off the products section's top-right corner - one new reusable utility, used
   once so far, hidden below 960px so it never competes with content on tablet/mobile.
4. **Calculator refinement**: the slider knob now gets a wider, brighter glow while being actively
   dragged (`:has(input:active)`, a pure box-shadow/scale swap, no keyframe animation needed so no
   reduced-motion guard required) - the calculator's own "premium interaction" feedback moment.
5. Confirmed (not this session's doing): the SME Loan photo blocked in Addendum 5/6 is now live -
   `public/images/product-business.jpg`'s file timestamp is newer than any edit made this session,
   confirming the user placed the file directly as suggested. Verified in-browser it renders
   correctly as the featured product's image.

### Bug found and fixed

- The JSX array-index-icon issue above (`tsc` caught it immediately as a syntax error, not a type
  error - `Identifier expected` / `Unexpected token`).

### Verification

- `tsc --noEmit`, `npm run build`, `npm run lint` all clean (same 3 pre-existing errors, untouched
  files).
- Hit a different rendering artifact this pass: at a custom 1400x900 viewport (via `resize_window`
  with explicit width/height, not a named preset), the hero photo rendered as a solid navy block
  instead of the actual image, even though DOM inspection showed the `<img>` fully loaded
  (`complete: true`, `naturalWidth: 1600`). Resetting to the pane's native/preset sizing made the
  photo render correctly again - this matches a scaling quirk with custom (non-preset) viewport
  widths already noted earlier in this session's history, not a regression from this pass's CSS.
  Verified the decorative ring, ghost typography, and product-pair structure via DOM/computed-style
  checks instead of chasing more screenshots at custom widths.
- Mobile (375px, via the `mobile` preset) verified with real screenshots: hero, calculator (including
  the enhanced slider), and the full products section (featured row with trust badge + divider,
  compact pair card with index badge) all confirmed rendering correctly, stacking properly, no
  overflow.
- Docker rebuilt and redeployed.

### Not done this pass

- No new full sections added ("why choose us" / "application readiness" / journey visualization) -
  reviewed the existing 13-section homepage and judged that deepening what's there (products,
  calculator, trust distribution) served the brief better than adding more sections purely to reach
  every suggested idea, per the brief's own "don't add sections just to increase length" caveat.
  If a specific one of those is still wanted, it needs a follow-up ask naming which.
- Did not attempt a JS-driven scroll-linked parallax (real mouse/scroll-position tracking) - used a
  self-contained CSS `@keyframes` drift instead, which delivers similar ambient depth with materially
  less risk (no scroll listeners, no performance concern, trivially disabled for reduced-motion).

---

## Addendum 8 — same day, ninth pass: Seafarer Loan as the #1 featured product, site-wide

User asked for Seafarer Loan to become the flagship/#1 product everywhere on the site, plus further
homepage sophistication (cinematic hero framing, animated counters, stronger Filipino identity).

### What changed

1. **`LOAN_PRODUCTS` reordered** in `loanProducts.ts` (the single source of truth) - Seafarer Loan
   now leads, followed by Salary/Personal, then Business/SME. `category` values themselves are
   untouched (still the exact backend-facing strings) - only array position changed. This cascades
   automatically through every consumer that already derives from array order via `.map()`/`[0]`:
   the landing page's featured-product row, the nav mega-menu, the mobile drawer, the Requirements
   page's document cards, `LoanProductsPage`, the application form's category dropdown, and
   `LoanCalculatorWidget`'s default selected category - verified each one picked up the new order
   via DOM inspection rather than assuming the cascade worked (nav menu, product-pair, doccards all
   individually confirmed showing "Seafarer Loan" first).
2. Two **local `PRODUCT_TAGS` arrays** (`LandingPage.tsx`, `RequirementsPage.tsx`) - these are
   paired to `LOAN_PRODUCTS` by index but aren't derived from it, so they needed a manual matching
   reorder (`['Overseas', 'Everyday', 'Business']`). Confirmed correctly paired post-reorder via DOM
   (Requirements page's doccard tags render in the right order against the right titles).
3. **Hero snapshot category** switched from `'Salary Loan'` to `'Seafarer Loan'` - the hero photo
   was already a seafarer portrait, so this is a labeling/consistency fix, not a numbers change
   (every category shares the same flat 3%/month rate in `loanEstimator.ts`, so the computed
   monthly figure is identical either way).
4. **New `.stage__tag` label** ("Featured · Seafarer Loan") overlaid on the hero photo itself, so
   the photo-to-product connection is explicit rather than only implied by which image happens to
   be used - pulls the real `displayLabel` from `LOAN_PRODUCTS[0]`, not a hardcoded string.
5. **Animated counters** on the stats band (16 / 7,000+ / 20) - new `AnimatedCounter` component,
   counts up with an ease-out curve when scrolled into view, respects `prefers-reduced-motion` by
   skipping straight to the final value rather than just animating faster. Uses only the same real,
   already-published numbers - no new claims.

### Bug found and fixed

- `<LOAN_PRODUCTS[0].icon className="..." />` is not valid JSX (array-index member expressions
  can't be used as a JSX tag name, only simple dotted ones like `<Foo.Bar>`) - this was actually
  fixed in the *previous* pass (Addendum 7) when the featured-product pattern was first introduced;
  this pass's reorder didn't reintroduce it since the fix (destructuring into `FEATURED_PRODUCT`/
  `FeaturedIcon` consts) is order-independent.

### Verification

- `tsc --noEmit`, `npm run build`, `npm run lint` all clean (same 3 pre-existing errors, untouched
  files).
- Reorder cascade verified via DOM on three separate pages/surfaces (homepage featured row + pair,
  nav mega-menu, Requirements page doccards) rather than trusting the array change alone.
- Hit the same photo-not-painting-despite-being-loaded quirk documented in Addendum 7 (DOM showed
  `complete: true`, `naturalWidth: 1600` while the screenshot showed solid navy) - resolved with a
  fresh reload, confirmed not a regression.
- The animated counter's `IntersectionObserver` didn't fire during one test pass - diagnosed as the
  same backgrounded-tab quirk documented earlier in this session (`document.visibilityState` read
  back `"hidden"` at the time), not a component bug. Confirmed correct end-to-end on a later mobile
  screenshot: captured mid-animation (showing "1", "453+", "1") and again after settling (showing
  the correct final "16", "7,000+", "20").
- Mobile (375px) checked for horizontal overflow - none.
- Docker rebuilt and redeployed.

### Not done this pass

- Did not attempt a broader "cinematic hero" rebuild (layered interface panels, grid-system
  overlays) beyond the featured-product tag and existing ring/drift from Addendum 7 - the hero was
  called out as already one of the strongest sections in the same request, so changes here were
  kept targeted to the Seafarer-featuring ask specifically.
- Did not source additional seafarer-specific photography this pass - the existing
  `hero-seafarer.jpg` (sourced and verified in Addendum 4) already serves as the flagship image and
  didn't need replacing for this ask.

---

## Addendum 9 — same day, tenth pass: real data from easycash.ph

Earlier the same day, the user asked me to browse the actual live easycash.ph and summarize its
structure (separate research turn, no code changes). This pass asked to use those findings to
"upgrade and expand" the Portal.

### What was found on the live site (research, prior turn)

Confirmed via direct navigation: a two-stage Privacy/Terms consent gate before the homepage; nav
structure with Seafarer Loan as a standalone top-level item (Other Products/Customer Assistance as
dropdowns, the latter including a "Borrower's Manual" not modeled in the Portal); animated stat
counters (0 → real value on scroll - same pattern independently built into the Portal in Addendum
8); and three dedicated product pages publishing **real, confirmed loan amount caps and age
ranges**: Seafarer Loan ₱500,000 (21-60), Personal Loan ₱300,000 (21-60), SME Loan ₱500,000 (21-65).

Also found a **real conflict**: the live site's FAQ states loans are "disbursed via bank transfer,
e-wallet, or other supported channels" - directly contradicting the Portal's own anti-scam
disclosure ("released via Bank Cheque only... never disburses in... bank transfer"). Flagged to the
user in the research turn; **not resolved in code** - this needs a decision from whoever owns that
policy, not a silent pick-one-side edit. `loanProducts.ts` now carries a doc-comment record of this
conflict so it isn't lost.

### What changed in code this pass

1. **`loanProducts.ts`**: added `maxAmount` and `ageRange` per product - the confirmed real figures
   above, with a doc comment citing the live site as the source and explicitly noting they must be
   re-verified if easycash.ph republishes different numbers later (not treated as permanently true).
2. **`LoanCalculatorWidget.tsx`**: the amount slider's ceiling is no longer a flat ₱200,000
   "convenience" guess - it now tracks the selected product's real `maxAmount`, and switching
   products clamps the current amount down if it exceeds the new product's real ceiling (e.g.
   sliding to ₱280,000 on Personal Loan, then switching to a product with a lower cap would pull it
   back in - in practice here Personal Loan's 300k is already the lowest of the three, so this
   mostly guards future data changes). The floor (₱5,000) stays a UI-convenience number, per the
   existing doc comment - only the ceiling had a real published figure to switch to.
3. **`LandingPage.tsx` calculator section**: same treatment - `CALC_AMOUNT_MAX` now derives from
   `LOAN_PRODUCTS.find(...).maxAmount` instead of a hardcoded 200,000. Also switched the section's
   fixed category from Salary Loan to Seafarer Loan, consistent with Seafarer being the flagship
   product everywhere else on the page (Addendum 8) - this section previously showcased a different
   product than the hero and featured row.
4. **Requirements page document cards**: added a new metadata row ("Up to ₱X" / "Ages Y-Z") under
   each product's description, sourced from the new `maxAmount`/`ageRange` fields - real product
   facts now visible where a borrower is actually deciding what to prepare, not just implied.

### Deliberately not done

- Did not touch the disbursement-channel disclosure (see conflict above) - flagged, not resolved.
- Did not add the live site's richer co-borrower requirements list for Seafarer Loan (Primary Gov ID
  w/ 3 specimen signatures, Secondary Gov ID, Company ID, Proof of Billing) as new uploadable
  document slots - the Portal's `DOCUMENT_SLOTS` are tied to real backend-accepted
  `AttachmentDocumentCategory` values (see `loanRequirements.ts`'s own doc comment: "never add an
  entry unless the backend accepts it"), and I have no way to confirm the backend accepts these as
  distinct co-borrower categories. Surfacing this without backend confirmation would risk
  fabricating an upload requirement the system can't actually process. Flagging for a follow-up
  decision rather than guessing.
- Did not expand the Portal's FAQ to match the live site's much larger 10-category FAQ - that's a
  large, separate content-writing effort (many new Q&As across two locales) better scoped as its
  own follow-up if wanted, not folded into this pass silently.
- Did not add a "Borrower's Manual" page/link - I only saw the nav item, never read its actual
  content, so there was nothing real to add without fabricating it.

### Verification

- `tsc --noEmit`, `npm run build`, `npm run lint` all clean (same 3 pre-existing errors, untouched
  files).
- Verified via DOM that the calculator's slider max is genuinely product-aware (`max="500000"` when
  set to Seafarer Loan, matches `LOAN_PRODUCTS[0].maxAmount`) and that the section's copy correctly
  reads "Seafarer Loan" (derived from `getLoanProductDisplayLabel`, not a hardcoded string).
  Verified all three Requirements page cards show the correct real figures (₱500,000/21-60,
  ₱300,000/21-60, ₱500,000/21-65) matching the live site exactly.
- Confirmed via a real mobile (375px) screenshot that the new metadata row renders correctly inside
  the existing Seafarer Loan card - no overflow, consistent with the card's established visual
  language (small caps labels, Fraunces figures).
- Docker rebuilt and redeployed.
