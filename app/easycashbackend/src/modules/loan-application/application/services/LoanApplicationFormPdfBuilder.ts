import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { LoanApplication } from '../../domain/LoanApplication';

const NAVY = rgb(0.086, 0.255, 0.431); // #16416e, matches the LMS's own primary blue
const GREEN = rgb(0.122, 0.478, 0.302); // #1f7a4d - the "post-approval" section header
const INK = rgb(0.1, 0.133, 0.2);
const MUTED = rgb(0.42, 0.45, 0.51);
const LINE = rgb(0.847, 0.871, 0.910);
const PANEL = rgb(0.957, 0.973, 0.988);

const PAGE_WIDTH = 612; // US Letter, points
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export interface LoanApplicationFormApprovalDetails {
  reviewedByName: string | null;
  approvedDate: Date | null;
  loanAccountCode: string | null;
  approvedAmount: number | null;
  activatedAt: Date | null;
}

interface Field {
  label: string;
  value: string;
}

function money(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return '—';
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function date(d: Date | undefined | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function joinAddress(parts: Array<string | undefined>): string {
  const filled = parts.filter((p): p is string => Boolean(p && p.trim()));
  return filled.length > 0 ? filled.join(', ') : '—';
}

/**
 * Draws the "Loan Application Form" printable PDF directly with pdf-lib (no .docx template - see
 * GenerateLoanApplicationFormUseCase's doc comment for why). Mirrors the mockup shown to and
 * approved by Nomer 2026-08-21: letterhead, Applicant Information / Employment & Income /
 * Requested Loan Terms sections pulled straight from the application, a 4th "Approval & Resulting
 * Account" section only when `approval` is provided, and signature lines at the bottom since this
 * doubles as a physical/printable form.
 */
export class LoanApplicationFormPdfBuilder {
  async build(application: LoanApplication, approval: LoanApplicationFormApprovalDetails | null): Promise<Buffer> {
    const p = application.toProps();
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = PAGE_HEIGHT - MARGIN;

    // --- Letterhead ---
    page.drawText('EASYCASH', { x: MARGIN, y: y - 12, size: 15, font: fontBold, color: NAVY });
    page.drawText('Easycash Lending Company Inc.', { x: MARGIN, y: y - 27, size: 8.5, font, color: MUTED });
    page.drawText('Unit 9 G/F The Midland Plaza, M. Adriatico St., Ermita, Manila', {
      x: MARGIN,
      y: y - 38,
      size: 8.5,
      font,
      color: MUTED,
    });

    const genLine1 = 'SEC Reg. No. CS201001882';
    const genLine2 = 'Certificate of Authority No. 640';
    const genLine3 = `Generated ${new Date().toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
    for (const [i, line] of [genLine1, genLine2, genLine3].entries()) {
      const w = font.widthOfTextAtSize(line, 8.5);
      page.drawText(line, { x: PAGE_WIDTH - MARGIN - w, y: y - 12 - i * 11, size: 8.5, font, color: MUTED });
    }

    y -= 50;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1.5, color: NAVY });
    y -= 24;

    // --- Title ---
    const title = 'LOAN APPLICATION FORM';
    const titleWidth = fontBold.widthOfTextAtSize(title, 14);
    page.drawText(title, { x: (PAGE_WIDTH - titleWidth) / 2, y, size: 14, font: fontBold, color: NAVY });
    y -= 14;
    const code = `Application ID: ${p.id.slice(0, 8).toUpperCase()} · Status: ${p.status}`;
    const codeWidth = font.widthOfTextAtSize(code, 8.5);
    page.drawText(code, { x: (PAGE_WIDTH - codeWidth) / 2, y, size: 8.5, font, color: MUTED });
    y -= 22;

    // --- Applicant Information ---
    y = this.drawSectionHeader(page, fontBold, 'APPLICANT INFORMATION', y, NAVY);
    y = this.drawFieldGrid(
      page,
      font,
      fontBold,
      [
        { label: 'Full Name', value: p.applicantName },
        { label: 'Date of Birth / Age', value: `${date(p.birthDate)} · ${p.age ?? '—'}` },
        { label: 'Civil Status', value: p.civilStatus ?? '—' },
        { label: 'Nationality', value: p.nationality ?? '—' },
        {
          label: 'Present Address',
          value: joinAddress([p.houseUnitNumber, p.street, p.barangay, p.cityMunicipality, p.province, p.zipCode]),
        },
        { label: 'Mobile Number', value: p.mobilePhone ?? '—' },
        { label: 'Email', value: p.email ?? '—' },
      ],
      y,
      2,
    );
    y -= 14;

    // --- Employment & Income ---
    y = this.drawSectionHeader(page, fontBold, 'EMPLOYMENT & INCOME', y, NAVY);
    y = this.drawFieldGrid(
      page,
      font,
      fontBold,
      [
        { label: 'Employer', value: p.employer ?? '—' },
        { label: 'Occupation', value: p.occupation ?? '—' },
        { label: 'Monthly Income', value: money(p.monthlyIncome) },
        { label: 'TIN', value: p.tinNumber ?? '—' },
      ],
      y,
      2,
    );
    y -= 14;

    // --- Requested Loan Terms ---
    y = this.drawSectionHeader(page, fontBold, 'REQUESTED LOAN TERMS', y, NAVY);
    y = this.drawFieldGrid(
      page,
      font,
      fontBold,
      [
        { label: 'Product', value: p.requestedCategory },
        { label: 'Amount Requested', value: money(p.requestedAmount) },
        { label: 'Term', value: `${p.requestedTermMonths} months` },
        { label: 'Purpose', value: p.loanPurpose ?? '—' },
      ],
      y,
      3,
    );
    y -= 14;

    // --- Approval & Resulting Account (only once approved and linked) ---
    if (approval) {
      y = this.drawSectionHeader(page, fontBold, 'APPROVAL & RESULTING ACCOUNT', y, GREEN);
      page.drawRectangle({
        x: MARGIN,
        y: y - 46,
        width: CONTENT_WIDTH,
        height: 54,
        color: PANEL,
        borderColor: GREEN,
        borderWidth: 1,
      });
      y -= 8;
      y = this.drawFieldGrid(
        page,
        font,
        fontBold,
        [
          { label: 'Reviewed / Approved By', value: approval.reviewedByName ?? '—' },
          { label: 'Approved Date', value: date(approval.approvedDate) },
          { label: 'Approved Amount', value: money(approval.approvedAmount) },
          { label: 'Loan Account', value: approval.loanAccountCode ?? '—' },
          { label: 'Activation Date', value: date(approval.activatedAt) },
          { label: '', value: '' },
        ],
        y,
        3,
        MARGIN + 8,
        CONTENT_WIDTH - 16,
      );
      y -= 26;
    }

    // --- Signature lines ---
    y -= 30;
    const colWidth = (CONTENT_WIDTH - 30) / 2;
    this.drawSignatureLine(page, font, MARGIN, y, colWidth, 'Applicant Signature over Printed Name');
    this.drawSignatureLine(page, font, MARGIN + colWidth + 30, y, colWidth, 'Authorized Signatory, Easycash Lending Company Inc.');

    // --- Footer ---
    const footer =
      'This document is a system-generated record of the loan application as submitted and approved. For verification, contact Easycash Lending Company Inc. at (02) 5 310-3708.';
    const footerWidth = font.widthOfTextAtSize(footer, 7.5);
    page.drawLine({ start: { x: MARGIN, y: 40 }, end: { x: PAGE_WIDTH - MARGIN, y: 40 }, thickness: 0.5, color: LINE });
    page.drawText(footer, { x: (PAGE_WIDTH - footerWidth) / 2, y: 28, size: 7.5, font, color: MUTED });

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }

  private drawSectionHeader(page: PDFPage, fontBold: PDFFont, label: string, y: number, color: ReturnType<typeof rgb>): number {
    page.drawRectangle({ x: MARGIN, y: y - 14, width: CONTENT_WIDTH, height: 16, color });
    page.drawText(label, { x: MARGIN + 6, y: y - 10, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
    return y - 24;
  }

  private drawFieldGrid(
    page: PDFPage,
    font: PDFFont,
    fontBold: PDFFont,
    fields: Field[],
    startY: number,
    columns: number,
    startX: number = MARGIN,
    width: number = CONTENT_WIDTH,
  ): number {
    const gap = 16;
    const colWidth = (width - gap * (columns - 1)) / columns;
    let y = startY;
    for (let i = 0; i < fields.length; i += columns) {
      const row = fields.slice(i, i + columns);
      for (const [colIdx, field] of row.entries()) {
        if (!field.label) continue;
        const x = startX + colIdx * (colWidth + gap);
        page.drawText(field.label.toUpperCase(), { x, y, size: 6.5, font, color: MUTED });
        const value = field.value.length > 60 ? `${field.value.slice(0, 57)}...` : field.value;
        page.drawText(value, { x, y: y - 11, size: 9.5, font: fontBold, color: INK });
        page.drawLine({ start: { x, y: y - 16 }, end: { x: x + colWidth, y: y - 16 }, thickness: 0.5, color: LINE });
      }
      y -= 28;
    }
    return y;
  }

  private drawSignatureLine(page: PDFPage, font: PDFFont, x: number, y: number, width: number, label: string): void {
    page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.75, color: INK });
    const labelWidth = font.widthOfTextAtSize(label, 7.5);
    page.drawText(label, { x: x + (width - labelWidth) / 2, y: y - 10, size: 7.5, font, color: MUTED });
  }
}
