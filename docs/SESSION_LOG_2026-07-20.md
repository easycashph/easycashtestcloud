# Session Log — 2026-07-20

Two separate work streams landed on this date, from two different sessions/machines. Kept as two
sections rather than merged into one narrative, since they're independent efforts.

## Session A — SOA dialog redesign, BSP 1133 / SEC MC 3 compliance kickoff

### Summary

Continuation of the SOA (Statement of Account) work from 2026-07-19, plus a new compliance
initiative: read the actual BSP Circular 1133 / SEC MC 3 text (user-supplied PDFs) and began
building the foundation for interest-rate/penalty/EIR/total-cost ceiling compliance.

### What was done, in order

1. **Docker rebuild for the SOA feature.** The user hit 404s testing "Create SOA" — root cause:
   the backend runs in Docker, and a container restart alone doesn't pick up new source code (the
   image needs an actual rebuild). First rebuild attempt failed with a transient `ETXTBSY` error
   (Windows file-lock during `npm install`); retried and succeeded. Explained the diagnosis process
   (`docker logs` inspection) to the user.
2. **Verified the Accrued Interest formula against real data.** User asked how a specific loan's
   ₱69,419.59 Accrued Interest figure was computed. Queried the live database directly (read-only)
   for loan `SP-Easy_00001`'s real installments/balances, hand-traced the exact formula, and
   confirmed every intermediate figure matched what the dialog showed (Interest Past Due, Penalty,
   Total Past Due, and the final Accrued Interest) — the large amount was correct given the loan
   matured in 2021 and the As Of Date was 2026.
3. **Corrected the "matured only" rule for Accrued Interest** (user clarification): the section
   should be visibly locked/disabled with an explanation (not just silently show ₱0.00) until the
   loan's real Maturity Date has actually passed — mockup shown and approved, then implemented as
   a client-side gate (`soaPreview.isMatured`) in the Create SOA dialog.
4. **Full SOA dialog redesign** (mockup shown and approved first): added read-only Account
   Information and Balances cards (Loan ID, Loan Date, Term, Maturity Date, PN Amount, Current
   Amortization, Principal/Interest/Total Past Due — all live-computed client-side, mirroring the
   backend formula), the maturity-gated Accrued Interest section, and a Total Amount Due summary
   at the bottom. Frontend-only change (no backend/API changes), verified with `tsc`/build.
5. **BSP Circular 1133 / SEC MC 3 compliance — new initiative.** User supplied the actual
   regulation PDFs (`legacy/SEC/BSP1133.pdf`, `legacy/SEC/2022FAQs_...pdf`). Read both in full,
   extracted the exact coverage criteria (4 concurrent conditions) and the 4 ceilings (6% nominal,
   15% EIR, 5% penalty, 100% total cost). Queried the live database and found **43 real loan
   accounts** (several currently ACTIVE/ACTIVE_IN_ARREARS) matching 3 of the 4 coverage criteria
   (≤₱10,000 principal, ≤4-month tenor, originated on/after 2022-03-03); user confirmed the 4th
   criterion (unsecured/general-purpose) for the relevant products (`SP-Flash`, `SL-LAZ`,
   `SML-REG`, `PFL-GAD`). Identified real gaps: ADR-050's penalty formula compounds monthly instead
   of the regulation's simple 5%/month; no Total Cost Cap (100%) enforcement anywhere; no EIR
   validation anywhere. Documented the full analysis in `docs/Architecture/ADR-053-bsp-1133-sec-mc3-compliance.md`
   and started **Phase 1 only** (per explicit user instruction "simulan mo" — start it):
   - New `LoanProduct.isUnsecuredGeneralPurpose` column (migration
     `20260720022158_add_loan_product_sec_mc3_classification`), defaulting `false`, set `true` only
     for the 4 user-confirmed products — every other product (including similarly-named ones like
     `SL-LAZ-NEW`/`SL-LAZ-PRM`/`SL-OL`) deliberately left unclassified pending explicit review, not
     guessed from name similarity.
   - `isSecMc3Covered()` pure function (`src/shared/domain/compliance/SecMc3Coverage.ts`),
     evaluating all 4 criteria concurrently, plus the 4 ceiling constants for later phases to
     consume. 10 unit tests.
   - Not yet wired into any actual behavior (penalty calc, origination validation, etc.) at the time
     of this write-up — Phase 2 (simple-interest penalty formula) shipped later the same day, see
     ADR-053 §4; Phases 3-5 (EIR check, total cost cap, historical remediation review) remain
     deferred pending further instruction.
6. **SOA.docx template placeholders inserted** (later the same day, separate follow-up): the
   template had no merge tags yet (ADR-052 §6) — walked the user through inserting them directly in
   Word, including the `{#RemainingSchedule}`/`{/RemainingSchedule}` table-row loop (first attempt
   put the tags in a paragraph below the table instead of inside an actual table row — corrected).
   `LoanDate` was also found to render blank whenever `anticipatedDisbursementDate` wasn't set (true
   for many legacy loans) — changed it to fall back to `LoanAccount.activatedAt` (the real
   disbursement date).
7. **Dashboard/Loan Account activity panel cleanup** (separate follow-up requests):
   - Removed the "Show details" JSON-expansion toggle from the Loan Account Activity Timeline
     (`ProfileActivityTimeline`) via a new `showDetailsToggle` prop, default `true` — Client
     Profile/Loan Application pages keep it, Loan Detail doesn't.
   - Replaced the Dashboard's old "Recent Dashboard Activity Logs" panel (which only ever showed
     `VIEW_SECTION` page-view noise for the Dashboard page itself) with a new
     `RecentSystemActivityPanel`: system-wide, plain-language ("Nomer Perez recorded a payment on
     SML-REG_00376"), linking to the affected loan/application. Removed the same redundant
     per-list-page panel from the Loan Accounts list page.
   - Added server-side `excludeActions` filtering to `/audit-logs` (client-side filtering after the
     fact was starving the widget's `limit`, since `VIEW_SECTION` page views vastly outnumber real
     actions) and batch-resolved `entityLabel` (LoanAccount.loanCode / LoanApplication.
     applicantName) so links show a human-readable reference instead of a raw UUID.
   - Made the widget visible to **all roles**, not just MIS: added a stripped-down, all-roles
     `GET /audit-logs/recent-activity` endpoint (new `RecentActivityPresenter`) that omits the
     sensitive fields (previous/new values, IP, user agent) the MIS-only `/audit-logs` and
     Administration > Activity Logs page still carry.

### Verification

Backend: `tsc --noEmit` clean, full suite passing (758/758 by end of session, up from 743
baseline). Frontend: `tsc --noEmit` and `npm run build` both clean.

### Current state / known follow-up work

- SOA feature is functionally complete, Docker-deployed, and its template placeholders are now
  filled in.
- SEC MC3 compliance: Phase 1 (coverage classification) and Phase 2 (simple-interest penalty
  formula for covered loans) are implemented. Phases 3-5 (EIR validation, Total Cost Cap
  enforcement, historical remediation review) remain deferred pending further instruction — see
  `docs/Architecture/ADR-053-bsp-1133-sec-mc3-compliance.md` §5.
- Still need: classification review for the remaining ~24 unclassified loan products; a decision on
  whether Phase 5 (historical remediation) is even in scope or a separate legal/compliance-led
  effort.

## Session B — Administration reorganization, Roles/Product Types made configurable

### What was done, in order

1. **About page changelog cleanup.** User asked to review the project and update the About page
   changelog. Rebuilt the entries for the last few days from git history and session logs (the
   existing 0.9.11/0.9.12 entries had misdated and incomplete content):
   - 0.9.11 (July 17): Loan Application Review Pipeline stages, Dashboard pipeline funnel,
     Settings Appearance overhaul + Notification Center, wider dialogs, payment/repayment fixes.
   - 0.9.12 (July 18): Global Search, real overdue scheduler, bulk decline, in-app Help, SMS/Email
     automatic payment reminders, unified Reminder Logs, MIS-only reminder toggle.
   - 0.9.13 (July 19): sidebar/main content independent scrolling fix.
   - Committed and pushed (had to pull first - origin had moved ahead each time).

2. **Bug report: "Something went wrong loading this page."** User couldn't get into the LMS at
   all. Diagnosed via the actual browser console error the user pasted:
   `DashboardPage.tsx:329 Uncaught TypeError: Cannot read properties of undefined (reading
   'requirementCompliance')` in `LoanApplicationPipelineFunnel`. Root cause: the component
   destructures `pipeline` (from `DashboardSummary.loanApplicationPipeline`, a field added
   2026-07-17) without a null guard - a backend deployment that predates that field returns
   `undefined` for it, crashing the whole Dashboard via the `ErrorBoundary`. Fixed with a
   defensive fallback (all-zero pipeline) so a backend/frontend version skew can never
   white-screen the landing page again. Told the user the backend server itself still needs a
   pull + restart to actually serve the new field.

3. **Administration reorganization** (several follow-up requests, each shipped separately):
   - Added a standalone **System** page (`/admin/system`) under Administration, moved out of
     Configuration > Settings' old "System" tab (SMS/Email reminder master switches).
   - Folded **User Accounts**, **Loan Products**, and **Activity Logs** into that same System page
     as tabs, alongside Reminders - old routes now redirect (`/admin/members` →
     `/admin/system?tab=members`, etc.) instead of disappearing.
   - Moved **About** out of Administration entirely into a brand-new **Support** section (user
     picked "Support" after being offered a few naming options) - it was open to every role
     already, just visually buried under an "Administration" label that read as admin-only.

4. **Member Profile view + cascading Profile address.**
   - Settings > Profile's Address field is now the same `PsgcAddressPicker` cascading
     Region→Province→City→Barangay control used elsewhere, instead of free text. Since the
     existing saved address is a flat string with no structured backing, the picker starts blank
     and composes a new formatted address into the same field only if the officer actively picks
     one - otherwise the existing value is left untouched on save (no silent data loss).
   - Staff Accounts table: removed the Actions column and per-row Edit button. Clicking a member's
     **name** now opens a full **Member Profile** dialog showing every field on file (contact
     number, address, birthday, company ID, role class, created date) - previously only visible
     via that person's own self-service Settings, never to MIS from the admin list. MIS gets an
     "Edit Member" button inside that view instead.

5. **Tooltip clipping bug**, found via user report while testing the Member Profile dialog: the
   Role-abbreviation definition tooltip (`TermTip`, hand-rolled `position: absolute`) got visually
   cut off inside `DialogContent`'s `overflow-y-auto` scroll box. Rebuilt `TermTip.tsx` on the
   existing Radix `Tooltip`/`TooltipContent` (already used by `FieldTooltip`), which portals to
   `document.body` and escapes any ancestor's overflow - fixes it everywhere `TermTip`/`RoleAbbr`
   is used, not just the one dialog.

6. **Roles tab made fully configurable** (user asked for suggestions first, then "gawin mo na ang
   lahat, i trust you" - implemented every suggestion):
   - Backend: new `DELETE /role-classes/:id` (blocked with a 409 if any staff are still assigned -
     `RoleClass.userCount`, computed via Prisma `_count`, drives both the guard and a UI badge),
     `PATCH` extended to also reassign a Role Class's Role Type (was rename-only), duplicate-name
     proactively checked on both create and update. 8 new unit tests.
   - Frontend: inline quick-add per Role Type card (no dialog for the common case), a live
     "N staff members" badge per Role Class, a Delete button (disabled with an explanation when
     still in use), and a Role Type selector added to the Edit dialog.

7. **Product Types made renamable** (same pattern as Roles, user's next request). "Product Type"
   (Business Loan, Salary Loan, Seafarer Loan, etc.) was a hardcoded name-prefix classification in
   `productTypeClassification.ts` with no persistence at all. Rather than touch that classification
   logic, added a separate renamable **display label** layer:
   - New `ProductTypeLabel` Prisma model (`canonicalKey` unique/stable, `label` renamable), new
     `product-type-label` backend module (GET open to all authenticated roles, PATCH MIS-only,
     proactive duplicate-label guard), seeded 1:1 with the 5 existing canonical types via
     `prisma/seed.ts`. 4 new unit tests.
   - Frontend `productTypeLabels.ts` (`useProductTypeLabels` hook + `productTypeLabel()` lookup,
     falls back to the canonical key if unloaded) wired into the 3 places a Product Type is shown:
     Loan Products catalog headings, Create Loan Account's Product Type picker, and Loan
     Application's assigned Product Type. New **Product Types** tab in Administration > System.

### Infrastructure discovery this session

Found a fully working local Docker stack on this machine (`easycash-postgres-1`,
`easycash-backend-1`, healthy, port-forwarded) that a prior session's memory note said didn't
exist here anymore ("this device is frontend-only going forward"). That note is now stale - used
this environment to actually verify today's backend work end-to-end instead of relying on
`tsc`/`vitest` alone:
- Local Postgres was 4 migrations behind (`migrate deploy` caught it up), local Prisma client was
  stale (`prisma generate` + `npm install` fixed missing `node-cron`/`nodemailer` types).
- Rebuilt the `easycash-backend` image with today's code, restarted the container, minted a
  short-lived JWT for the `integration-test@easycash.ph` fixture account (existing account, no
  known password - never touched a real staff member's credentials) to smoke-test
  `/product-type-labels` and `/role-classes` via curl (rename, 409 duplicate guard, delete all
  confirmed working), then temporarily reset that same fixture account's password to log in
  through the actual browser UI and click-test the Product Types rename flow end-to-end against
  real production data. Restored the fixture account's original password hash afterward, and
  deleted/reverted every piece of test data created along the way (a stray "aadasda" Role Class,
  the temporary "Seaman Loan" relabel).

This confirms the local dev stack is viable for live verification going forward - worth updating
the `infrastructure_hosting_plan` memory note in a future session rather than assuming
frontend-only.

### Current state

- All of Session B's work is committed and pushed to `origin/main`.
- Local dev DB/backend (`app/docker`) now matches the latest code and schema (migrations applied
  through `20260720022837_add_product_type_labels`, Prisma client regenerated, seed re-run).
- Every change still needs the **real** backend deployment (Nomer's server) to pull and restart
  before staff see any of it - this session's local Docker verification was for correctness
  confidence only, not a substitute for that deploy.

### Known follow-up work

- None blocking. The Product Types/Role Class features are additive and don't require any data
  migration beyond applying the new Prisma migrations.
