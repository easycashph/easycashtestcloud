import { prisma } from '@shared/database/prismaClient';
import type { IPsgcRepository, PsgcCityOption, PsgcOption } from '../application/ports/IPsgcRepository';

/** Static reference data (regions/provinces/cities/barangays) — plain sorted findMany, no branch scoping applies. */
export class PrismaPsgcRepository implements IPsgcRepository {
  async listRegions(): Promise<PsgcOption[]> {
    return prisma.psgcRegion.findMany({ select: { code: true, name: true }, orderBy: { name: 'asc' } });
  }

  async listProvinces(regionCode: string): Promise<PsgcOption[]> {
    return prisma.psgcProvince.findMany({
      where: { regionCode },
      select: { code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async listCities(provinceCode: string): Promise<PsgcCityOption[]> {
    return prisma.psgcCityMunicipality.findMany({
      where: { provinceCode },
      select: { code: true, name: true, zipCode: true },
      orderBy: { name: 'asc' },
    });
  }

  async listBarangays(cityMunicipalityCode: string): Promise<PsgcOption[]> {
    return prisma.psgcBarangay.findMany({
      where: { cityMunicipalityCode },
      select: { code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
