/**
 * Geographic model for Business Calendar imports (work order §18.4).
 * ISO 3166-1 alpha-2 countries + ISO 3166-2 subdivisions (India states/UTs + ME).
 */

export type Jurisdiction = {
  countryCode: string;
  countryName: string;
  subdivisionCode: string | null;
  subdivisionName: string | null;
  region: 'INDIA' | 'MIDDLE_EAST' | 'OTHER';
};

/** India States and Union Territories (ISO 3166-2:IN). */
export const INDIA_SUBDIVISIONS: ReadonlyArray<{
  code: string;
  name: string;
}> = [
  { code: 'IN-AN', name: 'Andaman and Nicobar Islands' },
  { code: 'IN-AP', name: 'Andhra Pradesh' },
  { code: 'IN-AR', name: 'Arunachal Pradesh' },
  { code: 'IN-AS', name: 'Assam' },
  { code: 'IN-BR', name: 'Bihar' },
  { code: 'IN-CH', name: 'Chandigarh' },
  { code: 'IN-CT', name: 'Chhattisgarh' },
  { code: 'IN-DH', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: 'IN-DL', name: 'Delhi' },
  { code: 'IN-GA', name: 'Goa' },
  { code: 'IN-GJ', name: 'Gujarat' },
  { code: 'IN-HR', name: 'Haryana' },
  { code: 'IN-HP', name: 'Himachal Pradesh' },
  { code: 'IN-JK', name: 'Jammu and Kashmir' },
  { code: 'IN-JH', name: 'Jharkhand' },
  { code: 'IN-KA', name: 'Karnataka' },
  { code: 'IN-KL', name: 'Kerala' },
  { code: 'IN-LA', name: 'Ladakh' },
  { code: 'IN-LD', name: 'Lakshadweep' },
  { code: 'IN-MP', name: 'Madhya Pradesh' },
  { code: 'IN-MH', name: 'Maharashtra' },
  { code: 'IN-MN', name: 'Manipur' },
  { code: 'IN-ML', name: 'Meghalaya' },
  { code: 'IN-MZ', name: 'Mizoram' },
  { code: 'IN-NL', name: 'Nagaland' },
  { code: 'IN-OD', name: 'Odisha' },
  { code: 'IN-PY', name: 'Puducherry' },
  { code: 'IN-PB', name: 'Punjab' },
  { code: 'IN-RJ', name: 'Rajasthan' },
  { code: 'IN-SK', name: 'Sikkim' },
  { code: 'IN-TN', name: 'Tamil Nadu' },
  { code: 'IN-TS', name: 'Telangana' },
  { code: 'IN-TR', name: 'Tripura' },
  { code: 'IN-UP', name: 'Uttar Pradesh' },
  { code: 'IN-UK', name: 'Uttarakhand' },
  { code: 'IN-WB', name: 'West Bengal' },
];

/** Middle East focus countries with optional subdivision (Emirate / Province). */
export const MIDDLE_EAST_COUNTRIES: ReadonlyArray<{
  code: string;
  name: string;
  subdivisions: ReadonlyArray<{ code: string; name: string }>;
}> = [
  {
    code: 'AE',
    name: 'United Arab Emirates',
    subdivisions: [
      { code: 'AE-AZ', name: 'Abu Dhabi' },
      { code: 'AE-AJ', name: 'Ajman' },
      { code: 'AE-DU', name: 'Dubai' },
      { code: 'AE-FU', name: 'Fujairah' },
      { code: 'AE-RK', name: 'Ras Al Khaimah' },
      { code: 'AE-SH', name: 'Sharjah' },
      { code: 'AE-UQ', name: 'Umm Al Quwain' },
    ],
  },
  { code: 'SA', name: 'Saudi Arabia', subdivisions: [] },
  { code: 'QA', name: 'Qatar', subdivisions: [] },
  { code: 'BH', name: 'Bahrain', subdivisions: [] },
  { code: 'KW', name: 'Kuwait', subdivisions: [] },
  { code: 'OM', name: 'Oman', subdivisions: [] },
  { code: 'JO', name: 'Jordan', subdivisions: [] },
  { code: 'EG', name: 'Egypt', subdivisions: [] },
];

const INDIA_SET = new Set(INDIA_SUBDIVISIONS.map((row) => row.code));
const ME_COUNTRY_SET = new Set(MIDDLE_EAST_COUNTRIES.map((row) => row.code));
const ME_SUBDIVISION_SET = new Set(
  MIDDLE_EAST_COUNTRIES.flatMap((c) => c.subdivisions.map((s) => s.code)),
);

export function listSupportedJurisdictions(): Jurisdiction[] {
  const rows: Jurisdiction[] = [
    {
      countryCode: 'IN',
      countryName: 'India',
      subdivisionCode: null,
      subdivisionName: null,
      region: 'INDIA',
    },
    ...INDIA_SUBDIVISIONS.map((s) => ({
      countryCode: 'IN',
      countryName: 'India',
      subdivisionCode: s.code,
      subdivisionName: s.name,
      region: 'INDIA' as const,
    })),
  ];

  for (const country of MIDDLE_EAST_COUNTRIES) {
    rows.push({
      countryCode: country.code,
      countryName: country.name,
      subdivisionCode: null,
      subdivisionName: null,
      region: 'MIDDLE_EAST',
    });
    for (const sub of country.subdivisions) {
      rows.push({
        countryCode: country.code,
        countryName: country.name,
        subdivisionCode: sub.code,
        subdivisionName: sub.name,
        region: 'MIDDLE_EAST',
      });
    }
  }

  return rows;
}

export function isValidCountryCode(code: string | null | undefined): boolean {
  if (!code) return true;
  const normalized = code.trim().toUpperCase();
  return (
    normalized === 'IN' ||
    ME_COUNTRY_SET.has(normalized) ||
    /^[A-Z]{2}$/.test(normalized)
  );
}

export function isValidSubdivisionCode(
  countryCode: string | null | undefined,
  subdivisionCode: string | null | undefined,
): boolean {
  if (!subdivisionCode) return true;
  const sub = subdivisionCode.trim().toUpperCase();
  const country = (countryCode ?? '').trim().toUpperCase();

  if (country === 'IN' || sub.startsWith('IN-')) {
    return INDIA_SET.has(sub);
  }
  if (ME_COUNTRY_SET.has(country) || ME_SUBDIVISION_SET.has(sub)) {
    if (!country || ME_COUNTRY_SET.has(country)) {
      if (ME_SUBDIVISION_SET.has(sub)) {
        return sub.startsWith(`${country}-`) || !country;
      }
      // Country-level ME codes without subdivisions are allowed empty only.
      return false;
    }
  }
  // Unknown country: accept ISO-looking codes for forward compatibility.
  return /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(sub);
}

export function assertSupportedImportGeography(input: {
  countryCode?: string | null;
  subdivisionCode?: string | null;
}): string | null {
  const country = input.countryCode?.trim().toUpperCase() || null;
  const subdivision = input.subdivisionCode?.trim().toUpperCase() || null;

  if (country && !isValidCountryCode(country)) {
    return `Invalid country code: ${country}`;
  }
  if (subdivision && !isValidSubdivisionCode(country, subdivision)) {
    return `Invalid subdivision code for ${country ?? 'unknown'}: ${subdivision}`;
  }
  if (subdivision?.startsWith('IN-') && country && country !== 'IN') {
    return 'India subdivision requires countryCode IN';
  }
  return null;
}
