import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { IDocxToPdfConverter } from '../application/ports/IDocxToPdfConverter';

const execFileAsync = promisify(execFile);

/**
 * ADR-051 §4: shells out to headless LibreOffice (`soffice --convert-to pdf`) — free, self-hosted,
 * installed in the backend Docker image (`backend.Dockerfile`). Not installed on every local dev
 * machine (Windows dev boxes in particular), so this step is the one part of the pipeline that
 * genuinely needs the Docker container (or a local LibreOffice install) to exercise end-to-end;
 * `DocxtemplaterDocumentFiller` above has no such dependency and works anywhere Node runs.
 */
export class LibreOfficeDocxToPdfConverter implements IDocxToPdfConverter {
  constructor(private readonly sofficeBinary: string = 'soffice') {}

  async convert(docxBuffer: Buffer): Promise<Buffer> {
    const workDir = join(tmpdir(), `loan-doc-${randomUUID()}`);
    await mkdir(workDir, { recursive: true });
    const docxPath = join(workDir, 'input.docx');
    const pdfPath = join(workDir, 'input.pdf');

    try {
      await writeFile(docxPath, docxBuffer);
      await execFileAsync(this.sofficeBinary, ['--headless', '--convert-to', 'pdf', '--outdir', workDir, docxPath]);
      return await readFile(pdfPath);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}
