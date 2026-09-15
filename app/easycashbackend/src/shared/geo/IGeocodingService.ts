export interface GeocodedCoordinates {
  latitude: number;
  longitude: number;
}

/** Never throws — a failed/ambiguous/no-match geocode returns `null` so callers can fail open
 * (see `LoanApplicationPreQualificationService`'s distance-rule handling) rather than crash. */
export interface IGeocodingService {
  geocode(addressText: string): Promise<GeocodedCoordinates | null>;
  /** 2026-09-15 (user request: "nearest landmark" on the Applicant Details page) - the reverse of
   * `geocode()`: coordinates in, a human-readable place description out. Best-effort only - this
   * is Nominatim's own nearby-address description, not a dedicated points-of-interest/landmark
   * search, so it reads more like "an approximate area" than a named landmark. Never throws, same
   * fail-open contract as `geocode()`. */
  reverseGeocode(latitude: number, longitude: number): Promise<string | null>;
}
