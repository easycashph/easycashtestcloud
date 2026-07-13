import type { GeocodedCoordinates, IGeocodingService } from './IGeocodingService';

/**
 * OpenStreetMap Nominatim — free, open-source, no API key (CLAUDE.md: prioritize open-source,
 * avoid unnecessary paid cloud services). Usage policy requires a descriptive `User-Agent` and
 * caps public-instance usage at ~1 request/sec; this LMS's geocoding volume (one branch, one
 * lookup per new loan application) is far below that.
 *
 * Deliberately never throws: any network failure, timeout, or "no match" resolves to `null` so
 * callers can fail open on the distance rule rather than crash a loan application submission over
 * a geocoding hiccup.
 */
export class NominatimGeocodingService implements IGeocodingService {
  private readonly baseUrl = 'https://nominatim.openstreetmap.org/search';
  private readonly timeoutMs = 8000;

  async geocode(addressText: string): Promise<GeocodedCoordinates | null> {
    const trimmed = addressText.trim();
    if (!trimmed) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = `${this.baseUrl}?format=jsonv2&limit=1&countrycodes=ph&q=${encodeURIComponent(trimmed)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'EasycashLMS/1.0 (loan-application pre-qualification distance check)' },
        signal: controller.signal,
      });
      if (!res.ok) return null;

      const results = (await res.json()) as { lat: string; lon: string }[];
      const first = results[0];
      if (!first) return null;

      const latitude = Number(first.lat);
      const longitude = Number(first.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

      return { latitude, longitude };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
