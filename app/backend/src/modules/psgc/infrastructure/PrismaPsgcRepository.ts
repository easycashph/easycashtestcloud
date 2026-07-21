import { prisma } from '@shared/database/prismaClient';
import type {
  IPsgcRepository,
  PsgcBarangayOption,
  PsgcCityOption,
  PsgcOption,
  ResolvedAddressCodes,
} from '../application/ports/IPsgcRepository';

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

  async listBarangays(cityMunicipalityCode: string): Promise<PsgcBarangayOption[]> {
    return prisma.psgcBarangay.findMany({
      where: { cityMunicipalityCode },
      select: { code: true, name: true, zipCode: true },
      orderBy: { name: 'asc' },
    });
  }

  async resolveAddressCodes(names: {
    province?: string;
    cityMunicipality?: string;
    barangay?: string;
  }): Promise<ResolvedAddressCodes> {
    const result: ResolvedAddressCodes = {
      regionCode: null,
      provinceCode: null,
      cityMunicipalityCode: null,
      barangayCode: null,
    };

    if (!names.province) return result;
    const province = await prisma.psgcProvince.findFirst({
      where: { name: { equals: names.province, mode: 'insensitive' } },
      select: { code: true, regionCode: true },
    });
    if (!province) return result;
    result.regionCode = province.regionCode;
    result.provinceCode = province.code;

    if (!names.cityMunicipality) return result;
    const city = await prisma.psgcCityMunicipality.findFirst({
      where: { name: { equals: names.cityMunicipality, mode: 'insensitive' }, provinceCode: province.code },
      select: { code: true },
    });
    if (!city) return result;
    result.cityMunicipalityCode = city.code;

    if (!names.barangay) return result;
    const barangay = await prisma.psgcBarangay.findFirst({
      where: { name: { equals: names.barangay, mode: 'insensitive' }, cityMunicipalityCode: city.code },
      select: { code: true },
    });
    if (!barangay) return result;
    result.barangayCode = barangay.code;

    return result;
  }
}
