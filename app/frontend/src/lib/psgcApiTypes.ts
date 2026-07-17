/** Mirrors `app/backend`'s PSGC lookup endpoints (`GET /psgc/regions|provinces|cities|barangays`). */
export interface PsgcOption {
  code: string;
  name: string;
}

/** `GET /psgc/cities` additionally carries a best-effort `zipCode` (null where no confident match
 * was found) - used to auto-fill the address picker's ZIP Code field once a city is selected. */
export interface PsgcCityOption extends PsgcOption {
  zipCode: string | null;
}

/** `GET /psgc/resolve-address` - reverse-looks-up plain address names back into PSGC codes, so an
 * existing address (e.g. loaded from a LoanApplication/Borrower) can pre-select
 * PsgcAddressPicker's cascading dropdowns instead of showing them blank. Each level is null if
 * that level (or anything above it) had no match. */
export interface ResolvedAddressCodes {
  regionCode: string | null;
  provinceCode: string | null;
  cityMunicipalityCode: string | null;
  barangayCode: string | null;
}
