# ADR-051 — Loan Document Generation (Disclosure Statement, Promissory Note, and Related Legal Documents)

**Status:** ACCEPTED — scope, document classification, template format, generation stack, and UI
confirmed directly with the user (2026-07-12 session). Implementation in progress (schema landed;
generation pipeline and UI are follow-up milestones — see §9).

**Context documents:** `legacy/Excel LMS Files/Templates/` (12 current `.docx` templates — the
user's own curated, current set; source of truth for wording, already cross-checked against real
Disclosure Statement/Promissory Note PDFs earlier this session); legacy MongoDB
`document_templates`/`document_template_mappings` collections (507/502 records — historical
Mambu/SDevTech HTML template archive, investigated and deliberately NOT used as a migration source
— see §6); the previously-scaffolded, unused `DocumentTemplate`/`DocumentTemplateMapping` Prisma
models from the initial migration (`20260702000000_init`) — repurposed here (§7).

---

## 1. Scope — 11 of the 12 templates, classified into required vs. conditional

Confirmed with the user:

| Document | Classification |
|---|---|
| Disclosure Statement | **Required** — every loan |
| Promissory Note | **Required** — every loan |
| Acknowledgement Receipt | **Required** — every loan |
| Data Privacy and Consent Form | **Required** — every loan |
| Loan Agreement - Salary | Conditional — per Loan Product |
| Loan Agreement - Seafarer | Conditional — per Loan Product |
| Deed of Assignment - Borrower | Conditional — per Loan Product |
| Deed of Assignment - Co-Borrower | Conditional — per Loan Product |
| Deed of Assignment - Salary | Conditional — per Loan Product |
| Special Power of Attorney | Conditional — per Loan Product |
| Manulife | Conditional — per Loan Product |
| Statement of Account | **OUT OF SCOPE for this feature** — different lifecycle (see below) |

All conditional documents share the same basis: which one(s) apply is a property of the **Loan
Product**, not of the borrower's employment status or manual per-loan choice (confirmed directly
with the user). This is data (`DocumentTemplateMapping`, §3), not code.

Statement of Account is excluded because it is requested on demand at any point during a loan's
life (a servicing/collection document), not generated once after approval like the other 11 — it
is a separate feature, not addressed by this ADR.

## 2. Trigger point, template format, and edit workflow

- Available for generation once a loan reaches **APPROVED** status (before ACTIVATE) — the loan's
  terms are final at that point; no need to wait for disbursement.
- Source templates are `.docx` files with `{Placeholder}`-style merge fields, hand-edited by the
  user directly in Microsoft Word — **not** auto-generated or reverse-engineered by this tooling.
  Stored at `app/backend/templates/*.docx`, git-tracked (blank templates only, no PII, distinct
  from the gitignored `legacy/Excel LMS Files/` which holds real client documents).
- **Edit workflow (chosen over an in-app upload UI — see §9):** to change wording, open the
  `.docx` in Word, edit the surrounding legal text, save, then a developer replaces the file in
  the repo and redeploys. Placeholders must not be renamed/removed without updating the
  corresponding code that fills them.
- Editing a template never affects documents already generated for existing loans — each
  generation is its own permanent record (§3). This mirrors the LPV-1/LA-4 immutable-snapshot
  philosophy already used for Loan Products (an approved loan's rules don't change when the
  product is edited later).

## 3. Data model

```
DocumentTemplate           — one row per document type (11 total: 4 required + 7 conditional)
DocumentTemplateMapping    — (loanProductId, documentTemplateId): which CONDITIONAL templates
                              apply to which Loan Product. Required templates never get a row
                              here — they apply universally and are resolved in code.
GeneratedLoanDocument      — one row per generation event
```

`GeneratedLoanDocument` is **append-only**: "Regenerate" in the UI always inserts a new row rather
than overwriting an existing one, matching this project's ledger philosophy already used for
`LoanTransaction` (TXN-1), `LoanNote`, and `PaymentAllocation`. The Documents tab shows the latest
generation per template for a loan, with earlier ones retained as history — important for
compliance, since a borrower may already have been shown or signed an earlier version and that
fact must not be erased by a later regeneration (e.g. after a data correction).

## 4. Generation stack

- **`docxtemplater`** (Node.js, open-source, MIT-compatible core) — loads the `.docx`, fills
  `{Placeholder}` fields from loan/borrower data. No paid service, no external API call.
- **LibreOffice headless** (`soffice --headless --convert-to pdf`), invoked from the backend
  container — converts the filled `.docx` to the final PDF. Free and self-hosted, consistent with
  CLAUDE.md's low-cost/Docker-first deployment philosophy.
- Output stored via the existing local storage abstraction (`app/backend/storage/`, DOC-3),
  referenced from `GeneratedLoanDocument.storageKey` — same pattern as `Attachment.storageKey`.

## 5. UI

New **Documents** tab on the Loan Detail page, alongside Repayment Schedule, Notes, etc. (mockup
reviewed and approved with the user before this ADR was written):

- "Generate all required" bulk action for the 4 universal documents.
- Per-document checkboxes + "Generate selected" for conditional documents applicable to the
  loan's product.
- Each generated document row shows generated-by / generated-at, Download, and Regenerate
  (inserts a new `GeneratedLoanDocument` row, per §3 — never overwrites).

## 6. Why the legacy Mongo `document_templates` / `document_template_mappings` data was NOT used as a migration source

Investigated directly (2026-07-12) because, at first glance, it looked like a ready-made answer to
"which documents go with which loan product," which would have removed the need to ask the user to
classify §1 by hand.

- **507 `document_templates` rows resolve to only 365 distinct names** — a ~7-year (2018–2025)
  accumulation of near-duplicate variants per historical loan-product code and delivery channel
  (`(OLD)`, `DIGISIGN`, `DGTL`, `OTP`, `65px`/`75px`/`85px` layout variants, etc.), not a clean
  current-state set.
- **`document_template_mappings` has 502 rows referencing 49 distinct `loan_product_uid`
  values — none of which match any of the 44 `LoanProductVersion.legacyId` values already
  migrated into this system** (verified by direct join, zero matches). The mapping references an
  older/parallel Mambu-era product catalog that predates or diverged from the SDevTech
  `loan_products` collection this system actually migrated (`CP12_LEGACY_MIGRATION_DESIGN.md`).
  Reconciling old UID → current product would require guessing product-code fragments embedded in
  template names (e.g. matching `"(SML-REG)"` in a template's name to today's `SML-REG` product)
  — a real judgment call, not something to automate silently, and not attempted here (CLAUDE.md:
  never invent business rules; never guess).
- The `{CF:hex-uid}` custom-field placeholders reference an internal Mambu custom-field ID scheme
  with no visible definitions collection anywhere in this dump — decoding what each one means
  would require further legacy archaeology with no guaranteed clean answer.
- The wording itself (Disclosure Statement, Promissory Note) matches what was already verified
  against real, current PDFs earlier this session — so this data is used only as a **secondary
  cross-check** that the user's own 12 curated `.docx` templates haven't dropped a clause, never
  as the template source itself.

**Disposition:** the user's 12 current `.docx` templates (§1/§2) remain the sole source of truth.
The legacy Mongo data is left untouched — not migrated, not deleted, available for future
reference only.

## 7. Repurposing the existing (unused) `DocumentTemplate` / `DocumentTemplateMapping` models

These two tables existed since the very first migration (`20260702000000_init`), scaffolded in
anticipation of migrating the legacy `document_templates` collection directly (`contentHtml:
String`, `legacyId` as the natural upsert key — see `CP12_LEGACY_MIGRATION_DESIGN.md` §1). Nothing
in `app/backend/src` ever referenced them: zero rows, zero code paths, confirmed by search before
this change. Per §6's disposition, that migration is not happening, so this ADR repurposes the
same table names for the new design (§3) — `contentHtml`/`isActive`/`legacyId` dropped, replaced
with `code`/`isRequired`/`sortIndex`/`updatedAt` — rather than leaving dead scaffolding sitting
beside a second, differently-named pair of tables.

Migration: `20260712132904_add_loan_document_generation` (schema diffed directly against the live
dev database rather than via `prisma migrate dev`, which requires an interactive terminal not
available in this session; same net effect).

## 8. Placeholder naming (first two documents, for the user's reference while editing in Word)

Borrower/loan identity: `{BorrowerName}`, `{LoanAccountId}`, `{LoanProductName}`,
`{ApprovalDate}`/`{DisbursementDate}`, `{MaturityDate}`, `{BranchName}`.

Disclosure Statement: `{PrincipalAmount}`, `{ProcessingFee}`, `{AdvanceInterest}`,
`{AccountManagementFee}`, `{DocStamp}`, `{OutstandingBalance}`, `{Others}`, `{NetProceeds}`,
`{LateChargesRate}`, `{AttorneysFeeRate}`, `{LitigationFee}`.

Promissory Note: `{PNNumber}`, `{LoanAmountFigures}`, `{LoanAmountWords}`, `{InstallmentAmount}`,
`{NumberOfInstallments}`, `{FirstDueDate}`.

Placeholder names for the remaining 9 templates to be finalized once the user has worked through
Disclosure Statement and Promissory Note and confirmed this naming convention works for them in
Word.

## 9. Deferred (not built now)

- **In-app template upload/management UI for Admin/MIS** — would let template content be updated
  without a code deployment. User explicitly chose the simpler "edit in Word, developer replaces
  the file" workflow for now (§2); revisit if edits turn out to be frequent enough to justify the
  extra engineering.
- **Statement of Account generation** (§1) — different on-demand lifecycle, separate feature.
- **Per-Loan-Product `DocumentTemplateMapping` seed data** — which conditional documents apply to
  which of the current Loan Products has not yet been entered; §6 ruled out inferring it from
  legacy data, so this needs to be confirmed with the user product-by-product, likely via a small
  admin UI or a one-time confirmed data entry pass, before conditional-document generation can work
  end-to-end. The 4 required documents do not depend on this and can be built first.
- **The generation pipeline itself** (docxtemplater + LibreOffice + storage wiring), the HTTP
  endpoints, and the Documents tab UI (§4/§5) — next implementation milestones, deliberately not
  built in the same step as the schema, per this project's incremental-delivery practice. Also
  blocked on the user finishing placeholder edits in the actual `.docx` templates (§2/§8) for
  genuine end-to-end testing, though the pipeline code itself can be written and unit-tested
  against a synthetic fixture in the meantime.
