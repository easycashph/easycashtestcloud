# Session Log — 2026-09-14 — Docker/WSL2 Outage Recovery + Bulk Export Race Condition + Agency Dropdown

**Machine:** Office Server PC
**Requested by:** Nomer Perez

## Summary

Two related incidents in one session, both traceable to the same underlying event: the machine (or
Docker Desktop) had restarted roughly a day earlier, and a stale WSL2 port-forward relay never got
cleaned up, leaving the live LMS unreachable and, separately, corrupting the outcome of a
long-running database export job.

## Incident 1: Live site unreachable ("bakit hindi ako makalogin sa live?")

Diagnosed in stages:
1. `docker ps` showed every container (including `postgres`, normally up for days) at the same low
   uptime - a strong signal the whole Docker Desktop stack had restarted, not just one service.
2. `curl http://localhost:4000/health` failed even from the host itself (not just through the
   Cloudflare tunnel) - ruled out a tunnel-only problem this time.
3. `netstat -ano | findstr :4000` showed **two** listeners: the legitimate
   `com.docker.backend.exe` and a stale `wslrelay.exe` bound to `[::1]:4000` - the exact
   `[[project_stale_docker_wsl_port_forward]]` pattern, but this time killing the one stale relay
   wasn't enough.
4. `docker compose exec easycashbackend wget -qO- localhost:4000/health` succeeded **from inside
   the container** - confirmed the app itself was perfectly healthy; the break was purely in the
   Windows-to-WSL2 port-forwarding path.
5. `wsl --shutdown` (user approved in advance, full LMS downtime while it cycled) forced a clean
   WSL2 restart - but a **new** stale `wslrelay.exe` immediately reappeared on the same port after
   Docker Desktop reconnected, and the underlying forward still didn't work even after killing that
   one too.
6. Fully quit and relaunched Docker Desktop itself (`taskkill /F /IM "Docker Desktop.exe"`, then
   relaunched the executable) - this time the port-forward came back clean, single listener, no
   duplicate relay, host `curl` succeeded immediately.
7. Restarted the Cloudflare quick tunnel (killed separately, `especially-classics-...` was long
   dead) via `scripts/Start Cloudflare Tunnel (Auto-Update).ps1` - new URL
   `warned-munich-term-filled.trycloudflare.com`, verified reachable, Cloudflare Pages
   auto-redeployed (`559b4dbe`, active).

**Takeaway for next time**: a single `wsl --shutdown` did not fully clear this particular stale
port-forward state - a full Docker Desktop app restart was what actually fixed it. Worth trying the
full app restart sooner next time this exact symptom (host-side curl fails, in-container curl
succeeds, duplicate `wslrelay.exe` on the affected port) recurs, rather than assuming `wsl
--shutdown` alone will be enough.

## Incident 2: "Ano status ng database export? Ngayon" - a completed job stuck reading PROCESSING

User asked to check on a running database export. Found it reading `PROCESSING` at 63/76 tables
with no forward progress over an 8-second poll. Investigated rather than assuming it was simply
slow:

- `pg_stat_activity` showed **zero** active queries - no `COPY`/dump query actually running.
- No `pg_dump` process existed inside the container (`ps aux` came up empty).
- The result `.zip` file already existed at ~29.4MB, matching the size of previous genuinely
  completed dumps almost exactly, with no further size growth.
- A `notifications` row for `BULK_EXPORT_READY` / "Export ready" **had already fired** for this
  exact job's `entityId`, timestamped only ~4 seconds after the job record was created - impossible
  for a real dump of this size, but only explainable if `notifyUser` really did run (which only
  happens after `markCompleted()` succeeds inside `runDatabaseDump`).
- Extracted the `.dump` file from the zip and ran `pg_restore --list` against it directly - parsed
  cleanly all the way through the last foreign-key constraint, no truncation. **The dump itself was
  genuinely complete and valid.**

**Root cause**: `runDatabaseDump`'s per-table progress saves were fired as
`void bulkExportJobRepository.save(job).catch(...)` - unawaited, no ordering guarantee against the
final `markCompleted()` + `save()` call at the end of the same function. A progress save queued
just before the dump finished (plausible to have been delayed by the same Docker/WSL2 networking
instability from Incident 1, which was still being resolved around this same time) had its DB
round-trip land **after** the completion save's, silently overwriting the row back to a stale
`PROCESSING`/63 snapshot even though the job had genuinely finished and already notified the user.

**Fix** (`ProcessBulkExportJobUseCase.ts`, commit `431355df`): every save for a database dump job -
each progress update and the final completion save - is now enqueued onto one `Promise` chain
(`progressSaveChain`) instead of being fired independently. Because chained `.then()` callbacks
always execute in the order they were attached, the completion save (attached last, only once the
process has fully closed) is guaranteed to be the last write that actually lands in Postgres,
regardless of how individual round-trip latencies happen to vary.

**Data correction**: manually updated job `a64e7b80`'s row to `COMPLETED` (verified-good file, not
a guess) via a one-off script, run and then deleted - not part of the committed fix, since it only
applied to this one already-produced, already-verified result.

## Incident 3 (not an incident - a feature request): real PMT formula for Loan Application DTI

User revisited an earlier-deferred question: could the Loan Application stage's DTI/pre-screening
amortization estimate use the same Declining-Balance PMT formula
(`AmortizationScheduleGenerator`) a real, booked `LoanAccount` uses, instead of the simplified
flat add-on-rate approximation (`computeFlatRateAmortization`) used until now?

The blocker identified earlier (no `LoanProductVersion`/Contractual Rate assigned yet at the point
DTI is computed - that only happens later, at PRE_APPROVAL) still holds, but a workable path
opened up: a real `LoanAccount`'s Contractual Rate is itself a **lookup** from `interest_rate_chart`
by (Add-On Rate, Term), not a fixed per-product constant - and the DTI estimate already assumes a
3.0%/month Add-On Rate (the same one `loanCategoryFlatRates.ts` used). Queried the live
`interest_rate_chart` table for that exact 3.0% row set (terms 1-12, full coverage confirmed
against every `requestedTermMonths` on record) and embedded it as a verified, real-data snapshot in
a new file (`loanApplicationContractualRates.ts`), rather than threading a DB call into
`LoanApplicationPreQualificationService.evaluateCriteria()` (deliberately pure/no-I/O, so the
Detail page can show a live breakdown on every read with no extra round-trip).

`computeEstimatedAmortization()` now looks up the real contractual rate for the requested term and
feeds it into the exact same `AmortizationScheduleGenerator.generate()` a real loan account's own
amortization schedule runs - not a re-implementation, the same class. Verified before shipping:
computed old-flat vs new-PMT for 4 real applications - all within a few pesos of each other (as
expected for short terms under the same add-on assumption), confirming the formula swap didn't
introduce a wild discrepancy. Commit `00cbce84`.

**Known limitation, documented in the new file's own doc comment**: the embedded rate snapshot is
a manual copy of `interest_rate_chart`'s 3.0%-add-on rows as of 2026-09-14 - if that table's data
changes later, this snapshot needs a manual re-sync (no automatic link). Term coverage is 1-12
months; a requested term outside that range throws rather than silently extrapolating.

## Feature: DMW-licensed recruitment agency dropdown for Seafarer Loan applications

User asked what could turn the Loan Application Detail page's free-text "Agency name" field
(Seafarer Loan's "Agency / contract / allotment verification" section, editable only while the
application is `UNDER_REVIEW`) into a dropdown sourced from the Department of Migrant Workers
(DMW)'s own licensed-recruitment-agency directory - staff currently type this by hand with no way
to cross-check spelling or license status against DMW's records.

**Checked for an API first** - none exists. WebSearch/WebFetch found no public DMW API; live
browser inspection of `https://dmw.gov.ph/licensed-recruitment-agencies` (a Nuxt SPA) showed every
network request was a static build asset, no XHR/fetch backing the table - the entire ~3,794-row
dataset is server-rendered and paginated client-side (50/page, 76 pages) with nothing to call
directly.

**Page-size and filter workarounds both failed, on DMW's own site, not on our end**:
- No page-size control exists (no `<select>` element; forcing `?perPage=500` via URL broke the
  SPA's client routing).
- The site's own "Active License" status filter returned "No matching agencies found" despite
  1,103+ agencies literally carrying the status text "Valid License" in the underlying data - a
  genuine bug on DMW's side, verified directly, not something fixable from our side.

Given both, user chose: download all 76 pages and filter after import ourselves rather than rely
on DMW's broken filter.

**Extraction technique** (browser automation, no manual per-page clicking): a single async
JavaScript snippet run via the browser tool's JS-exec action looped all 76 pages - clicking the
"Next Page" button and waiting ~450ms between clicks - collecting each page's rows into a
persistent global array (survives the SPA's client-side navigation, since no full reload occurs
between pages). Captured all 3,794 rows in one run. The "Download CSV" button itself was unusable
here (client-side blob generation, no request to capture, and downloads are blocked in the
sandboxed browser anyway).

**What shipped**:
- New `LicensedRecruitmentAgency` Prisma model/table (`name`, `address`, `contactName`, `phone`,
  `licenseNumber`, `status`, indexed on `name` and `status`) - migration hand-written (not
  `prisma migrate dev`, which hangs on this machine's shadow DB - established pattern), applied via
  `prisma migrate deploy`.
- One-time idempotent import script (`scripts/scratch-import-dmw-agencies.ts`), imported all 3,794
  rows from the captured JSON snapshot (`scripts/data/dmw-licensed-agencies-2026-09-14.json`),
  verified via row count.
- Read-only backend search module (`src/modules/licensed-recruitment-agency/`, Clean Architecture:
  port → use case → Prisma repo → controller → router), `GET /api/v1/licensed-recruitment-agencies?q=`,
  case-insensitive substring match, requires 2+ characters, capped at 20 results, open to any
  authenticated role (every role may need to verify an agency, not just underwriters).
- Frontend `AgencyNameCombobox` (modeled on `GlobalSearch.tsx`'s existing hand-rolled dropdown
  pattern - no Radix Popover in this codebase) - debounced search, shows each match's address and a
  status badge (green for the 4 "currently valid" status strings, red for everything else - DMW's
  vocabulary has 18 distinct status values, not a fixed enum). **Deliberately still a free-text
  input** - selecting a suggestion just fills in the exact DMW-recorded name; an agency newly
  licensed after this snapshot, or missing for any other reason, never blocks staff from recording
  what's actually on the applicant's documents.
- Wired into `LoanApplicationDetailPage.tsx`'s existing `AGENCY_CORE_FIELDS` loop, replacing the
  plain `<Input>` only for the `agencyName` field.

Both backend and frontend type-checked clean (`tsc -b`, zero errors). Commits `725762cf` (feature)
and `6295b728` (build-info stamp).

**Known limitation, matching the PMT snapshot above**: this is a point-in-time capture
(2026-09-14) of DMW's directory, not a live sync - an agency's status can change on DMW's site
without this table updating. No refresh mechanism built yet; re-running the same
browser-automation capture + `scratch-import-dmw-agencies.ts --apply` is the manual path if a
refresh is ever needed.

## Current state

- All three incidents/features resolved and deployed: live site reachable, tunnel healthy,
  `easycashbackend` rebuilt with the export race-condition fix, the real-PMT DTI formula, and the
  agency dropdown feature; `lmsfrontend` rebuilt with the agency dropdown UI. Both containers
  recreated and verified healthy (`docker ps` uptime reset, `/health` OK, `build-info.json` inside
  the running backend container confirmed stamped `725762cf`).
- The previously-stuck database dump job is now correctly `COMPLETED` and downloadable.
- Pulled two doc-only commits from Macbook Nomer during this session (merge commit `9987852a`) -
  no source code came in, confirmed via `git diff --stat` scoped to the three `src/` trees before
  skipping a redundant rebuild. Later in the session, also pulled a portal-frontend redesign batch
  from another machine (`de92a415`) before pushing the agency feature - unrelated files, no
  conflict.
- Not otherwise investigated: whether the SAME race condition exists in `runAttachmentExport`'s
  progress-saving loop. That loop's saves are `await`ed directly inside the `for` loop (not
  fire-and-forget), so it's structurally different and likely not affected - but wasn't explicitly
  re-verified this session.
- **Not yet tested end-to-end in the live UI** (cannot log in / cannot test authenticated flows
  myself) - user still needs to try the new Agency name combobox on a Seafarer Loan application
  under review to confirm it looks/behaves as expected in production.
