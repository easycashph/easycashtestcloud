export interface PsgcOption {
  code: string;
  name: string;
}

/** Cities/municipalities additionally carry a best-effort `zipCode` (see
 * scripts/import-ph-zip-codes.ts), null where no confident match was found - used to auto-fill the
 * address picker's ZIP Code field once a city is selected. */
export interface PsgcCityOption extends PsgcOption {
  zipCode: string | null;
}

/** Barangays additionally carry a best-effort `zipCode` - only populated in NCR, where a single
 * city has multiple ZIP codes depending on barangay (e.g. Makati - see
 * scripts/import-ncr-barangay-zip-codes.ts). Null everywhere else, where the city-level ZIP
 * (`PsgcCityOption.zipCode`) already covers the area. */
export interface PsgcBarangayOption extends PsgcOption {
  zipCode: string | null;
}

export interface ResolvedAddressCodes {
  regionCode: string | null;
  provinceCode: string | null;
  cityMunicipalityCode: string | null;
  barangayCode: string | null;
}

export interface IPsgcRepository {
  listRegions(): Promise<PsgcOption[]>;
  listProvinces(regionCode: string): Promise<PsgcOption[]>;
  listCities(provinceCode: string): Promise<PsgcCityOption[]>;
  listBarangays(cityMunicipalityCode: string): Promise<PsgcBarangayOption[]>;
  /** Reverse lookup: given the plain address *names* already stored on an Address/Borrower/
   * LoanApplication record (this API's own write shape - see PsgcAddressPicker.tsx's doc comment
   * for why only names are stored, never codes), resolves them back to PSGC codes so a caller can
   * pre-select the cascading dropdowns for an existing address instead of showing them blank.
   * Each level is only resolved if every level above it also resolved (a barangay code is
   * meaningless without knowing which city it belongs to) - name matching is case-insensitive
   * exact match, consistent with how PsgcAddressPicker itself always writes back `toProperCase()`
   * names, not free-typed variants. */
  resolveAddressCodes(names: { province?: string; cityMunicipality?: string; barangay?: string }): Promise<ResolvedAddressCodes>;
}
