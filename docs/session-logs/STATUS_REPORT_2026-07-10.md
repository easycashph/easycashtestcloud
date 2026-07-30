# Easycash LMS — Project Status Report

**Date:** July 10, 2026
**Prepared by:** Claude Code (AI engineering assistant), verified against live repository/database state
**Version at time of report:** 0.9.4
**Repo state:** `main`, working tree clean, fully synced with `origin/main` (GitHub), all commits authored on this device.

---

## 1. Executive Summary

The LMS has crossed a major milestone this cycle: **every primary staff-facing page in the frontend
is now wired to the real backend**, except Settings and About (which need no backend at all). Two
weeks ago the platform was "backend complete, frontend mostly mock." Today it is a genuinely
end-to-end system — real data in, real data out, for every core lending workflow.

Alongside the wiring, a real data-quality bug was found and fixed (client addresses stored as raw
geographic codes instead of names), and the frontend's performance problem (loading entire datasets
on every page) was resolved with real pagination.

**Bottom line: on track.** No blocking issues. The remaining gaps are known, scoped, and listed in
§4 below — none of them block day-to-day use of the system for its core purpose (loan origination,
servicing, collections, reporting).

---

## 2. Backend Status

**Architecture:** Clean Architecture (domain → application → infrastructure → interface), enforced
via ESLint. 15 modules total.

| Module | Status | Notes |
|---|---|---|
| `identity` | ✅ Complete | Login, refresh, logout, RBAC (6 roles). Rate-limited (relaxed in dev only). |
| `identity` (user admin) | ✅ Complete | List/create/update LMS staff accounts — added this cycle. |
| `borrower` | ✅ Complete | Full CRUD + **update** (added this cycle, was create-only before). |
| `loan-product` | ✅ Complete | Full CRUD, versioned — editing a product never touches historical loans. |
| `loan-account` | ✅ Complete | Full lifecycle: create → approve → activate → payments. Optimistic concurrency. |
| `loan-application` | ✅ Complete | Intake → review → assign product → approve/decline/revert. Added this cycle. |
| `ledger` | ✅ Complete (read-only, by design) | Per-loan transaction history. |
| `repayment` | ✅ Complete (read-only, by design) | Per-loan installment schedule. |
| `dashboard` | ✅ Complete | Portfolio-wide summary aggregates. Added this cycle. |
| `payment-reminder` | ✅ Complete | Cross-loan "next due installment" worklist. Added this cycle. |
| `reporting` | ✅ Complete | Loan origination, collections, transaction reports. Added this cycle. |
| `audit` | ✅ Complete | Read API over the audit trail (was write-only/unexposed before). Added this cycle. |
| `psgc` | ✅ Complete | Philippine address reference data (region/province/city/barangay). Added this cycle. |
| `document` | ⏸ Scaffolded only | Not yet built — no document-generation/storage endpoints exist. |

**Test suite:** 525 tests passing, 7 intentionally skipped, 82/83 test files (1 integration file
skipped — requires a live DB in a mode not enabled in this environment). `tsc --noEmit` clean.

**Data quality:** Legacy migration (CP12, completed 2026-07-08) brought in 43 loan products, 4,604
borrowers, 1,777 loan accounts, 279,490 transactions. This cycle found and fixed a real defect in
that migrated data: ~68% of borrower addresses had been stored as raw PSGC codes instead of place
names (e.g. province `"1375"` instead of `"CAVITE"`) — root cause was the legacy system itself
having two address-entry paths. Fixed 940 of 944 affected records by importing the official PSGC
reference tables and decoding against them; 4 records had unresolvable codes and were left untouched
rather than guessed at.

**Known backend gaps:**
- No `GET /branches` endpoint — every migrated record currently belongs to one seeded branch ("Head
  Office"), so this hasn't blocked anything yet, but it means no page can offer a real branch picker.
- Five calculation edge cases remain deliberately unresolved pending legacy evidence (Flat-Rate
  interest, overpayment handling, penalty formula, maturity-capitalization, reversal/adjustment) —
  documented in `CALCULATION_ENGINE_SPEC.md`, not guessed at.
- `document` module is scaffolded but not implemented — no backend-generated PDFs yet (Promissory
  Note, Disclosure Statement, etc. are currently attachments only, not generated).

---

## 3. Frontend Status

**Wired to real backend (12 of 12 core pages):** Login, Dashboard (core metrics), Loan Applications,
Loan Accounts, Client Data, Loan Products (read-only), Payment Recording, Statement of Account,
Activity Logs, Member Details, Payment Reminders, Loan/Collection/Transaction Reports.

**Mock only, by design (no backend needed):** Settings, About.

**Partially wired (real backend for the core record, some sub-features still mock):**
- Dashboard: Overview cards are real; Portfolio Growth, Quality Metrics, disbursement/collections
  charts, and the Recommendation panel are still sample data (no backend source yet).
- Client Profile: personal info, address, and loan history are real; Attachments and "Create Loan
  Account from this client" are still mock (the latter needs a loan-application eligibility check
  the backend doesn't expose yet).
- Loan Detail / Statement of Account: real for migrated (UUID) loan accounts; some sub-features
  (notes, AI risk assessment, payment history timeline) remain mock.

**This cycle's frontend work:**
- Real, server-side search (debounced) on Client Data, Loan Applications, Loan Accounts, Member
  Details, Activity Logs — previously these searched only whatever was already loaded in the browser.
- Real pagination (100 rows/page, Next/Previous) on the same 5 pages — replaces "load the entire
  dataset on every page view," which was the direct cause of the reported frontend lag.
- Cascading Region → Province → City/Municipality → Barangay address picker, replacing free-text
  address entry (the fix for the root cause of the address data-quality bug above).
- Official platform name, "Easycash Loan Management System Platform," now shown in the app header
  and login page (previously placeholder "Digital Lending Platform" copy).
- Local dev launcher (`Run LMS Preview.bat`) fixed to reliably claim port 5173 for hot-reload,
  and the app now shows a visible "Hot Reload" badge so it's obvious which frontend (local dev vs.
  the Docker-served build) is being viewed.

**Verification method this cycle:** `tsc --noEmit` clean on every change; most features verified
live in-browser (login, create/edit flows, pagination, search); a few late-session changes were
verified by direct repository/API checks instead of full browser click-through, due to the login
rate limiter tripping from repeated manual testing (now relaxed in dev — see below).

---

## 4. Infrastructure & Deployment

- **Local dev:** hot-reload frontend on port 5173, backend via `npm run dev` or Docker on port 4000.
- **Docker:** `docker compose` builds both `backend` and `frontend` images; fixed this cycle
  (Prisma/OpenSSL musl incompatibility, host `node_modules` leaking into the build via missing
  `.dockerignore`). Both containers verified healthy and serving current code.
- **Database:** Local dev Postgres (also the DB the Docker `postgres` container serves, on the same
  host port) — single shared database across both deployment modes on this machine.
- **Known infra gaps:**
  - Frontend production build produces a single ~1MB JS chunk (Vite warns on this) — no code
    splitting yet.
  - Login rate limiter is now relaxed in `development` mode specifically (1000 attempts/15 min
    instead of 8) to stop it from blocking normal testing; unchanged and still strict in
    `production` and in the automated test suite.
  - No CI pipeline currently runs `tsc`/tests automatically on push — verification this cycle was
    manual (`npx tsc --noEmit`, `npx vitest run`) before every commit.

---

## 5. Team

| Name | Role | Focus |
|---|---|---|
| Howell Hay | CEO | Product Manager — vision/direction for the LMS |
| Jomer Biason | MIS Assistant | Full-stack Engineer |
| Nomer Perez | MIS Manager | Quality Assurance Engineer |

---

## 6. Recommendation

The project is in good shape to keep moving at the current pace. The highest-value next steps are
listed as this week's daily goals in `docs/DAILY_GOALS_LOG.md` — starting with closing the loop on
today's Docker work and hardening the deployment before adding more feature surface.
