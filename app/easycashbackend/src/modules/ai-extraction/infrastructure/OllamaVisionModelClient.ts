import { env } from '@shared/config/env';
import type { IVisionModelClient } from '../application/ports/IVisionModelClient';

interface OllamaGenerateResponse {
  response: string;
}

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
    return this.generate(prompt, [imageData.toString('base64')]);
  }

  async complete(prompt: string): Promise<string> {
    return this.generate(prompt);
  }
}
