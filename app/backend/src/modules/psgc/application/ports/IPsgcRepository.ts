export interface PsgcOption {
  code: string;
  name: string;
}

export interface IPsgcRepository {
  listRegions(): Promise<PsgcOption[]>;
  listProvinces(regionCode: string): Promise<PsgcOption[]>;
  listCities(provinceCode: string): Promise<PsgcOption[]>;
  listBarangays(cityMunicipalityCode: string): Promise<PsgcOption[]>;
}
