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
