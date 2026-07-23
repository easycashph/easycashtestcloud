# Session Log — 2026-07-23: Dashboard live-data finish, color redesign, missing-migration outage fix

## Context

Continuation of the same 2026-07-23 working day (see the git history around
`4057fd9` for the earlier morning's legacy migration, dashboard drag-to-reorder,
and disbursement fee-breakdown work). This session picked up mid-task: finishing
the "make the Dashboard fully live" effort, then a color/design pass the user
asked for, then an unrelated but serious bug the user noticed on a client
profile page.

## 1. Dashboard: Portfolio Growth and Collections vs. Target now real data

Both were previously hardcoded/sample values on the Dashboard's Overview cards.

- **Portfolio Growth** — now a real month-over-month disbursement percentage
  (reusing the existing `buildRealDisbursementTrend` helper), replacing the
  static `+4.8%`. Shows `—` / "Not enough disbursement history yet" when there's
  no prior-month baseline to compare against.
- **Collections vs. Target** — target line is now a real trailing 3-month
  rolling average of historical monthly collections (user's explicit choice via
  AskUserQuestion: "Auto-computed mula sa historical average"), replacing the
  hardcoded `COLLECTIONS_VS_TARGET` sample array.
- Updated `PreviewBanner.tsx`'s two disclaimer variants (`PreviewBanner` banner
  and `PreviewFooterNote` footer) to drop the now-resolved "Collections vs.
  Target chart" caveat, keeping only the still-accurate SMS/Email-sending one.

Files: `app/frontend/src/pages/DashboardPage.tsx`, `app/frontend/src/components/PreviewBanner.tsx`.
Commit: `d0e369f`.

Verified: `tsc --noEmit` clean both times the file was touched, Docker frontend
rebuilt twice (the second time after catching that `PreviewFooterNote` still had
the stale text — the banner and footer are two separate components with near-
duplicate copy, easy to update one and miss the other), confirmed live via
browser navigation + `get_page_text`/`javascript_tool` reads (screenshots aren't
available in this environment — the Browser pane reports "not displayed, so the
page is not compositing frames" for every `computer{screenshot}` call).

## 2. Dashboard color/design pass ("more advance and sophisticated")

User's honest ask after seeing a live screenshot: the all-emerald palette
(every stat card, every chart, every positive number in the same green) read as
generic and undisciplined, not "one hero color, everything else quiet."

- Mocked up 3 directions (A: deep indigo, B: charcoal + muted gold, C: refined
  teal/slate close to the existing brand) in both dark and light mode via
  `mcp__visualize__show_widget` before writing any code — user picked **light-
  mode direction C**.
- Implemented as: `SummaryCard` gained a `highlight` prop (border-primary/40 +
  bg-primary/5 tint, primary-colored title/value/hint) applied to exactly one
  card — **Portfolio Growth**, the designated "hero" metric. The other 3 stat
  cards stay neutral. Commit `a1e3672`.
- Extended the same "one accent, not a rainbow" discipline to every chart on
  the page: Disbursement Trend bar, Collections vs. Target's "actual" line,
  Collections Forecast line, and both Reports-preview sparklines previously
  each used a different arbitrary `--chart-N` hue (blue/gold/purple). All
  switched to `hsl(var(--primary))` so the whole page reads as one palette.
  Commit `3925614`.
- **Deliberately left untouched**: Portfolio Breakdown bars, Loan Portfolio
  Health Venn diagram, and the Recommendation plan cards — these use
  success/warning/destructive to encode real states (Active/Past Due/Matured,
  Good/Arrears/Matured), not decoration, so recoloring them would remove
  meaning rather than noise. Also left the Loan Application Pipeline funnel's
  blue→green stage gradient alone — a deliberate progression encoding already
  approved by the user in an earlier (2026-07-17) session.
- Used the existing `--primary` CSS variable (not a hardcoded hex) throughout,
  so the highlight/chart accent still tracks whichever Theme Color preset
  (emerald, Easycash blue, custom) is active, in both light and dark mode.

Files: `app/frontend/src/pages/DashboardPage.tsx`.

## 3. Bug found: `/loan-applications` list endpoint 500ing entirely — missing Prisma migrations

While checking why a specific client ("TESTNOMER TESTNOMER TESTNOMER") showed
no attachments, found the real, much bigger problem underneath: the Client
Profile page's "Loan Applications" section said **"No loan applications on
record for this client"** for a client who very much had one (confirmed
directly in Postgres — the application → borrower → loan account link chain
was completely intact, and 6 attachments existed under
`ownerType='LOAN_APPLICATION'`).

**Root cause**: `GET /api/v1/loan-applications` was returning 500 for
*everyone*, not just this client. Backend logs showed:

```
PrismaClientKnownRequestError: Invalid `client.loanApplication.findMany()` invocation
The column `loan_applications.portalAccountId` does not exist in the current database.
```

This traces back to the earlier `4057fd9` merge of another session's "Easycash
Portal Phase 2" branch. `npx prisma generate` was run after that merge (so the
generated Prisma Client matched the new `schema.prisma`), and `npx tsc --noEmit`
+ the backend test suite were both re-verified clean at the time — but the
actual database migrations that add the new Portal-related columns/tables were
never applied to this Docker Postgres instance. `npx prisma migrate status`
confirmed 3 pending migrations:

```
20260723013904_add_easycash_portal_phase1
20260723041640_add_portal_account_id_to_loan_application
20260723054635_add_portal_otp_settings
```

Since the Prisma Client (generated from the newer schema) expected
`portalAccountId` to exist and the live table didn't have it yet, every
`loanApplication.findMany()` call failed — which cascades into every page that
lists loan applications (Client Profile's "Loan Applications" table, its
merged Attachments panel, and likely the Loan Applications list page itself).

**Fix**: ran `npx prisma migrate deploy` inside the backend container. All 3
migrations are additive only (new columns/tables for the Portal feature, no
drops or destructive alterations to existing data) — applied cleanly.
Restarted backend, confirmed live: `GET /loan-applications` now returns 200,
the client's application row reappeared, and all 6 attachments (tagged "From
application") now render correctly on the Client Profile page.

**Lesson for future merges**: regenerating the Prisma Client
(`npx prisma generate`) only syncs the *type-safe query builder* with
`schema.prisma` — it does **not** touch the actual database. After merging any
branch that changes `schema.prisma`, always also run
`npx prisma migrate status` (and `migrate deploy` if anything's pending)
against every environment that will run the merged code, not just the one
where `.env` happened to already have the new required env var. `tsc --noEmit`
and the test suite passing is not sufficient proof — Prisma tests typically run
against a schema that's pushed directly via `migrate deploy`/`db push` in CI,
which can mask a real deployed-environment gap like this one.

## Current state

- Dashboard Portfolio Growth and Collections vs. Target: real data, live,
  committed, verified.
- Dashboard color pass (hero stat card + unified chart accent): committed,
  verified in both light and dark mode via the real in-app theme toggle (not
  a `classList` hack — an earlier manual `document.documentElement.classList
  .remove('dark')` test produced misleading stale `getComputedStyle` reads on
  2 of 4 cards; re-verified through Settings > Appearance's actual toggle and
  the numbers were correct all along).
- Missing-migration outage: fixed on this Docker environment. **Not yet
  pushed** — none of this session's commits have been pushed to remote yet.
- Not yet done: the Dashboard's "AI Recommendation" card is still a static
  mock (`AI-Assisted... This output is a static mock`) — unresolved, blocked
  on an Ollama-vs-Claude-API infrastructure decision from an earlier
  conversation.

## Follow-up worth flagging

- Any *other* deployment/environment this codebase runs on (a second Docker
  host, staging, production once it exists) needs the same 3 migrations
  applied — `npx prisma migrate deploy` — before the Portal merge's code is
  actually safe to run there. This session only fixed the one Docker instance
  used for local verification.
