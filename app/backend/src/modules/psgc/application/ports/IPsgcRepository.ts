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

export interface IPsgcRepository {
  listRegions(): Promise<PsgcOption[]>;
  listProvinces(regionCode: string): Promise<PsgcOption[]>;
  listCities(provinceCode: string): Promise<PsgcCityOption[]>;
  listBarangays(cityMunicipalityCode: string): Promise<PsgcOption[]>;
}
