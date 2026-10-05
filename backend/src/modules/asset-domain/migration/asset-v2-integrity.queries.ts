export type AssetV2IntegrityCheckName =
  | 'missing_invalid_ownership'
  | 'duplicate_active_physical_custody'
  | 'licence_capacity_drift'
  | 'terminal_employees_with_active_custody'
  | 'operational_state_violations'
  | 'classification_subtype_drift'
  | 'legacy_mirror_drift'
  | 'invalid_clearance_linkage'
  | 'invalid_waiver_approval';

export interface AssetV2IntegrityQuery {
  name: AssetV2IntegrityCheckName;
  sql: string;
}

function idSelect(sql: string): string {
  return `${sql.trim().replace(/;+\s*$/, '')} LIMIT 200`;
}

/** Plan §14 integrity queries. Each returns `id` and must be empty after contract. */
export const ASSET_V2_INTEGRITY_QUERIES: readonly AssetV2IntegrityQuery[] = [
  {
    name: 'missing_invalid_ownership',
    sql: idSelect(`
      SELECT a.id
      FROM assets a
      LEFT JOIN departments d ON d.id = a."departmentId"
      WHERE a."archivedAt" IS NULL
        AND (
          a."departmentId" IS NULL OR
          a."branchId" IS NULL OR
          d.id IS NULL OR
          d."companyId" <> a."companyId" OR
          d."branchId" <> a."branchId"
        )
    `),
  },
  {
    name: 'duplicate_active_physical_custody',
    sql: idSelect(`
      SELECT "assetId" AS id
      FROM employee_assets
      WHERE "custodyStatus" = 'ASSIGNED' AND "closedAt" IS NULL
      GROUP BY "assetId"
      HAVING COUNT(*) > 1
    `),
  },
  {
    name: 'licence_capacity_drift',
    sql: idSelect(`
      SELECT d."assetId" AS id
      FROM asset_software_license_details d
      LEFT JOIN software_license_allocations a ON a."assetId" = d."assetId"
      GROUP BY d."assetId", d."seatCapacity", d."allocatedSeatCount"
      HAVING d."allocatedSeatCount" <> COUNT(a.id) FILTER (WHERE a.status = 'ACTIVE')
          OR d."allocatedSeatCount" > d."seatCapacity"
    `),
  },
  {
    name: 'terminal_employees_with_active_custody',
    sql: idSelect(`
      SELECT e.id
      FROM employees e
      WHERE (e."isActive" = false OR e."employmentStatus" IN ('RESIGNED', 'TERMINATED'))
        AND (
          EXISTS (
            SELECT 1 FROM employee_assets ea
            WHERE ea."employeeId" = e.id
              AND ea."custodyStatus" = 'ASSIGNED'
              AND ea."closedAt" IS NULL
          ) OR EXISTS (
            SELECT 1 FROM software_license_allocations la
            WHERE la."employeeId" = e.id AND la.status = 'ACTIVE'
          )
        )
    `),
  },
  {
    name: 'operational_state_violations',
    sql: idSelect(`
      SELECT a.id
      FROM assets a
      WHERE EXISTS (
        SELECT 1 FROM employee_assets ea
        WHERE ea."assetId" = a.id
          AND ea."custodyStatus" = 'ASSIGNED'
          AND ea."closedAt" IS NULL
          AND (a."archivedAt" IS NOT NULL OR a."trackingMode" <> 'INDIVIDUAL'
               OR a."lifecycleStatus" <> 'ACTIVE')
      )
      OR EXISTS (
        SELECT 1
        FROM software_license_allocations la
        JOIN asset_software_license_details ld ON ld."assetId" = a.id
        WHERE la."assetId" = a.id AND la.status = 'ACTIVE'
          AND (a."archivedAt" IS NOT NULL OR a.kind <> 'SOFTWARE_LICENSE'
               OR a."trackingMode" <> 'POOL'
               OR a."lifecycleStatus" NOT IN ('ACTIVE', 'SUSPENDED')
               OR (ld."expiresOn" IS NOT NULL AND ld."expiresOn" < CURRENT_DATE))
      )
    `),
  },
  {
    name: 'classification_subtype_drift',
    sql: idSelect(`
      SELECT a.id
      FROM assets a
      JOIN asset_types t ON t.id = a."assetTypeId"
      LEFT JOIN asset_card_details cd ON cd."assetId" = a.id
      LEFT JOIN asset_software_license_details ld ON ld."assetId" = a.id
      WHERE a.kind <> t.kind
         OR a."trackingMode" <> t."trackingMode"
         OR (a.kind = 'CARD' AND (cd."assetId" IS NULL OR ld."assetId" IS NOT NULL))
         OR (a.kind = 'SOFTWARE_LICENSE' AND (ld."assetId" IS NULL OR cd."assetId" IS NOT NULL))
         OR (a.kind NOT IN ('CARD', 'SOFTWARE_LICENSE')
             AND (cd."assetId" IS NOT NULL OR ld."assetId" IS NOT NULL))
         OR (a.kind = 'HARDWARE' AND nullif(trim(a."serialNumberNormalized"), '') IS NULL)
         OR (a."trackingMode" = 'LOCATION' AND nullif(trim(a.location), '') IS NULL)
    `),
  },
  {
    name: 'legacy_mirror_drift',
    sql: idSelect(`
      SELECT a.id
      FROM assets a
      WHERE a."isActive" <> (a."archivedAt" IS NULL)
         OR a.status <> CASE
           WHEN a."lifecycleStatus" = 'ACTIVE'
             AND a."trackingMode" = 'INDIVIDUAL'
             AND EXISTS (
               SELECT 1 FROM employee_assets ea
               WHERE ea."assetId" = a.id
                 AND ea."custodyStatus" = 'ASSIGNED' AND ea."closedAt" IS NULL
             ) THEN 'ASSIGNED'
           WHEN a."lifecycleStatus" = 'ACTIVE' THEN 'AVAILABLE'
           WHEN a."lifecycleStatus" IN ('IN_REPAIR', 'SUSPENDED') THEN 'REPAIR'
           WHEN a."lifecycleStatus" = 'LOST' THEN 'LOST'
           WHEN a."lifecycleStatus" IN ('DISPOSED', 'RETIRED') THEN 'DISPOSED'
         END
      UNION ALL
      SELECT c.id
      FROM asset_categories c
      WHERE c."isActive" <> (c."archivedAt" IS NULL)
      UNION ALL
      SELECT t.id
      FROM asset_types t
      WHERE t."isActive" <> (t."archivedAt" IS NULL)
      UNION ALL
      SELECT ea.id
      FROM employee_assets ea
      WHERE ea.status <> CASE
        WHEN ea."custodyStatus" = 'WAIVED' THEN 'LOST'
        ELSE ea."custodyStatus"::text
      END
    `),
  },
  {
    name: 'invalid_clearance_linkage',
    sql: idSelect(`
      SELECT i.id
      FROM asset_clearance_items i
      JOIN employee_clearance_items s ON s.id = i."clearanceSummaryItemId"
      JOIN employee_clearances c ON c.id = i."clearanceId"
      JOIN employee_separations sep ON sep.id = c."separationId"
      LEFT JOIN employee_assets ea ON ea.id = i."employeeAssetId"
      LEFT JOIN software_license_allocations la ON la.id = i."licenseAllocationId"
      WHERE s."clearanceId" <> i."clearanceId"
         OR s."clearanceType" <> 'ASSET'
         OR sep."employeeId" <> i."employeeId"
         OR coalesce(ea."employeeId", la."employeeId") <> i."employeeId"
    `),
  },
  {
    name: 'invalid_waiver_approval',
    sql: idSelect(`
      SELECT id
      FROM asset_clearance_waivers
      WHERE status = 'APPROVED'
        AND (
          "decidedByUserId" IS NULL OR
          "requestedByUserId" = "decidedByUserId"
        )
    `),
  },
];
