import * as React from 'react';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { apiClient } from '@/lib/apiClient';
import type { PsgcBarangayOption, PsgcCityOption, PsgcOption } from '@/lib/portalApiTypes';
import { toProperCase } from '@/lib/utils';

export interface AddressDraft {
  houseUnitNumber: string;
  street: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  zipCode: string;
}

export function emptyAddressDraft(): AddressDraft {
  return { houseUnitNumber: '', street: '', barangay: '', cityMunicipality: '', province: '', zipCode: '' };
}

function usePsgcOptions<T extends PsgcOption = PsgcOption>(path: string, enabled: boolean) {
  const [data, setData] = React.useState<T[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) {
      setData([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    apiClient
      .get<{ items: T[] }>(path)
      .then((res) => {
        if (!cancelled) setData(res.items);
      })
      .catch(() => {
        if (!cancelled) setData([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, enabled]);

  return { data, isLoading };
}

/**
 * Region -> Province -> City/Municipality -> Barangay cascading picker for the Easycash Portal's
 * loan application form, backed by the same PSGC reference data as the internal LMS's own
 * PsgcAddressPicker (app/frontend/src/components/PsgcAddressPicker.tsx) via a portal-facing
 * mirror of that API (`GET /portal/psgc/*`, requirePortalAuth - see backend's
 * portalPsgcRouter.ts). Deliberately a simpler plain-fetch port, not React Query (the portal app
 * doesn't depend on it) - no reverse-lookup-on-load behavior either, since this form only ever
 * starts blank (no "edit an existing application's address" flow exists yet).
 *
 * `value`/`onChange` only ever carry resolved *names*, matching the wire shape
 * SubmitLoanApplicationRequest already expects - the cascade itself is driven by PSGC codes
 * internally, never exposed to the caller.
 */
export function PortalAddressPicker({ value, onChange }: { value: AddressDraft; onChange: (patch: Partial<AddressDraft>) => void }) {
  const [regionCode, setRegionCode] = React.useState('');
  const [provinceCode, setProvinceCode] = React.useState('');
  const [cityCode, setCityCode] = React.useState('');
  const [barangayCode, setBarangayCode] = React.useState('');

  const regions = usePsgcOptions('/portal/psgc/regions', true);
  const provinces = usePsgcOptions(`/portal/psgc/provinces?regionCode=${regionCode}`, Boolean(regionCode));
  const cities = usePsgcOptions<PsgcCityOption>(`/portal/psgc/cities?provinceCode=${provinceCode}`, Boolean(provinceCode));
  const barangays = usePsgcOptions<PsgcBarangayOption>(`/portal/psgc/barangays?cityMunicipalityCode=${cityCode}`, Boolean(cityCode));

  // Tracks the last ZIP this component suggested, so a later upgrade (city -> barangay level)
  // never clobbers a ZIP the applicant has since typed in themselves - same guard as the internal
  // LMS's own picker.
  const lastSuggestedZip = React.useRef<string | null>(null);

  const pickRegion = (code: string) => {
    setRegionCode(code);
    setProvinceCode('');
    setCityCode('');
    setBarangayCode('');
    onChange({ province: '', cityMunicipality: '', barangay: '' });
  };

  const pickProvince = (code: string) => {
    setProvinceCode(code);
    setCityCode('');
    setBarangayCode('');
    const name = toProperCase(provinces.data.find((p) => p.code === code)?.name ?? '');
    onChange({ province: name, cityMunicipality: '', barangay: '' });
  };

  const pickCity = (code: string) => {
    setCityCode(code);
    setBarangayCode('');
    const city = cities.data.find((c) => c.code === code);
    lastSuggestedZip.current = city?.zipCode ?? null;
    onChange({ cityMunicipality: toProperCase(city?.name ?? ''), barangay: '', zipCode: city?.zipCode ?? '' });
  };

  const pickBarangay = (code: string) => {
    setBarangayCode(code);
    const barangay = barangays.data.find((b) => b.code === code);
    const patch: Partial<AddressDraft> = { barangay: toProperCase(barangay?.name ?? '') };
    if (barangay?.zipCode) {
      lastSuggestedZip.current = barangay.zipCode;
      patch.zipCode = barangay.zipCode;
    }
    onChange(patch);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Region</Label>
          <Select value={regionCode} onChange={(e) => pickRegion(e.target.value)}>
            <option value="">{regions.isLoading ? 'Loading…' : 'Select region'}</option>
            {regions.data.map((r) => (
              <option key={r.code} value={r.code}>
                {toProperCase(r.name)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Province</Label>
          <Select value={provinceCode} onChange={(e) => pickProvince(e.target.value)} disabled={!regionCode}>
            <option value="">{!regionCode ? 'Select a region first' : provinces.isLoading ? 'Loading…' : 'Select province'}</option>
            {provinces.data.map((p) => (
              <option key={p.code} value={p.code}>
                {toProperCase(p.name)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>City / Municipality</Label>
          <Select value={cityCode} onChange={(e) => pickCity(e.target.value)} disabled={!provinceCode}>
            <option value="">{!provinceCode ? 'Select a province first' : cities.isLoading ? 'Loading…' : 'Select city/municipality'}</option>
            {cities.data.map((c) => (
              <option key={c.code} value={c.code}>
                {toProperCase(c.name)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Barangay</Label>
          <Select value={barangayCode} onChange={(e) => pickBarangay(e.target.value)} disabled={!cityCode}>
            <option value="">{!cityCode ? 'Select a city/municipality first' : barangays.isLoading ? 'Loading…' : 'Select barangay'}</option>
            {barangays.data.map((b) => (
              <option key={b.code} value={b.code}>
                {toProperCase(b.name)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>House / Unit / Bldg. No.</Label>
          <Input value={value.houseUnitNumber} onChange={(e) => onChange({ houseUnitNumber: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Street</Label>
          <Input value={value.street} onChange={(e) => onChange({ street: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>ZIP code</Label>
          <Input value={value.zipCode} onChange={(e) => onChange({ zipCode: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
