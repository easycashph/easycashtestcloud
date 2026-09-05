import { extractRawText } from 'mammoth';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { ValidationError } from '@shared/errors/DomainError';
import type { IVisionModelClient } from '../ports/IVisionModelClient';

const SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);

export interface ExtractedLoanApplicationFields {
  applicantName?: string;
  age?: number;
  /** 2026-09-05 (user request, "Create Application Profile" auto-fill extension): the model is
   * asked to read this off the ID itself and reformat it as ISO (YYYY-MM-DD) directly, rather than
   * this use case guessing at a slash-separated string's field order (MM/DD/YYYY vs DD/MM/YYYY is
   * genuinely ambiguous from the string alone - the model, looking at the actual source, isn't
   * guessing). Validated against `^\d{4}-\d{2}-\d{2}$` before being trusted; anything else is
   * dropped with a warning rather than passed through malformed. */
  dateOfBirth?: string;
  /** Normalized to exactly `MALE`/`FEMALE` (matching `GENDER_OPTIONS` in
   * LoanApplicationCreatePage.tsx) or omitted - same "the model outputs the exact enum value,
   * validated on receipt" approach as `dateOfBirth` above. */
  gender?: string;
  nationality?: string;
  address?: string;
  employer?: string;
  monthlyIncome?: number;
  summary: string;
  /** Non-fatal notes surfaced to the loan officer - e.g. an unreadable/scanned document. Never
   * silently dropped, per CLAUDE.md "never fabricate" - an unclear field stays absent, not guessed. */
  warnings: string[];
}

/**
 * Extraction prompt asks for one field per line in a fixed, easy-to-parse format rather than JSON
 * - moondream (1B params, not instruction-tuned for strict JSON) is noticeably more reliable at
 * this than at producing valid JSON consistently. Explicitly told to write NONE for anything
 * unclear rather than guess - parsed leniently below, and NONE (or an unparseable line) always
 * means "leave this field blank," never "take a best guess."
 */
const EXTRACTION_PROMPT = `You are reading a document submitted by a loan applicant in the Philippines (a valid ID, payslip, or other supporting paper). Extract ONLY what is clearly visible. If a field is not visible or you are not sure, write NONE for it - never guess.

Respond in exactly this format, one line per field:
NAME: <full name, or NONE>
AGE: <age in years as a number, or NONE>
DATE_OF_BIRTH: <exact birth date in YYYY-MM-DD format, or NONE>
GENDER: <MALE, FEMALE, or NONE>
NATIONALITY: <nationality, or NONE>
ADDRESS: <address, or NONE>
EMPLOYER: <employer name, or NONE>
MONTHLY_INCOME: <number only, no currency symbol or commas, or NONE>
SUMMARY: <one sentence describing what kind of document this is and its key visible content>`;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GENDER_VALUES = new Set(['MALE', 'FEMALE']);

function parseField(response: string, label: string): string | undefined {
  const match = new RegExp(`^${label}:\\s*(.+)$`, 'im').exec(response);
  const value = match?.[1]?.trim();
  if (!value || value.toUpperCase() === 'NONE') return undefined;
  return value;
}

function parseExtractionResponse(response: string): ExtractedLoanApplicationFields {
  const warnings: string[] = [];
  const ageRaw = parseField(response, 'AGE');
  const incomeRaw = parseField(response, 'MONTHLY_INCOME');
  const age = ageRaw ? Number.parseInt(ageRaw, 10) : undefined;
  const monthlyIncome = incomeRaw ? Number.parseFloat(incomeRaw.replace(/[^0-9.]/g, '')) : undefined;
  if (ageRaw && (age === undefined || Number.isNaN(age))) warnings.push(`Could not parse AGE value "${ageRaw}" - left blank.`);
  if (incomeRaw && (monthlyIncome === undefined || Number.isNaN(monthlyIncome))) {
    warnings.push(`Could not parse MONTHLY_INCOME value "${incomeRaw}" - left blank.`);
  }

  // The model is asked to output ISO format directly (see prompt comment on `dateOfBirth` above) -
  // anything that doesn't match is a malformed response, not a value worth guessing at further.
  const dateOfBirthRaw = parseField(response, 'DATE_OF_BIRTH');
  const dateOfBirth = dateOfBirthRaw && ISO_DATE_RE.test(dateOfBirthRaw) ? dateOfBirthRaw : undefined;
  if (dateOfBirthRaw && !dateOfBirth) warnings.push(`Could not parse DATE_OF_BIRTH value "${dateOfBirthRaw}" - left blank.`);

  const genderRaw = parseField(response, 'GENDER');
  const genderNormalized = genderRaw?.toUpperCase();
  const gender = genderNormalized && GENDER_VALUES.has(genderNormalized) ? genderNormalized : undefined;
  if (genderRaw && !gender) warnings.push(`Could not parse GENDER value "${genderRaw}" - left blank.`);

  return {
    applicantName: parseField(response, 'NAME'),
    age: age !== undefined && !Number.isNaN(age) ? age : undefined,
    dateOfBirth,
    gender,
    nationality: parseField(response, 'NATIONALITY'),
    address: parseField(response, 'ADDRESS'),
    employer: parseField(response, 'EMPLOYER'),
    monthlyIncome: monthlyIncome !== undefined && !Number.isNaN(monthlyIncome) ? monthlyIncome : undefined,
    summary: parseField(response, 'SUMMARY') ?? 'The model did not return a summary for this document.',
    warnings,
  };
}

export class ExtractLoanApplicationFieldsUseCase {
  constructor(private readonly deps: { visionModelClient: IVisionModelClient }) {}

  async execute(fileData: Buffer, mimeType: string): Promise<ExtractedLoanApplicationFields> {
    if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
      throw new ValidationError(
        `Unsupported file type "${mimeType}" for AI extraction. Supported: JPEG, PNG, PDF (text-based), DOCX.`,
      );
    }

    if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
      const response = await this.deps.visionModelClient.describeImage(fileData, EXTRACTION_PROMPT);
      return parseExtractionResponse(response);
    }

    if (mimeType === 'application/pdf') {
      const result = await pdfParse(fileData);
      const text = result.text.trim();
      if (!text) {
        // A scanned (image-only) PDF has no extractable text layer - rendering pages to images
        // would need the `canvas` native binding, deliberately not added yet (see the Document
        // module's Docker/Alpine native-dependency history). Reported honestly, not guessed at.
        return {
          summary: 'This PDF has no extractable text (likely a scanned image). AI extraction from scanned PDFs is not yet supported.',
          warnings: ['Scanned/image-only PDFs are not yet supported for auto-fill - please fill this form manually for this file.'],
        };
      }
      const response = await this.deps.visionModelClient.complete(`${EXTRACTION_PROMPT}\n\nDocument text:\n${text}`);
      return parseExtractionResponse(response);
    }

    // .docx
    const { value: text } = await extractRawText({ buffer: fileData });
    if (!text.trim()) {
      return {
        summary: 'This document appears to be empty or its text could not be read.',
        warnings: ['No readable text was found in this .docx file.'],
      };
    }
    const response = await this.deps.visionModelClient.complete(`${EXTRACTION_PROMPT}\n\nDocument text:\n${text.trim()}`);
    return parseExtractionResponse(response);
  }
}
