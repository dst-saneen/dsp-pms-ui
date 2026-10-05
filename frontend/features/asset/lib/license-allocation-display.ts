/** Normalise license-allocation API rows for HR tables. */

export interface LicenseAllocationApiRow {
  id: string;
  version: number;
  status: string;
  assetId?: string | null;
  allocatedAt?: string | null;
  allocatedDate?: string | null;
  acknowledgedAt?: string | null;
  allowedActions?: string[];
  employee?: {
    id?: string;
    code?: string;
    name?: string;
    employeeCode?: string;
    firstName?: string;
    lastName?: string;
  } | null;
  /** Current API field */
  pool?: {
    id?: string;
    version?: number;
    assetCode?: string;
    assetName?: string;
    softwareLicenseDetail?: { seatCapacity?: number };
  } | null;
  /** Historical / alternate shape */
  asset?: {
    id?: string;
    version?: number;
    assetCode?: string;
    assetName?: string;
    softwareLicenseDetail?: { seatCapacity?: number };
  } | null;
}

export interface NormalizedLicenseSeat {
  id: string;
  version: number;
  status: string;
  allowedActions: string[];
  employeeLabel: string;
  licenceName: string;
  licenceCode: string;
  givenOn: string | null;
  pendingAck: boolean;
  poolId: string | null;
  poolVersion: number | undefined;
}

function formatGivenOn(value?: string | null) {
  if (!value) return null;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}/.test(day)) return null;
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function normalizeLicenseAllocation(
  row: LicenseAllocationApiRow,
): NormalizedLicenseSeat {
  const pool = row.pool ?? row.asset ?? null;
  const employee = row.employee;
  const nameFromParts = [employee?.firstName, employee?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const name = (employee?.name ?? nameFromParts).trim();
  const code = employee?.code ?? employee?.employeeCode ?? "";
  const employeeLabel =
    code && name ? `${code} · ${name}` : name || code || "Unknown employee";

  return {
    id: row.id,
    version: row.version,
    status: row.status,
    allowedActions: row.allowedActions ?? [],
    employeeLabel,
    licenceName: pool?.assetName?.trim() || "Unknown licence",
    licenceCode: pool?.assetCode?.trim() || "—",
    givenOn: formatGivenOn(row.allocatedAt ?? row.allocatedDate),
    pendingAck: !row.acknowledgedAt,
    poolId: pool?.id ?? row.assetId ?? null,
    poolVersion: pool?.version,
  };
}
