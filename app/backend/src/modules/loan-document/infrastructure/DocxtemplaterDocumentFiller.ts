import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import type { IDocumentFiller } from '../application/ports/IDocumentFiller';
import { TemplateFileNotConfiguredError } from '../domain/errors/LoanDocumentDomainErrors';

/**
 * ADR-051 §2/§4: templates live at `app/backend/templates/<code>.docx` — resolved from
 * `process.cwd()` rather than `__dirname` so it works identically whether running from
 * `src/` (tsx dev) or `dist/` (compiled), since both are always launched with `app/backend` as
 * the working directory (see `package.json` scripts, and `backend.Dockerfile`'s `WORKDIR /app`).
 */
const DEFAULT_TEMPLATES_DIR = resolve(process.cwd(), 'templates');

export class DocxtemplaterDocumentFiller implements IDocumentFiller {
  constructor(private readonly templatesDir: string = DEFAULT_TEMPLATES_DIR) {}

  async fill(templateCode: string, data: Record<string, string>): Promise<Buffer> {
    const filePath = join(this.templatesDir, `${templateCode}.docx`);
    if (!existsSync(filePath)) {
      throw new TemplateFileNotConfiguredError(templateCode);
    }

    const fileBuffer = await readFile(filePath);
    const zip = new PizZip(fileBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(data);
    return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
  }
}
