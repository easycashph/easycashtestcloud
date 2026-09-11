# Session Log — 2026-09-11 — Attachment Filename Cleanup (SL-CORP_00135 + August 2026 Releases)

**Machine:** Office Server PC
**Requested by:** Nomer Perez

## Summary

Two related asks in one session: fix attachment filenames on loan account SL-CORP_00135, then do
the same content-verified cleanup across all loan accounts released in the "8 AUGUST 2026" Google
Drive folder. Both required opening every attachment's actual file content and comparing it
against its current label before renaming — never trusting an existing filename at face value.
This surfaced real anomalies that a naive prefix-stripping rename would have missed.

## Part 1 — SL-CORP_00135

- Verified all 12 attachments by reading their content. Found 2 real anomalies: a Proof of Billing
  belonging to a different person, and a likely-duplicate Disbursement Letter/Selfie Photo pair.
  Reported to the user, who chose to keep names as-is (no deletion).
- Renamed the 12 attachments to clean display names
  (`scripts/scratch-rename-sl-corp-00135-attachments.ts`).
- User then reported the rename "didn't seem to take" in the UI. Root cause: `AttachmentsPanel.tsx`
  renders `documentCategory`'s label instead of `fileName` whenever `documentCategory` is set. 10 of
  the 12 attachments were tagged `OTHER_SUPPORTING_DOCUMENT`, which displays as the generic "Other"
  for all of them, masking the fileName rename. Fixed by clearing `documentCategory` to `null` on
  the affected rows (`scripts/scratch-clear-sl-corp-00135-categories.ts`) — `PROOF_OF_BILLING` and
  `VALID_ID_BORROWER` were left alone since those category labels already displayed correctly.
  **This bug is not fixed in the component itself** — a future attachment tagged with a category
  that isn't one of the "real" document categories will hit the same masking issue. Worth a proper
  UI fix later (fall back to `fileName` when the category has no real display label, or stop
  displaying a generic "Other" pill over a specific fileName).

## Part 2 — August 2026 loan releases

Scope: the "8 AUGUST 2026" Google Drive folder, sibling of the already-handled September folder.
6 subfolders surveyed and cross-referenced against the LMS DB; 1 excluded (marked "CANCELLED!!!!!").
5 in-scope loan accounts, one (Rafael Baguio, SML-REG_00390) already handled in a prior session and
skipped here. User explicitly chose the thorough option — verify every attachment's content, not
just attach-and-trust — for all remaining accounts.

### Rodgie Pascual — SML-REG_00387 (new attach, 0 → 7 of 8 attachments)

Zero pre-existing attachments. Downloaded 8 documents from Drive, decoded, and attached 7
(`scripts/scratch-attach-pascual-00387.ts`). **"Selfie Photo.pdf" (10.6MB) could not be downloaded**
— the Google Drive MCP connector's `download_file_content` has a hard ~10MB ceiling with no
workaround via current tools. Still needs manual handling (download directly via Drive web UI or
another path, then attach).

### Aldwin Maniwang — SML-REG_00382 (29 attachments)

Full content verification of all 29. Found:
- **3 misattached files** — belong to entirely different people/loans (a Pascual employment
  verification, a Kenneth Ang Chua Cham secretary's certificate, and a barangay certification for
  SML-REG_00210's borrowers). Reported to the user, who said leave them untouched
  ("Iwanan muna, huwag galawin") rather than delete.
- **3 duplicate pairs/triplet** (re-uploads of the same content under different names, e.g. 3 Valid
  ID Co-borrower copies). User declined deletion ("huwag tanggalin ang mga duplicate").
- Renamed the 26 legitimately-Maniwang files to clean names
  (`scripts/scratch-rename-maniwang-00382-attachments.ts`); the 3 misattached files were left with
  no rename mapping so they're skipped automatically, and duplicates were given distinguishing
  "(2)"/"(3)" suffixes rather than deleted.

**Bug found and fixed while writing that script:** a DB `fileName` value
(`"Maniwang - Selfie Photo - Authorization "`) had a trailing space that broke an exact-string
lookup and was wrongly reported as a 4th misattached file on first dry run. Fixed by trimming
`fileName` before matching. Worth checking other loan accounts for similar trailing-space
filenames if this class of bug matters going forward.

### Nelson Malinao — SML-REG_00385 (22 attachments)

Full content verification of all 22 — all legitimately his own, no misattachments, no duplicates.
One flagged anomaly, not changed: "Proof of Billing" is a Maynilad bill under **"GEORGE MALINAO"**,
not Nelson — same address as Nelson's own application form (2016 San Roque St, Baesa QC),
plausibly a relative rather than a wrong attachment. Renamed the other 21
(`scripts/scratch-rename-malinao-00385-attachments.ts`). Confirmed "Copy of SIGNED LOAN DOCUMENTS
(BLANK)" is a genuinely different document (a pre-signed blank template bundle) from the
individually-filed completed documents, not a duplicate — kept its own distinct name.

### Aristotle Moreno — SML-Co-Borrower_00097 (27 attachments)

Full content verification of all 27 — all legitimately his own (including his co-borrower Maria
Dolores Espiritu Valerio's documents where applicable), no misattachments, no duplicates. One
flagged anomaly, not changed: "Proof of Billing" is a Meralco bill under **"VICTOR DIZON EUSEBIO"**
— an unrelated name to either borrower or co-borrower (address only partially matches: same street,
Tinajeros, Malabon). More concerning than the Malinao case since there's no obvious relative-name
link. Renamed the other 26 (`scripts/scratch-rename-moreno-co00097-attachments.ts`).

## Standing rule established this session

Any file found to be **misattached** (belongs to a different client/loan) or a **duplicate**
(identical content re-uploaded under a different name) must be **reported to the user, never
silently deleted or altered**. Confirmed twice by explicit user instruction this session. Apply the
same caution to any future attachment review.

## Known follow-up work (not yet done)

1. **Rodgie Pascual's "Selfie Photo.pdf"** (SML-REG_00387) — still unattached, blocked by the Drive
   connector's 10MB download limit. Needs manual download + attach.
2. **Two flagged Proof-of-Billing anomalies** — Nelson Malinao's (George Malinao) and Aristotle
   Moreno's (Victor Dizon Eusebio) — reported but not resolved. User should confirm whether these
   are acceptable (e.g. household members) or need replacement with the actual borrower's own
   billing proof.
3. **3 misattached files + 3 duplicate pairs on Aldwin Maniwang's account (SML-REG_00382)** — left
   in place per user instruction; no action taken, but worth a follow-up decision at some point
   (e.g. moving the misattached files to their correct loan accounts, or removing duplicates) rather
   than leaving them indefinitely.
4. **`AttachmentsPanel.tsx`'s `documentCategory`-masks-`fileName` display bug** — root-caused and
   worked around at the data layer for SL-CORP_00135, but the component itself is unchanged and can
   recreate the same "rename didn't show" confusion for any future attachment tagged with an
   unmapped `documentCategory`.

## Scripts added this session (all in `app/easycashbackend/scripts/`, dry-run by default, `--apply` to write)

- `scratch-rename-sl-corp-00135-attachments.ts`
- `scratch-clear-sl-corp-00135-categories.ts`
- `scratch-attach-pascual-00387.ts`
- `scratch-rename-maniwang-00382-attachments.ts`
- `scratch-rename-malinao-00385-attachments.ts`
- `scratch-rename-moreno-co00097-attachments.ts`
