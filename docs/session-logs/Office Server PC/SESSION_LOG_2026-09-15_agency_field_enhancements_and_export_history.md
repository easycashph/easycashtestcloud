# Session Log — 2026-09-15 — Agency Field Enhancements + Export History Requester + Negative Areas

**Machine:** Office Server PC
**Requested by:** Nomer Perez

## Summary

Continuation of the 2026-09-14 Agency name dropdown feature: three more small dropdown/auto-fill
enhancements to the same Loan Application Detail "Agency / contract / allotment verification" and
"Mode of payment and mitigation" sections, plus an unrelated Export History change (show who
requested each export). One Docker build infrastructure hiccup along the way, documented for next
time.

## Agency verification: address + contact number auto-fill

User asked whether selecting an agency from the DMW dropdown could also fill in the Agency address
field. Extended `AgencyNameCombobox`'s `onSelectAgency` callback (added, not previously wired) so
`LoanApplicationDetailPage.tsx` fills `agencyAddress` from the matched DMW record on selection -
free text stays untouched if the record has no address on file.

Follow-up: does the DMW dataset have contact numbers too? Checked the imported table -
**3,447 of 3,794 agencies (90.9%)** carry phone data. Extended the same `onSelectAgency` handler to
also fill `agencyContactNumbers`.

## Position field: seafarer rank suggestions

User asked for a list of seafarer positions to also turn the free-text "Position" field into a
dropdown. Checked the database first for real usage data before inventing anything - only 3 rows
existed (`cook`, `TESTCOOK`, `asdf`), not enough to build a real reference list from, and unlike
DMW agencies there's no government registry for job titles to pull from either. Asked the user how
to proceed; they asked me to supply a standard list. Provided the common STCW-based maritime rank
vocabulary (deck/engine/catering departments) as a reference list, explicitly flagged as general
industry knowledge, not verified/official data.

Implemented as a new `SeafarerPositionCombobox` (client-side filtered over a static ~28-item list
in `seafarerPositions.ts` - no backend search needed, unlike the ~3,800-row DMW directory). Same
free-text-first UX as the Agency name dropdown - a suggestion is always a shortcut, never a
restriction.

## Bank field: Philippine bank suggestions

Same pattern requested for "Mode of payment and mitigation"'s Bank field (bank/ATM surrendered as
security). Asked the user whether they'd supply the list or wanted a generated one; they chose the
generated common-banks list. Compiled a reference list of BSP-supervised Philippine
universal/commercial, thrift, and digital banks (`philippineBanks.ts`).

Refactored: pulled the shared free-text-plus-suggestions shell out of `SeafarerPositionCombobox`
into a new `StaticSuggestionsCombobox` component so `BankCombobox` and `SeafarerPositionCombobox`
both wrap the same implementation instead of duplicating ~80 lines twice (CLAUDE.md "avoid
duplication").

**Branch field** (also under Mode of payment): user asked about this too, but unlike Bank there is
no small, stable, enumerable list - branches number in the thousands per bank and vary by which
bank is selected, with no available verified source. Explained this and left it as free text per
the user's own choice, rather than inventing branch names.

## Export History: show who requested each export

User asked to add the requesting user's name to the Exports page's history table. Investigated
first: the existing `GET /bulk-exports` endpoint (`ListMyBulkExportJobsUseCase`) was scoped to only
the current viewer's own jobs - "My Exports," not a shared history, by original design (see that
use case's own doc comment). Asked the user whether they wanted the table widened to show every
user's exports (recommended) or just their own name added to their own rows; they chose the
former.

Implementation:
- `IBulkExportJobRepository`: replaced `findManyByRequester` with `findMany()` (every job, newest
  first, capped at 200) - the old method became fully unused once the widened listing replaced it,
  so it was deleted rather than left dead.
- New `ListAllBulkExportJobsUseCase`: fetches all jobs, resolves each distinct requester's display
  name via a batched `IUserRepository.findById` lookup (one call per unique requester, not per
  job - a handful of MIS staff account for most rows in practice).
- `BulkExportJobPresenter`: now includes `requestedByUserId` and `requestedByName`.
- Deleted the now-fully-unused `ListMyBulkExportJobsUseCase.ts`.
- Frontend: added a "Requested By" column. Deliberately did NOT loosen `DownloadBulkExportJobUseCase`
  or `CancelBulkExportJobUseCase`'s existing requester-only restriction (their own doc comments:
  "personal history, not a shared archive... not asked for; keep it narrow until requested") - only
  visibility widened, not the download/cancel authorization. The Download and Cancel buttons are
  now hidden client-side for rows some other user requested, instead of being shown and then
  rejected by the API.

## Docker build hiccup: buildkit crash, not the known "bake hang"

While rebuilding for the Export History deploy, both `docker build` commands failed with
`ERROR: failed to build: failed to run Build function: frontend grpc server closed unexpectedly` -
a different failure mode from the already-documented `docker compose build` "bake" hang
([[project_docker_compose_bake_build_hangs]]). Retrying identically failed the same way twice.
`docker ps` and every running container were unaffected - this was scoped to the build path only.

**Fix**: `docker buildx stop desktop-linux && docker buildx use desktop-linux` to restart just the
buildx builder, then retry - succeeded immediately. Cheaper than a full Docker Desktop restart
(would have taken down the live containers). Documented as a new project memory
(`project_docker_buildkit_grpc_crash`) so a future session tries this before escalating.

One container-recreate cycle also briefly showed an empty `docker logs` output and a failed host
`curl` right after recreation - resolved on its own within a few seconds (container/port-forward
still warming up, not a repeat of the [[project_stale_docker_wsl_port_forward]] issue - only one
listener was ever on port 4000 this time, confirmed via `netstat`).

## Negative Areas: MIS-configurable high-risk address list feeding pre-qualification

User provided an internal reference spreadsheet (`Negative areas.xlsx`, read via `exceljs` since
the Read tool can't open binary files directly) listing 55 high-risk addresses across 12 cities/
provinces (BULACAN, CALOOCAN, MAKATI, MANDALUYONG, MANILA, PARAÑAQUE, PASAY, PASIG, QUEZON CITY,
TAGUIG, VALENZUELA, MALABON), and asked whether a Loan Application whose address falls in this
list could be counted toward PREDECLINED automatically.

Confirmed two design decisions with the user before building (AskUserQuestion):
1. **Storage**: a real DB table with an admin management screen (not hardcoded in code, unlike the
   earlier Position/Bank reference lists - the user separately confirmed "gawin nating
   configurable" mid-build) - the list needs to stay editable by MIS without a redeploy, since
   negative areas are exactly the kind of thing that changes over time.
2. **Effect**: advisory only, same posture as the existing three pre-qualification checks (Age,
   Income vs. Loan Amount, Employment) - a match contributes to PREDECLINED, never an autonomous
   decline. Staff still review every application.

**Matching approach**: case-insensitive substring match of the applicant's raw address text
against each negative area's name - deliberately NOT geocoding. `LoanApplicationPreQualification
Service`'s own `employment` check doc comment already documents why the previous `distance`
(geocoding-based) check was removed on 2026-09-09 - free Nominatim geocoding almost never resolves
informal Philippine barangay addresses, so it was "always passing, never informative." Reusing that
lesson here rather than repeating the mistake.

**Implementation**:
- New `NegativeArea` table (`city`, `areaName`, unique on the pair) - hand-written migration
  (shadow-DB pattern), `scripts/scratch-import-negative-areas.ts` transcribes the 55 rows directly
  from the spreadsheet (idempotent upsert, dry-run by default, `--apply` to write) - 55 imported,
  verified against the source file row-by-row.
- New `negative_area.manage` permission (MIS-only by default, same posture as
  `document_template.manage`) gating a new `src/modules/negative-area/` module: list/create/delete,
  read-only pattern lifted from `interest-rate-chart`, mutable-admin pattern lifted from
  `document-templates`.
- `LoanApplicationPreQualificationService.evaluateCriteria()` gained a 4th check (`negativeArea`) -
  **N+1 avoidance was the main design constraint**: `evaluateCriteria` is called once per
  application on every list-view read (`LoanApplicationController.presentMany`, looped per row),
  so the negative-area list is now fetched ONCE per HTTP request by the controller (`present`/
  `presentMany`) and passed down as a plain array, not queried from inside `evaluateCriteria`
  itself (which stays synchronous/pure, same as before). All 6 other callers of
  `preQualificationService.classify()` (Create/Update/UpdateSelfService/UpdateIntake/Revert/
  RecheckDocumentCompleteness use cases) were updated the same way - fetch once, pass through.
- New Settings > System > "Negative Areas" tab (`negative_area.manage`-gated) - add/list-by-city/
  delete, mirrors `BulkExportsPage`'s card+table shape rather than `DocumentTemplatesTab`'s more
  complex draft-state pattern (not needed here - no toggle/mapping state, just rows).
- Verified the matching logic directly (a standalone Node script exercising `evaluateCriteria`
  before deploying): case-insensitive match found, no false positive on an unrelated address, "no
  address on record" correctly does NOT fail the check (distinct from a genuine non-match), and
  overall `status` correctly flips to PREDECLINED when a check fails.

Commits: `0a39413b` (feature), `d961ce5d` (build-info).

## Docker build hiccup, again — buildkit crash on the very next rebuild

Immediately after the Export History deploy's builds succeeded, kicking off the Negative Areas
feature's build hit the SAME `frontend grpc server closed unexpectedly` crash from earlier this
session - not a one-off. Applied the same fix (`docker buildx stop desktop-linux && docker buildx
use desktop-linux`) proactively this time before the first build attempt, and both backend and
frontend builds succeeded cleanly afterward. Worth noting this crash can recur within the same
session, not just as an isolated incident.

## System settings page: grouped left-rail navigation

Adding the Negative Areas tab pushed the Settings > System page to 9 tabs, and the existing
`TabsList` was hardcoded to `grid-cols-8` - Security wrapped onto its own second line (visible in a
screenshot the user shared). User asked for a redesign suggestion "para mag kasya ang menu...
Gawan mo ng high end, advance design," and to see a mockup first.

Built three mockup options with the visualize tool (matching the app's real navy/gold theme
tokens, not generic placeholder colors) for the user to compare side by side: (A) a grouped
left-rail nav, (B) compact icon tabs, (C) a segmented row with a "More" overflow menu. Recommended
(A) - the only option that never wraps again regardless of how many settings get added later, and
reads as the more "enterprise admin panel" pattern (Stripe/Linear/Vercel-style settings). User
asked to see a full-page version of (A) next (header + rail + Negative Areas panel as example
content) before approving - shown, then approved as-is ("ok na yan, tuloy mo").

Implemented in `SystemPage.tsx`: replaced the flat `SYSTEM_TABS` array and `Tabs`/`TabsList`/
`TabsTrigger` row with `SYSTEM_NAV_GROUPS` (two groups - "Configuration" and "Access &
monitoring" - each an array of `{ value, label, icon }`), a left-rail `<nav>` rendering those
groups as plain buttons (`w-56` fixed width at `lg:` and up, stacks full-width in a 2-column grid
below `lg:` so it still works at phone width per CLAUDE.md), plus a filter `<Input>` above the
groups that hides non-matching items/empty groups live as the user types. `SYSTEM_TABS` is now
derived (`flatMap`) from `SYSTEM_NAV_GROUPS` rather than hand-duplicated, so a future new tab is
one entry in one place. Purely a navigation-chrome change - which `SystemTab` value renders which
panel component is byte-identical to before.

Could not visually verify the authenticated page myself (same standing limitation - no login);
type-checked clean and deployed on that basis, same as every other frontend change this session.

Commits: `b5c6b539` (feature), `acea03d8` (build-info).

## Current state

- All six feature/design changes deployed and verified this session: `/health` OK, both
  containers' `build-info.json` confirmed stamped at each change's final commit, the Negative Areas
  endpoint confirmed wired (401 Unauthorized without a token, not 404), the redesigned System page
  confirmed serving (HTTP 200).
- Commits, in order: `309604a1` (agency address/contact auto-fill), `c3999bc1` (Position dropdown),
  `e19a0890` (Bank dropdown), `3a1b29d2` + `19e15a4b` (Export History requester), `0a39413b` +
  `d961ce5d` (Negative Areas), `b5c6b539` + `acea03d8` (System nav redesign).
- Not yet tested end-to-end in the live UI by me (cannot log in) - user still needs to confirm all
  six changes look/behave as expected in production: the three dropdowns, Export History now
  showing other users' exports, the Negative Areas tab (add/remove an area, then confirm a test
  Loan Application with a matching address shows the new "Negative Area" row in Decision Scoring
  and lands PREDECLINED), and the new grouped left-rail Settings nav (including the search filter).
