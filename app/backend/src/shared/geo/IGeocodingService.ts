export interface GeocodedCoordinates {
  latitude: number;
  longitude: number;
}

/** Never throws — a failed/ambiguous/no-match geocode returns `null` so callers can fail open
 * (see `LoanApplicationPreQualificationService`'s distance-rule handling) rather than crash. */
export interface IGeocodingService {
  geocode(addressText: string): Promise<GeocodedCoordinates | null>;
}
