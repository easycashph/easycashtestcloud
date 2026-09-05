import sharp from 'sharp';
import { env } from '@shared/config/env';
import type { IVisionModelClient } from '../application/ports/IVisionModelClient';

interface OllamaGenerateResponse {
  response: string;
}

/** Longest edge an uploaded photo is downscaled to before it's sent to the vision model. This
 * machine's CPU-only inference time is roughly proportional to the number of image tokens the
 * model has to encode, which grows with resolution - a full phone-camera photo (often 3000px+ on
 * the long edge) costs several minutes per extraction for no OCR benefit, since ID text is legible
 * at far lower resolution. 1024px keeps text on a standard ID/payslip readable while cutting image
 * tokens (and therefore latency) substantially. See docs/session-logs/Office Server PC/
 * SESSION_LOG_2026-08-14_..._payment_adjustment.md §105. */
const MAX_IMAGE_DIMENSION = 1024;

/**
 * Calls a local Ollama instance's `/api/generate` (non-streaming). Never sends data anywhere
 * outside the local network — no cloud AI service involved (CLAUDE.md "avoid unnecessary paid
 * cloud services"). If Ollama isn't running or the model isn't pulled, this throws and the use
 * case surfaces a clear error rather than fabricating a result.
 */
export class OllamaVisionModelClient implements IVisionModelClient {
  private async generate(prompt: string, images?: string[]): Promise<string> {
    const res = await fetch(`${env.OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OLLAMA_VISION_MODEL,
        prompt,
        images,
        stream: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Ollama request failed (${res.status}): ${body || res.statusText}`);
    }
    const data = (await res.json()) as OllamaGenerateResponse;
    return data.response;
  }

  async describeImage(imageData: Buffer, prompt: string): Promise<string> {
    const resized = await sharp(imageData)
      .rotate() // apply EXIF orientation before resizing - a sideways phone photo would otherwise stay sideways
      .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return this.generate(prompt, [resized.toString('base64')]);
  }

  async complete(prompt: string): Promise<string> {
    return this.generate(prompt);
  }
}
