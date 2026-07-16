import type { IPsgcRepository, PsgcCityOption, PsgcOption, ResolvedAddressCodes } from '../ports/IPsgcRepository';

/** Single use case for all PSGC lookups — each is a trivial passthrough, no business logic to separate. */
export class ListPsgcOptionsUseCase {
  constructor(private readonly deps: { psgcRepository: IPsgcRepository }) {}

  listRegions(): Promise<PsgcOption[]> {
    return this.deps.psgcRepository.listRegions();
  }

  listProvinces(regionCode: string): Promise<PsgcOption[]> {
    return this.deps.psgcRepository.listProvinces(regionCode);
  }

  listCities(provinceCode: string): Promise<PsgcCityOption[]> {
    return this.deps.psgcRepository.listCities(provinceCode);
  }

  listBarangays(cityMunicipalityCode: string): Promise<PsgcOption[]> {
    return this.deps.psgcRepository.listBarangays(cityMunicipalityCode);
  }

  resolveAddressCodes(names: { province?: string; cityMunicipality?: string; barangay?: string }): Promise<ResolvedAddressCodes> {
    return this.deps.psgcRepository.resolveAddressCodes(names);
  }
}
