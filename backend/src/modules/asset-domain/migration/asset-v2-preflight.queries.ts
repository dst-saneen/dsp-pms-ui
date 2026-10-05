export const ASSET_V2_PREFLIGHT_ID_LIMIT = 200;

export const KNOWN_LEGACY_ASSET_STATUSES = [
  'AVAILABLE',
  'ASSIGNED',
  'REPAIR',
  'LOST',
  'DISPOSED',
] as const;

export const KNOWN_LEGACY_CUSTODY_STATUSES = [
  'ASSIGNED',
  'RETURNED',
  'DAMAGED',
  'LOST',
] as const;

export type AssetV2FindingCode =
  | 'ASSET_MISSING_BRANCH'
  | 'ASSET_REQUIRES_DEPARTMENT'
  | 'TYPE_REQUIRES_KIND_TRACKING'
  | 'HARDWARE_MISSING_SERIAL'
  | 'LOCATION_MISSING_LOCATION'
  | 'CARD_MISSING_PROTECTED_DATA'
  | 'SOFTWARE_MISSING_POOL_DATA'
  | 'OPEN_CUSTODY_BRANCH_MISMATCH'
  | 'OPEN_CUSTODY_ON_LOCATION_OR_POOL'
  | 'INACTIVE_MISSING_ARCHIVED_AT'
  | 'COMPANY_RELATIONSHIP_DRIFT'
  | 'DUPLICATE_SERIAL'
  | 'DUPLICATE_CARD_DIGEST'
  | 'MULTIPLE_OPEN_ASSIGNMENTS'
  | 'STATUS_ASSIGNMENT_DRIFT'
  | 'TERMINAL_EMPLOYEE_OPEN_CUSTODY'
  | 'RETURN_BEFORE_ASSIGN'
  | 'UNKNOWN_ASSET_STATUS'
  | 'UNKNOWN_CUSTODY_STATUS'
  | 'CUSTODY_SNAPSHOT_MISSING'
  | 'OPEN_CUSTODY_TERMINAL_STATUS'
  | 'TERMINAL_CUSTODY_MISSING_CLOSED_AT'
  | 'CLEARANCE_DUPLICATE_ASSET_SUMMARY'
  | 'CLEARANCE_MISSING_ASSET_SUMMARY'
  | 'TERMINAL_CLEARANCE_LIVE_CUSTODY';

export interface AssetV2SqlCheck {
  code: AssetV2FindingCode;
  sql: string;
}

function idSelect(sql: string): string {
  return `${sql.trim().replace(/;+\s*$/, '')} LIMIT ${ASSET_V2_PREFLIGHT_ID_LIMIT}`;
}

/** Read-only exception queries (plan §5.2 / §5.4). Each statement returns `id`. */
export const ASSET_V2_PREFLIGHT_CHECKS: readonly AssetV2SqlCheck[] = [
  {
    code: 'ASSET_MISSING_BRANCH',
    sql: idSelect(`
      SELECT a.id
      FROM assets a
      WHERE a."branchId" IS NULL
      ORDER BY a.id
    `),
  },
  {
    code: 'ASSET_REQUIRES_DEPARTMENT',
    sql: idSelect(`
      SELECT a.id
      FROM assets a
      WHERE a."departmentId" IS NULL
      ORDER BY a.id
    `),
  },
  {
    code: 'TYPE_REQUIRES_KIND_TRACKING',
    sql: idSelect(`
      SELECT t.id
      FROM asset_types t
      WHERE t.kind IS NULL OR t."trackingMode" IS NULL
      ORDER BY t.id
    `),
  },
  {
    code: 'HARDWARE_MISSING_SERIAL',
    sql: idSelect(`
      SELECT a.id
      FROM assets a
      WHERE a.kind = 'HARDWARE'
        AND nullif(trim(a."serialNumberNormalized"), '') IS NULL
      ORDER BY a.id
    `),
  },
  {
    code: 'LOCATION_MISSING_LOCATION',
    sql: idSelect(`
      SELECT a.id
      FROM assets a
      WHERE a."trackingMode" = 'LOCATION'
        AND nullif(trim(a.location), '') IS NULL
      ORDER BY a.id
    `),
  },
  {
    code: 'CARD_MISSING_PROTECTED_DATA',
    sql: idSelect(`
      SELECT a.id
      FROM assets a
      LEFT JOIN asset_card_details cd ON cd."assetId" = a.id
      WHERE a.kind = 'CARD' AND cd."assetId" IS NULL
      ORDER BY a.id
    `),
  },
  {
    code: 'SOFTWARE_MISSING_POOL_DATA',
    sql: idSelect(`
      SELECT a.id
      FROM assets a
      LEFT JOIN asset_software_license_details ld ON ld."assetId" = a.id
      WHERE a.kind = 'SOFTWARE_LICENSE' AND ld."assetId" IS NULL
      ORDER BY a.id
    `),
  },
  {
    code: 'OPEN_CUSTODY_BRANCH_MISMATCH',
    sql: idSelect(`
      SELECT ea.id
      FROM employee_assets ea
      JOIN assets a ON a.id = ea."assetId"
      JOIN employees e ON e.id = ea."employeeId"
      WHERE ea.status = 'ASSIGNED'
        AND ea."returnedDate" IS NULL
        AND a."branchId" IS NOT NULL
        AND e."branchId" <> a."branchId"
      ORDER BY ea.id
    `),
  },
  {
    code: 'OPEN_CUSTODY_ON_LOCATION_OR_POOL',
    sql: idSelect(`
      SELECT ea.id
      FROM employee_assets ea
      JOIN assets a ON a.id = ea."assetId"
      WHERE ea.status = 'ASSIGNED'
        AND ea."returnedDate" IS NULL
        AND a."trackingMode" IN ('LOCATION', 'POOL')
      ORDER BY ea.id
    `),
  },
  {
    code: 'INACTIVE_MISSING_ARCHIVED_AT',
    sql: idSelect(`
      SELECT c.id
      FROM asset_categories c
      WHERE c."isActive" = false AND c."archivedAt" IS NULL
      UNION ALL
      SELECT t.id
      FROM asset_types t
      WHERE t."isActive" = false AND t."archivedAt" IS NULL
      UNION ALL
      SELECT a.id
      FROM assets a
      WHERE a."isActive" = false AND a."archivedAt" IS NULL
    `),
  },
  {
    code: 'COMPANY_RELATIONSHIP_DRIFT',
    sql: idSelect(`
      SELECT a.id
      FROM assets a
      JOIN asset_types t ON t.id = a."assetTypeId"
      JOIN asset_categories c ON c.id = t."assetCategoryId"
      LEFT JOIN departments d ON d.id = a."departmentId"
      WHERE t."companyId" <> a."companyId"
         OR c."companyId" <> a."companyId"
         OR (a."departmentId" IS NOT NULL AND (
           d.id IS NULL OR d."companyId" <> a."companyId"
           OR (a."branchId" IS NOT NULL AND d."branchId" <> a."branchId")
         ))
      ORDER BY a.id
    `),
  },
  {
    code: 'DUPLICATE_SERIAL',
    sql: idSelect(`
      SELECT a.id
      FROM assets a
      WHERE a."serialNumberNormalized" IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM assets b
          WHERE b."companyId" = a."companyId"
            AND b."serialNumberNormalized" = a."serialNumberNormalized"
            AND b.id <> a.id
        )
      ORDER BY a.id
    `),
  },
  {
    code: 'DUPLICATE_CARD_DIGEST',
    sql: idSelect(`
      SELECT i."assetId" AS id
      FROM asset_card_lookup_indexes i
      WHERE EXISTS (
        SELECT 1
        FROM asset_card_lookup_indexes j
        WHERE j."companyId" = i."companyId"
          AND j."lookupKeyVersion" = i."lookupKeyVersion"
          AND j.digest = i.digest
          AND j.id <> i.id
      )
      ORDER BY i."assetId"
    `),
  },
  {
    code: 'MULTIPLE_OPEN_ASSIGNMENTS',
    sql: idSelect(`
      SELECT ea.id
      FROM employee_assets ea
      WHERE ea.status = 'ASSIGNED'
        AND ea."returnedDate" IS NULL
        AND ea."assetId" IN (
          SELECT "assetId"
          FROM employee_assets
          WHERE status = 'ASSIGNED' AND "returnedDate" IS NULL
          GROUP BY "assetId"
          HAVING COUNT(*) > 1
        )
      ORDER BY ea.id
    `),
  },
  {
    code: 'STATUS_ASSIGNMENT_DRIFT',
    sql: idSelect(`
      SELECT a.id
      FROM assets a
      WHERE (
        a.status = 'ASSIGNED'
        AND NOT EXISTS (
          SELECT 1 FROM employee_assets ea
          WHERE ea."assetId" = a.id
            AND ea.status = 'ASSIGNED'
            AND ea."returnedDate" IS NULL
        )
      ) OR (
        a.status = 'AVAILABLE'
        AND EXISTS (
          SELECT 1 FROM employee_assets ea
          WHERE ea."assetId" = a.id
            AND ea.status = 'ASSIGNED'
            AND ea."returnedDate" IS NULL
        )
      )
      ORDER BY a.id
    `),
  },
  {
    code: 'TERMINAL_EMPLOYEE_OPEN_CUSTODY',
    sql: idSelect(`
      SELECT e.id
      FROM employees e
      WHERE (e."isActive" = false OR e."employmentStatus" IN ('RESIGNED', 'TERMINATED'))
        AND (
          EXISTS (
            SELECT 1 FROM employee_assets ea
            WHERE ea."employeeId" = e.id
              AND ea.status = 'ASSIGNED'
              AND ea."returnedDate" IS NULL
          ) OR EXISTS (
            SELECT 1 FROM software_license_allocations la
            WHERE la."employeeId" = e.id AND la.status = 'ACTIVE'
          )
        )
      ORDER BY e.id
    `),
  },
  {
    code: 'RETURN_BEFORE_ASSIGN',
    sql: idSelect(`
      SELECT ea.id
      FROM employee_assets ea
      WHERE ea."returnedDate" IS NOT NULL
        AND ea."returnedDate" < ea."assignedDate"
      ORDER BY ea.id
    `),
  },
  {
    code: 'UNKNOWN_ASSET_STATUS',
    sql: idSelect(`
      SELECT a.id
      FROM assets a
      WHERE a.status NOT IN ('AVAILABLE', 'ASSIGNED', 'REPAIR', 'LOST', 'DISPOSED')
      ORDER BY a.id
    `),
  },
  {
    code: 'UNKNOWN_CUSTODY_STATUS',
    sql: idSelect(`
      SELECT ea.id
      FROM employee_assets ea
      WHERE ea.status NOT IN ('ASSIGNED', 'RETURNED', 'DAMAGED', 'LOST')
      ORDER BY ea.id
    `),
  },
  {
    code: 'CUSTODY_SNAPSHOT_MISSING',
    sql: idSelect(`
      SELECT ea.id
      FROM employee_assets ea
      LEFT JOIN departments d
        ON d.id = ea."departmentIdAtAssignment"
       AND d."companyId" = ea."companyId"
       AND d."branchId" = ea."branchIdAtAssignment"
      WHERE ea."companyId" IS NULL
         OR ea."branchIdAtAssignment" IS NULL
         OR ea."departmentIdAtAssignment" IS NULL
         OR d.id IS NULL
      ORDER BY ea.id
    `),
  },
  {
    code: 'OPEN_CUSTODY_TERMINAL_STATUS',
    sql: idSelect(`
      SELECT ea.id
      FROM employee_assets ea
      WHERE ea.status = 'ASSIGNED'
        AND (
          ea."returnedDate" IS NOT NULL
          OR COALESCE(ea."custodyStatus"::text, 'ASSIGNED') IN ('RETURNED', 'DAMAGED', 'LOST', 'WAIVED')
        )
      ORDER BY ea.id
    `),
  },
  {
    code: 'TERMINAL_CUSTODY_MISSING_CLOSED_AT',
    sql: idSelect(`
      SELECT ea.id
      FROM employee_assets ea
      WHERE ea.status IN ('RETURNED', 'DAMAGED', 'LOST')
        AND COALESCE(ea."closedAt", ea."returnedDate") IS NULL
      ORDER BY ea.id
    `),
  },
  {
    code: 'CLEARANCE_DUPLICATE_ASSET_SUMMARY',
    sql: idSelect(`
      SELECT i."clearanceId" AS id
      FROM employee_clearance_items i
      WHERE i."clearanceType" = 'ASSET'
      GROUP BY i."clearanceId"
      HAVING COUNT(*) > 1
    `),
  },
  {
    code: 'CLEARANCE_MISSING_ASSET_SUMMARY',
    sql: idSelect(`
      SELECT c.id
      FROM employee_clearances c
      JOIN employee_separations s ON s.id = c."separationId"
      WHERE c.status IN ('PENDING', 'IN_PROGRESS')
        AND NOT EXISTS (
          SELECT 1 FROM employee_clearance_items i
          WHERE i."clearanceId" = c.id AND i."clearanceType" = 'ASSET'
        )
      ORDER BY c.id
    `),
  },
  {
    code: 'TERMINAL_CLEARANCE_LIVE_CUSTODY',
    sql: idSelect(`
      SELECT c.id
      FROM employee_clearances c
      JOIN employee_separations s ON s.id = c."separationId"
      WHERE (c.status = 'COMPLETED' OR s.status IN ('COMPLETED', 'REJECTED'))
        AND (
          EXISTS (
            SELECT 1 FROM employee_assets ea
            WHERE ea."employeeId" = s."employeeId"
              AND ea.status = 'ASSIGNED'
              AND ea."returnedDate" IS NULL
          ) OR EXISTS (
            SELECT 1 FROM software_license_allocations la
            WHERE la."employeeId" = s."employeeId" AND la.status = 'ACTIVE'
          )
        )
      ORDER BY c.id
    `),
  },
];

export function isKnownLegacyAssetStatus(status: string): boolean {
  return (KNOWN_LEGACY_ASSET_STATUSES as readonly string[]).includes(status);
}

export function isKnownLegacyCustodyStatus(status: string): boolean {
  return (KNOWN_LEGACY_CUSTODY_STATUSES as readonly string[]).includes(status);
}
