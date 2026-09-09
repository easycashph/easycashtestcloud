import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { LoanApplication } from '../../domain/LoanApplication';
import type { CreditBureauPartyCheck, DocumentVerificationEntry } from '../../domain/LoanApplication';

const NAVY = rgb(0.086, 0.255, 0.431); // matches LoanApplicationFormPdfBuilder's letterhead color
const INK = rgb(0.1, 0.133, 0.2);
const MUTED = rgb(0.42, 0.45, 0.51);
const LINE = rgb(0.847, 0.871, 0.910);
const PANEL = rgb(0.957, 0.973, 0.988);
const GOOD = rgb(0.122, 0.478, 0.302);
const BAD = rgb(0.647, 0.153, 0.153);

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BOTTOM_LIMIT = 60;

interface Field {
  label: string;
  value: string;
}

function text(s: string | undefined | null): string {
  return s && s.trim() ? s.trim() : '—';
}

/**
 * Draws the "CRM Report" (Credit Evaluation Report) as a printable PDF, mirroring
 * `LoanApplicationFormPdfBuilder`'s letterhead/section conventions but pulling from
 * `LoanApplication.reviewReport` instead of the raw intake fields, and paginating (this report's
 * content - per-party credit bureau checks, document checklist, mitigation, agency verification,
 * narrative fields - routinely runs past one Letter page, unlike the shorter intake form).
 *
 * 2026-09-09 (user request): "CRM Report" - a proper, downloadable/printable version of the
 * Underwriting card's "Credit Evaluation Report" section, which previously only existed as
 * on-screen form fields with no export. Same "preview in a new tab before saving" UX as the
 * existing Print Application feature (see GenerateCrmReportUseCase's doc comment).
 */
export class CrmReportPdfBuilder {
  private pdfDoc!: PDFDocument;
  private page!: PDFPage;
  private font!: PDFFont;
  private fontBold!: PDFFont;
  private y = 0;

  async build(application: LoanApplication): Promise<Buffer> {
    const p = application.toProps();
    const report = p.reviewReport ?? { checkedDocuments: [] };

    this.pdfDoc = await PDFDocument.create();
    this.font = await this.pdfDoc.embedFont(StandardFonts.Helvetica);
    this.fontBold = await this.pdfDoc.embedFont(StandardFonts.HelveticaBold);
    this.addPage();
    this.drawLetterhead('CREDIT EVALUATION REPORT');

    this.drawSectionHeader('APPLICANT & LOAN SUMMARY');
    this.drawFieldGrid(
      [
        { label: 'Applicant', value: text(p.applicantName) },
        { label: 'Co-Borrower', value: text(p.coBorrowerName) },
        { label: 'Product', value: text(p.requestedCategory) },
        { label: 'Amount Requested', value: `PHP ${p.requestedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
        { label: 'Term', value: `${p.requestedTermMonths} months` },
        { label: 'Status', value: p.status },
      ],
      3,
    );
    this.y -= 10;

    if (report.ciNotes) {
      this.drawSectionHeader('CI NOTES (LEGACY)');
      this.drawParagraph(report.ciNotes);
      this.y -= 6;
    }

    if (report.creditBureauResult || report.creditBureauScore) {
      this.drawSectionHeader('CREDIT BUREAU RESULT (LEGACY)');
      this.drawFieldGrid(
        [
          { label: 'Result', value: text(report.creditBureauResult) },
          { label: 'Score', value: text(report.creditBureauScore) },
        ],
        2,
      );
      this.y -= 6;
    }

    this.drawSectionHeader('CREDIT BUREAU CHECK');
    this.drawPartyCheckTable(report.creditBureauBorrower, report.creditBureauCoBorrower);
    this.y -= 10;

    const verifications = Object.entries(report.documentVerifications ?? {});
    if (verifications.length > 0) {
      this.drawSectionHeader('DOCUMENT CHECKLIST');
      this.drawDocumentTable(verifications);
      this.y -= 10;
    } else if (report.checkedDocuments.length > 0) {
      this.drawSectionHeader('DOCUMENT CHECKLIST (LEGACY)');
      this.drawParagraph(report.checkedDocuments.join(', '));
      this.y -= 6;
    }

    this.drawSectionHeader('MODE OF PAYMENT & MITIGATION');
    this.drawFieldGrid(
      [
        { label: 'Bank', value: text(report.mitigation?.bank) },
        { label: 'Branch', value: text(report.mitigation?.branch) },
        { label: 'Account Name', value: text(report.mitigation?.accountName) },
        { label: 'Account Number', value: text(report.mitigation?.accountNumber) },
        { label: 'ATM Card Number', value: text(report.mitigation?.atmCardNumber) },
        { label: 'Allotment Amount', value: text(report.mitigation?.allotmentAmount) },
        {
          label: 'Whose Name Is This Account Under?',
          value: report.mitigation?.accountOwner === 'CO_BORROWER' ? 'Co-Borrower' : report.mitigation?.accountOwner === 'BORROWER' ? 'Borrower' : '—',
        },
      ],
      3,
    );
    this.y -= 10;

    const agency = report.agencyVerification;
    this.drawSectionHeader('AGENCY / CONTRACT / ALLOTMENT VERIFICATION');
    this.drawFieldGrid(
      [
        { label: 'Agency Name', value: text(agency?.agencyName) },
        { label: 'Agency Address', value: text(agency?.agencyAddress) },
        { label: 'Agency Contact No.', value: text(agency?.agencyContactNumbers) },
        { label: 'Years With Agency', value: text(agency?.yearsWithAgency) },
        { label: 'Position', value: text(agency?.position) },
        { label: 'Vessel', value: text(agency?.vessel) },
        { label: 'Basic Monthly Salary', value: text(agency?.basicMonthlySalary) },
        { label: 'Monthly Salary (Net)', value: text(agency?.monthlySalary) },
        { label: 'Contract Duration', value: text(agency?.contractDuration) },
        { label: 'Joining Port', value: text(agency?.joiningPort) },
        { label: 'Date of Departure', value: text(agency?.dateOfDeparture) },
        { label: 'Departure Status', value: text(agency?.departureStatus) },
        { label: 'Expected Sign-off Date', value: text(agency?.expectedSignOffDate) },
        { label: 'Payroll Schedule', value: text(agency?.payrollSchedule) },
        { label: 'First Full Allotment Date', value: text(agency?.firstFullAllotmentDate) },
        { label: 'Cash Advance', value: text(agency?.cashAdvance) },
        { label: 'Manner of Deduction', value: text(agency?.mannerOfDeduction) },
      ],
      3,
    );
    this.y -= 10;
    this.drawFieldGrid(
      [
        { label: 'Allottee 1', value: text(agency?.allottee1Name) },
        { label: 'Allottee 1 Bank', value: text(agency?.allottee1Bank) },
        { label: 'Allottee 1 Account No.', value: text(agency?.allottee1AccountNumber) },
        { label: 'Allottee 1 Amount', value: text(agency?.allottee1Amount) },
        { label: 'Allottee 2', value: text(agency?.allottee2Name) },
        { label: 'Allottee 2 Bank', value: text(agency?.allottee2Bank) },
        { label: 'Allottee 2 Account No.', value: text(agency?.allottee2AccountNumber) },
        { label: 'Allottee 2 Amount', value: text(agency?.allottee2Amount) },
      ],
      4,
    );
    this.y -= 10;

    this.drawSectionHeader('CONDITIONS AND RECOMMENDATION');
    this.drawSubheading('Conditions for Approval');
    this.drawParagraph(text(report.conditionsForApproval));
    this.drawSubheading('CRM Recommendation');
    this.drawParagraph(text(report.crmRecommendation));

    this.ensureSpace(70);
    this.y -= 20;
    const colWidth = (CONTENT_WIDTH - 30) / 2;
    this.drawSignatureLine(MARGIN, this.y, colWidth, 'CRM / Reviewing Officer');
    this.drawSignatureLine(MARGIN + colWidth + 30, this.y, colWidth, 'Loan Operation Manager');

    this.drawFooterOnAllPages();

    const bytes = await this.pdfDoc.save();
    return Buffer.from(bytes);
  }

  private addPage(): void {
    this.page = this.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(needed: number): void {
    if (this.y - needed < BOTTOM_LIMIT) this.addPage();
  }

  private drawLetterhead(title: string): void {
    this.page.drawText('EASYCASH', { x: MARGIN, y: this.y - 12, size: 15, font: this.fontBold, color: NAVY });
    this.page.drawText('Easycash Lending Company Inc.', { x: MARGIN, y: this.y - 27, size: 8.5, font: this.font, color: MUTED });
    const genLine = `Generated ${new Date().toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
    const w = this.font.widthOfTextAtSize(genLine, 8.5);
    this.page.drawText(genLine, { x: PAGE_WIDTH - MARGIN - w, y: this.y - 12, size: 8.5, font: this.font, color: MUTED });

    this.y -= 40;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_WIDTH - MARGIN, y: this.y }, thickness: 1.5, color: NAVY });
    this.y -= 24;

    const titleWidth = this.fontBold.widthOfTextAtSize(title, 14);
    this.page.drawText(title, { x: (PAGE_WIDTH - titleWidth) / 2, y: this.y, size: 14, font: this.fontBold, color: NAVY });
    this.y -= 22;
  }

  private drawSectionHeader(label: string): void {
    this.ensureSpace(40);
    this.page.drawRectangle({ x: MARGIN, y: this.y - 14, width: CONTENT_WIDTH, height: 16, color: NAVY });
    this.page.drawText(label, { x: MARGIN + 6, y: this.y - 10, size: 8.5, font: this.fontBold, color: rgb(1, 1, 1) });
    this.y -= 24;
  }

  private drawFieldGrid(fields: Field[], columns: number): void {
    const gap = 16;
    const colWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
    for (let i = 0; i < fields.length; i += columns) {
      this.ensureSpace(28);
      const row = fields.slice(i, i + columns);
      for (const [colIdx, field] of row.entries()) {
        const x = MARGIN + colIdx * (colWidth + gap);
        this.page.drawText(field.label.toUpperCase(), { x, y: this.y, size: 6.5, font: this.font, color: MUTED });
        const value = field.value.length > 45 ? `${field.value.slice(0, 42)}...` : field.value;
        this.page.drawText(value, { x, y: this.y - 11, size: 9.5, font: this.fontBold, color: INK });
        this.page.drawLine({ start: { x, y: this.y - 16 }, end: { x: x + colWidth, y: this.y - 16 }, thickness: 0.5, color: LINE });
      }
      this.y -= 28;
    }
  }

  private drawSubheading(label: string): void {
    this.ensureSpace(18);
    this.page.drawText(label.toUpperCase(), { x: MARGIN, y: this.y, size: 7, font: this.fontBold, color: MUTED });
    this.y -= 14;
  }

  private drawParagraph(value: string): void {
    const words = value.split(/\s+/);
    const size = 9;
    const lineHeight = 13;
    let line = '';
    const lines: string[] = [];
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (this.font.widthOfTextAtSize(candidate, size) > CONTENT_WIDTH - 12) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);

    const boxHeight = lines.length * lineHeight + 12;
    this.ensureSpace(boxHeight);
    this.page.drawRectangle({ x: MARGIN, y: this.y - boxHeight + 6, width: CONTENT_WIDTH, height: boxHeight, color: PANEL });
    let ly = this.y - 6;
    for (const l of lines) {
      this.page.drawText(l, { x: MARGIN + 6, y: ly - size, size, font: this.font, color: INK });
      ly -= lineHeight;
    }
    this.y -= boxHeight + 6;
  }

  private drawPartyCheckTable(borrower: CreditBureauPartyCheck | undefined, coBorrower: CreditBureauPartyCheck | undefined): void {
    const rows: { label: string; borrower: string; coBorrower: string }[] = [
      { label: 'CMAP', borrower: text(borrower?.cmap), coBorrower: text(coBorrower?.cmap) },
      { label: 'KYC', borrower: text(borrower?.kyc), coBorrower: text(coBorrower?.kyc) },
      { label: 'MyScore', borrower: text(borrower?.myscore), coBorrower: text(coBorrower?.myscore) },
    ];
    const col0 = 90;
    const colW = (CONTENT_WIDTH - col0) / 2;

    this.ensureSpace(20);
    this.page.drawText('', { x: MARGIN, y: this.y, size: 8, font: this.font, color: MUTED });
    this.page.drawText('BORROWER', { x: MARGIN + col0, y: this.y, size: 7, font: this.fontBold, color: MUTED });
    this.page.drawText('CO-BORROWER', { x: MARGIN + col0 + colW, y: this.y, size: 7, font: this.fontBold, color: MUTED });
    this.y -= 14;

    for (const row of rows) {
      this.ensureSpace(20);
      this.page.drawText(row.label, { x: MARGIN, y: this.y, size: 9, font: this.fontBold, color: INK });
      this.page.drawText(row.borrower, { x: MARGIN + col0, y: this.y, size: 9, font: this.font, color: INK });
      this.page.drawText(row.coBorrower, { x: MARGIN + col0 + colW, y: this.y, size: 9, font: this.font, color: INK });
      this.page.drawLine({ start: { x: MARGIN, y: this.y - 5 }, end: { x: PAGE_WIDTH - MARGIN, y: this.y - 5 }, thickness: 0.5, color: LINE });
      this.y -= 18;
    }
  }

  private drawDocumentTable(entries: [string, DocumentVerificationEntry][]): void {
    for (const [name, entry] of entries) {
      this.ensureSpace(20);
      const passed = entry.status === 'VERIFIED';
      this.page.drawText(name.length > 55 ? `${name.slice(0, 52)}...` : name, { x: MARGIN, y: this.y, size: 9, font: this.font, color: INK });
      const statusLabel = passed ? 'VERIFIED' : 'REJECTED';
      const statusWidth = this.fontBold.widthOfTextAtSize(statusLabel, 8);
      this.page.drawText(statusLabel, {
        x: PAGE_WIDTH - MARGIN - statusWidth,
        y: this.y,
        size: 8,
        font: this.fontBold,
        color: passed ? GOOD : BAD,
      });
      this.page.drawLine({ start: { x: MARGIN, y: this.y - 5 }, end: { x: PAGE_WIDTH - MARGIN, y: this.y - 5 }, thickness: 0.5, color: LINE });
      this.y -= 15;
      if (!passed && entry.reason) {
        this.ensureSpace(14);
        this.page.drawText(`Reason: ${entry.reason}`, { x: MARGIN + 8, y: this.y, size: 7.5, font: this.font, color: MUTED });
        this.y -= 14;
      }
    }
  }

  private drawSignatureLine(x: number, y: number, width: number, label: string): void {
    this.page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.75, color: INK });
    const labelWidth = this.font.widthOfTextAtSize(label, 7.5);
    this.page.drawText(label, { x: x + (width - labelWidth) / 2, y: y - 10, size: 7.5, font: this.font, color: MUTED });
  }

  private drawFooterOnAllPages(): void {
    const footer = 'This document is a system-generated internal Credit Evaluation Report - advisory only, not a final approval decision.';
    const pages = this.pdfDoc.getPages();
    for (const [i, page] of pages.entries()) {
      const footerWidth = this.font.widthOfTextAtSize(footer, 7.5);
      page.drawLine({ start: { x: MARGIN, y: 40 }, end: { x: PAGE_WIDTH - MARGIN, y: 40 }, thickness: 0.5, color: LINE });
      page.drawText(footer, { x: (PAGE_WIDTH - footerWidth) / 2, y: 28, size: 7.5, font: this.font, color: MUTED });
      const pageLabel = `Page ${i + 1} of ${pages.length}`;
      const pageLabelWidth = this.font.widthOfTextAtSize(pageLabel, 7.5);
      page.drawText(pageLabel, { x: PAGE_WIDTH - MARGIN - pageLabelWidth, y: 40 - 12, size: 7.5, font: this.font, color: MUTED });
    }
  }
}
