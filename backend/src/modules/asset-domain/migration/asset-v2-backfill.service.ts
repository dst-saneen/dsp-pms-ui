import {
  AssetClearanceItemStatus,
  AssetKind,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { AssetSensitiveIdentifierService } from '../asset-sensitive-identifier.service';
import { normalizeSerialNumber } from '../policies/asset-kind-tracking';

import {
  FATAL_PREFLIGHT_CODES,
  assertMappingDoesNotInventPlaceholders,
} from './asset-v2-backfill.rules';
import { emptyAssetV2Mapping } from './asset-v2-mapping.loader';
import type {
  AssetV2CardImportRecord,
  AssetV2MappingFile,
  LoadedAssetV2CardImport,
  LoadedAssetV2Mapping,
} from './asset-v2-mapping.types';
import { runAssetV2Preflight } from './asset-v2-preflight.service';

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

export interface AssetV2BackfillOptions {
  apply: boolean;
  mapping?: LoadedAssetV2Mapping;
  cardImport?: LoadedAssetV2CardImport;
  identifiers?: AssetSensitiveIdentifierService;
  databaseName: string;
  databaseSchema: string;
}

export interface AssetV2BackfillReport {
  dryRun: boolean;
  databaseName: string;
  databaseSchema: string;
  mappingChecksum: string | null;
  mappingExpectedRowCount: number;
  cardImportChecksum: string | null;
  updatedCount: number;
  rejectedCount: number;
  applied: Record<string, number>;
  exceptions: Array<{ code: string; count: number; ids: string[] }>;
  fatal: string[];
}

const DETERMINISTIC_SQL = {
  normalizeExistingSerials: `
    UPDATE assets
    SET "serialNumberNormalized" = upper(regexp_replace(trim("serialNumber"), '\\s+', '', 'g')),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "serialNumberNormalized" IS NULL
      AND nullif(trim("serialNumber"), '') IS NOT NULL
  `,
  copyClassificationFromType: `
    UPDATE assets a
    SET kind = t.kind,
        "trackingMode" = t."trackingMode",
        "updatedAt" = CURRENT_TIMESTAMP
    FROM asset_types t
    WHERE t.id = a."assetTypeId"
      AND t.kind IS NOT NULL
      AND t."trackingMode" IS NOT NULL
      AND (a.kind IS NULL OR a."trackingMode" IS NULL)
  `,
  lifecycleFromLegacyStatus: `
    UPDATE assets
    SET "lifecycleStatus" = CASE status
          WHEN 'AVAILABLE' THEN 'ACTIVE'::"AssetLifecycleStatus"
          WHEN 'ASSIGNED' THEN 'ACTIVE'::"AssetLifecycleStatus"
          WHEN 'REPAIR' THEN 'IN_REPAIR'::"AssetLifecycleStatus"
          WHEN 'LOST' THEN 'LOST'::"AssetLifecycleStatus"
          WHEN 'DISPOSED' THEN 'DISPOSED'::"AssetLifecycleStatus"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE status IN ('AVAILABLE', 'ASSIGNED', 'REPAIR', 'LOST', 'DISPOSED')
  `,
  custodyStatusFromLegacy: `
    UPDATE employee_assets
    SET "custodyStatus" = CASE status
          WHEN 'ASSIGNED' THEN 'ASSIGNED'::"EmployeeAssetStatus"
          WHEN 'RETURNED' THEN 'RETURNED'::"EmployeeAssetStatus"
          WHEN 'DAMAGED' THEN 'DAMAGED'::"EmployeeAssetStatus"
          WHEN 'LOST' THEN 'LOST'::"EmployeeAssetStatus"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "custodyStatus" IS NULL
      AND status IN ('ASSIGNED', 'RETURNED', 'DAMAGED', 'LOST')
  `,
  closedAtFromReturnedDate: `
    UPDATE employee_assets
    SET "closedAt" = "returnedDate",
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "closedAt" IS NULL
      AND "custodyStatus" IN ('RETURNED', 'DAMAGED', 'LOST')
      AND "returnedDate" IS NOT NULL
  `,
  assignmentSnapshotsFromEmployee: `
    UPDATE employee_assets ea
    SET "companyId" = e."companyId",
        "branchIdAtAssignment" = e."branchId",
        "departmentIdAtAssignment" = e."departmentId",
        "updatedAt" = CURRENT_TIMESTAMP
    FROM employees e
    WHERE e.id = ea."employeeId"
      AND (
        ea."companyId" IS NULL
        OR ea."branchIdAtAssignment" IS NULL
        OR ea."departmentIdAtAssignment" IS NULL
      )
  `,
  categoryArchiveMirror: `
    UPDATE asset_categories
    SET "isActive" = ("archivedAt" IS NULL),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "isActive" <> ("archivedAt" IS NULL)
  `,
  typeArchiveMirror: `
    UPDATE asset_types
    SET "isActive" = ("archivedAt" IS NULL),
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "isActive" <> ("archivedAt" IS NULL)
  `,
  assetArchiveAndStatusMirror: `
    UPDATE assets a
    SET "isActive" = (a."archivedAt" IS NULL),
        status = CASE
          WHEN a."lifecycleStatus" = 'ACTIVE'
            AND a."trackingMode" = 'INDIVIDUAL'
            AND EXISTS (
              SELECT 1 FROM employee_assets ea
              WHERE ea."assetId" = a.id
                AND COALESCE(ea."custodyStatus"::text, ea.status) = 'ASSIGNED'
                AND COALESCE(ea."closedAt", ea."returnedDate") IS NULL
            ) THEN 'ASSIGNED'
          WHEN a."lifecycleStatus" = 'ACTIVE' THEN 'AVAILABLE'
          WHEN a."lifecycleStatus" IN ('IN_REPAIR', 'SUSPENDED') THEN 'REPAIR'
          WHEN a."lifecycleStatus" = 'LOST' THEN 'LOST'
          WHEN a."lifecycleStatus" IN ('DISPOSED', 'RETIRED') THEN 'DISPOSED'
          ELSE a.status
        END,
        "updatedAt" = CURRENT_TIMESTAMP
  `,
  custodyLegacyMirror: `
    UPDATE employee_assets
    SET status = CASE
          WHEN "custodyStatus" = 'WAIVED' THEN 'LOST'
          ELSE "custodyStatus"::text
        END,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "custodyStatus" IS NOT NULL
      AND status <> CASE
        WHEN "custodyStatus" = 'WAIVED' THEN 'LOST'
        ELSE "custodyStatus"::text
      END
  `,
};

export async function runAssetV2Backfill(
  prisma: Db,
  options: AssetV2BackfillOptions,
): Promise<AssetV2BackfillReport> {
  const loaded = options.mapping ?? {
    mapping: emptyAssetV2Mapping(),
    checksum: null as unknown as string,
    expectedRowCount: 0,
    sourcePath: '',
  };
  const mapping = loaded.mapping;
  assertMappingDoesNotInventPlaceholders(mapping);

  const fatal: string[] = [];
  const applied: Record<string, number> = {
    typesClassified: 0,
    assetsDepartmentMapped: 0,
    serialsApplied: 0,
    locationsApplied: 0,
    softwareDetailsCreated: 0,
    archivesApplied: 0,
    cardsImported: 0,
    clearanceSummariesCreated: 0,
    clearanceChildrenCreated: 0,
    deterministicStatements: 0,
  };

  if (!options.apply) {
    const preview = await previewMapping(prisma, mapping, options.cardImport);
    fatal.push(...preview.fatal);
    const preflight = await runAssetV2Preflight(prisma, {
      databaseName: options.databaseName,
      databaseSchema: options.databaseSchema,
    });
    return {
      dryRun: true,
      databaseName: options.databaseName,
      databaseSchema: options.databaseSchema,
      mappingChecksum: options.mapping?.checksum ?? null,
      mappingExpectedRowCount: options.mapping?.expectedRowCount ?? 0,
      cardImportChecksum: options.cardImport?.checksum ?? null,
      updatedCount: preview.plannedUpdates,
      rejectedCount: preview.rejectedCount,
      applied,
      exceptions: preflight.findings.map((finding) => ({
        code: finding.code,
        count: finding.count,
        ids: finding.ids,
      })),
      fatal,
    };
  }

  const identifiers = options.cardImport
    ? (options.identifiers ??
      (() => {
        throw new Error(
          'Card import requires an AssetSensitiveIdentifierService configured with validated environment values',
        );
      })())
    : null;

  await prisma.$transaction(
    async (tx) => {
      const unknownAssets = await tx.asset.findMany({
        where: {
          status: {
            notIn: ['AVAILABLE', 'ASSIGNED', 'REPAIR', 'LOST', 'DISPOSED'],
          },
        },
        select: { id: true, status: true },
        take: 20,
      });
      const unknownCustody = await tx.employeeAsset.findMany({
        where: {
          status: { notIn: ['ASSIGNED', 'RETURNED', 'DAMAGED', 'LOST'] },
        },
        select: { id: true, status: true },
        take: 20,
      });
      if (unknownAssets.length > 0 || unknownCustody.length > 0) {
        throw new Error(
          'Unknown legacy status values stop Asset V2 backfill; correct them before applying',
        );
      }

      applied.typesClassified = await applyTypeClassifications(tx, mapping);
      applied.assetsDepartmentMapped = await applyDepartmentMapping(
        tx,
        mapping,
      );
      applied.serialsApplied = await applySerialMapping(tx, mapping);
      applied.locationsApplied = await applyLocationMapping(tx, mapping);
      applied.softwareDetailsCreated = await applySoftwareMapping(tx, mapping);
      applied.archivesApplied = await applyArchiveMapping(tx, mapping);
      if (identifiers && options.cardImport) {
        applied.cardsImported = await applyCardImport(
          tx,
          identifiers,
          options.cardImport.cards,
        );
      }

      for (const sql of Object.values(DETERMINISTIC_SQL)) {
        await tx.$executeRawUnsafe(sql);
        applied.deterministicStatements += 1;
      }

      const mismatch = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT a.id
         FROM assets a
         JOIN asset_types t ON t.id = a."assetTypeId"
         WHERE a.kind IS NOT NULL
           AND t.kind IS NOT NULL
           AND (a.kind <> t.kind OR a."trackingMode" <> t."trackingMode")
         LIMIT 20`,
      );
      if (mismatch.length > 0) {
        throw new Error(
          'Asset kind/tracking differs from Type after backfill; resolve mapping before contract',
        );
      }

      const snapshotFailures = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT ea.id
         FROM employee_assets ea
         LEFT JOIN departments d
           ON d.id = ea."departmentIdAtAssignment"
          AND d."companyId" = ea."companyId"
          AND d."branchId" = ea."branchIdAtAssignment"
         WHERE ea."companyId" IS NULL
            OR ea."branchIdAtAssignment" IS NULL
            OR ea."departmentIdAtAssignment" IS NULL
            OR d.id IS NULL
         LIMIT 20`,
      );
      if (snapshotFailures.length > 0) {
        throw new Error(
          'Assignment snapshots are missing or do not resolve through Company/Branch/Department',
        );
      }

      const terminalWithoutClose = await tx.employeeAsset.findMany({
        where: {
          custodyStatus: { in: ['RETURNED', 'DAMAGED', 'LOST'] },
          closedAt: null,
        },
        select: { id: true },
        take: 20,
      });
      if (terminalWithoutClose.length > 0) {
        throw new Error(
          'Terminal custody rows are missing closedAt; do not invent a closure date',
        );
      }

      const clearance = await reconcileClearance(tx);
      applied.clearanceSummariesCreated = clearance.summariesCreated;
      applied.clearanceChildrenCreated = clearance.childrenCreated;
    },
    { timeout: 180_000 },
  );

  const preflight = await runAssetV2Preflight(prisma, {
    databaseName: options.databaseName,
    databaseSchema: options.databaseSchema,
  });
  for (const finding of preflight.findings) {
    if ((FATAL_PREFLIGHT_CODES as readonly string[]).includes(finding.code)) {
      fatal.push(finding.code);
    }
  }

  const updatedCount = Object.values(applied).reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    dryRun: false,
    databaseName: options.databaseName,
    databaseSchema: options.databaseSchema,
    mappingChecksum: options.mapping?.checksum ?? null,
    mappingExpectedRowCount: options.mapping?.expectedRowCount ?? 0,
    cardImportChecksum: options.cardImport?.checksum ?? null,
    updatedCount,
    rejectedCount: fatal.length,
    applied,
    exceptions: preflight.findings.map((finding) => ({
      code: finding.code,
      count: finding.count,
      ids: finding.ids,
    })),
    fatal,
  };
}

async function previewMapping(
  prisma: Db,
  mapping: AssetV2MappingFile,
  cardImport?: LoadedAssetV2CardImport,
) {
  const fatal: string[] = [];
  let plannedUpdates = 0;
  let rejectedCount = 0;

  plannedUpdates += Object.keys(mapping.classificationByAssetTypeId).length;
  plannedUpdates += Object.keys(mapping.departmentByAssetId).length;
  plannedUpdates += Object.keys(mapping.serialByAssetId).length;
  plannedUpdates += Object.keys(mapping.locationByAssetId).length;
  plannedUpdates += Object.keys(mapping.softwareByAssetId).length;
  plannedUpdates += mapping.archives.length;
  plannedUpdates += cardImport?.cards.length ?? 0;

  const types = await prisma.assetType.findMany({
    where: { id: { in: Object.keys(mapping.classificationByAssetTypeId) } },
    select: { id: true, kind: true, trackingMode: true },
  });
  const typeById = new Map(types.map((row) => [row.id, row]));
  for (const assetTypeId of Object.keys(mapping.classificationByAssetTypeId)) {
    if (!typeById.has(assetTypeId)) {
      fatal.push(`TYPE_NOT_FOUND:${assetTypeId}`);
      rejectedCount += 1;
    }
  }

  const assets = await prisma.asset.findMany({
    where: { id: { in: Object.keys(mapping.departmentByAssetId) } },
    select: { id: true, companyId: true },
  });
  const assetById = new Map(assets.map((row) => [row.id, row]));
  const departments = await prisma.department.findMany({
    where: { id: { in: Object.values(mapping.departmentByAssetId) } },
    select: { id: true, companyId: true, branchId: true },
  });
  const departmentById = new Map(departments.map((row) => [row.id, row]));
  for (const [assetId, departmentId] of Object.entries(
    mapping.departmentByAssetId,
  )) {
    const asset = assetById.get(assetId);
    const department = departmentById.get(departmentId);
    if (!asset || !department || department.companyId !== asset.companyId) {
      fatal.push(`DEPARTMENT_MAPPING_INVALID:${assetId}`);
      rejectedCount += 1;
    }
  }

  return { plannedUpdates, rejectedCount, fatal };
}

async function applyTypeClassifications(tx: Tx, mapping: AssetV2MappingFile) {
  let updated = 0;
  for (const [assetTypeId, spec] of Object.entries(
    mapping.classificationByAssetTypeId,
  )) {
    const current = await tx.assetType.findFirst({
      where: { id: assetTypeId },
      select: { id: true, kind: true, trackingMode: true },
    });
    if (!current) {
      throw new Error(`Mapped asset type ${assetTypeId} was not found`);
    }
    if (
      current.kind &&
      current.trackingMode &&
      (current.kind !== spec.kind || current.trackingMode !== spec.trackingMode)
    ) {
      throw new Error(
        `assetType ${assetTypeId} already has a different kind/tracking; mapping cannot overwrite it`,
      );
    }
    if (
      current.kind === spec.kind &&
      current.trackingMode === spec.trackingMode
    ) {
      continue;
    }
    await tx.assetType.update({
      where: { id: assetTypeId },
      data: { kind: spec.kind, trackingMode: spec.trackingMode },
    });
    updated += 1;
  }
  return updated;
}

async function applyDepartmentMapping(tx: Tx, mapping: AssetV2MappingFile) {
  let updated = 0;
  for (const [assetId, departmentId] of Object.entries(
    mapping.departmentByAssetId,
  )) {
    const asset = await tx.asset.findFirst({
      where: { id: assetId },
      select: {
        id: true,
        companyId: true,
        trackingMode: true,
        employeeAssets: {
          where: { status: 'ASSIGNED', returnedDate: null },
          select: {
            id: true,
            employee: { select: { branchId: true } },
          },
        },
      },
    });
    const department = await tx.department.findFirst({
      where: { id: departmentId },
      select: { id: true, companyId: true, branchId: true },
    });
    if (!asset || !department) {
      throw new Error(`Mapped asset/department not found for ${assetId}`);
    }
    if (department.companyId !== asset.companyId) {
      throw new Error(
        `Department ${departmentId} does not belong to asset ${assetId} company`,
      );
    }
    const open = asset.employeeAssets[0];
    if (open && open.employee.branchId !== department.branchId) {
      throw new Error(
        `Open physical custody on ${assetId} does not match the mapped department branch`,
      );
    }
    if (open && asset.trackingMode && asset.trackingMode !== 'INDIVIDUAL') {
      throw new Error(
        `Open physical custody on ${assetId} requires INDIVIDUAL tracking`,
      );
    }
    await tx.asset.update({
      where: { id: assetId },
      data: { departmentId, branchId: department.branchId },
    });
    updated += 1;
  }
  return updated;
}

async function applySerialMapping(tx: Tx, mapping: AssetV2MappingFile) {
  let updated = 0;
  for (const [assetId, serial] of Object.entries(mapping.serialByAssetId)) {
    const normalized = normalizeSerialNumber(serial);
    if (!normalized) {
      throw new Error(`Mapped serial for ${assetId} is blank`);
    }
    await tx.asset.update({
      where: { id: assetId },
      data: { serialNumber: serial.trim(), serialNumberNormalized: normalized },
    });
    updated += 1;
  }
  return updated;
}

async function applyLocationMapping(tx: Tx, mapping: AssetV2MappingFile) {
  let updated = 0;
  for (const [assetId, location] of Object.entries(mapping.locationByAssetId)) {
    await tx.asset.update({
      where: { id: assetId },
      data: { location: location.trim() },
    });
    updated += 1;
  }
  return updated;
}

async function applySoftwareMapping(tx: Tx, mapping: AssetV2MappingFile) {
  let updated = 0;
  for (const [assetId, spec] of Object.entries(mapping.softwareByAssetId)) {
    const asset = await tx.asset.findFirst({
      where: { id: assetId },
      select: { id: true, companyId: true, softwareLicenseDetail: true },
    });
    if (!asset) {
      throw new Error(`Mapped software asset ${assetId} was not found`);
    }
    const activeCount = await tx.softwareLicenseAllocation.count({
      where: { assetId, status: 'ACTIVE' },
    });
    if (activeCount > spec.seatCapacity) {
      throw new Error(
        `softwareByAssetId.${assetId} seatCapacity is below current active allocations`,
      );
    }
    const dates = {
      startsOn: spec.startsOn ? new Date(spec.startsOn) : null,
      expiresOn: spec.expiresOn ? new Date(spec.expiresOn) : null,
      renewsOn: spec.renewsOn ? new Date(spec.renewsOn) : null,
    };
    if (!asset.softwareLicenseDetail) {
      await tx.assetSoftwareLicenseDetail.create({
        data: {
          assetId,
          companyId: asset.companyId,
          vendorName: spec.vendorName,
          productName: spec.productName,
          seatCapacity: spec.seatCapacity,
          allocatedSeatCount: activeCount,
          contractReference: spec.contractReference ?? null,
          vaultReference: spec.vaultReference ?? null,
          ...dates,
        },
      });
      updated += 1;
      continue;
    }
    if (
      asset.softwareLicenseDetail.vendorName !== spec.vendorName ||
      asset.softwareLicenseDetail.productName !== spec.productName
    ) {
      throw new Error(
        `software detail already exists for ${assetId} with different vendor/product`,
      );
    }
  }
  return updated;
}

async function applyArchiveMapping(tx: Tx, mapping: AssetV2MappingFile) {
  let updated = 0;
  for (const item of mapping.archives) {
    const archivedAt = new Date(item.archivedAt);
    if (item.entityType === 'CATEGORY') {
      const row = await tx.assetCategory.findFirst({
        where: { id: item.entityId },
        select: { id: true, isActive: true, archivedAt: true },
      });
      if (!row || row.isActive) {
        throw new Error(
          `Archive mapping ${item.entityId} is not an inactive category`,
        );
      }
      if (row.archivedAt) {
        continue;
      }
      await tx.assetCategory.update({
        where: { id: item.entityId },
        data: { archivedAt, isActive: false },
      });
      updated += 1;
      continue;
    }
    if (item.entityType === 'TYPE') {
      const row = await tx.assetType.findFirst({
        where: { id: item.entityId },
        select: { id: true, isActive: true, archivedAt: true },
      });
      if (!row || row.isActive) {
        throw new Error(
          `Archive mapping ${item.entityId} is not an inactive type`,
        );
      }
      if (row.archivedAt) {
        continue;
      }
      await tx.assetType.update({
        where: { id: item.entityId },
        data: { archivedAt, isActive: false },
      });
      updated += 1;
      continue;
    }
    const row = await tx.asset.findFirst({
      where: { id: item.entityId },
      select: { id: true, isActive: true, archivedAt: true },
    });
    if (!row || row.isActive) {
      throw new Error(
        `Archive mapping ${item.entityId} is not an inactive asset`,
      );
    }
    if (row.archivedAt) {
      continue;
    }
    await tx.asset.update({
      where: { id: item.entityId },
      data: { archivedAt, isActive: false },
    });
    updated += 1;
  }
  return updated;
}

async function applyCardImport(
  tx: Tx,
  identifiers: AssetSensitiveIdentifierService,
  cards: AssetV2CardImportRecord[],
) {
  let updated = 0;
  for (const card of cards) {
    const asset = await tx.asset.findFirst({
      where: { id: card.assetId },
      select: { id: true, companyId: true, cardDetail: true, kind: true },
    });
    if (!asset) {
      throw new Error('Mapped card asset was not found');
    }
    if (asset.kind && asset.kind !== AssetKind.CARD) {
      throw new Error(`Card import target ${card.assetId} is not a CARD asset`);
    }
    if (asset.cardDetail) {
      continue;
    }
    const envelope = identifiers.encryptCardNumber(card.cardNumber);
    const duplicate = await tx.assetCardLookupIndex.findFirst({
      where: {
        companyId: asset.companyId,
        lookupKeyVersion: envelope.lookupKeyVersion,
        digest: envelope.digest,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error(`Card identifier already exists for another asset`);
    }
    await tx.assetCardDetail.create({
      data: {
        assetId: asset.id,
        companyId: asset.companyId,
        cardNumberCiphertext: Uint8Array.from(envelope.cardNumberCiphertext),
        encryptionNonce: Uint8Array.from(envelope.encryptionNonce),
        encryptionAuthTag: Uint8Array.from(envelope.encryptionAuthTag),
        wrappedDataKey: Uint8Array.from(envelope.wrappedDataKey),
        maskedCardNumber: envelope.maskedCardNumber,
        keyEncryptionKeyVersion: envelope.keyEncryptionKeyVersion,
        encryptionFormatVersion: envelope.encryptionFormatVersion,
        issuer: card.issuer?.trim() || null,
        accessZone: card.accessZone?.trim() || null,
        issuedDate: new Date(card.issuedDate),
        expiryDate: card.expiryDate ? new Date(card.expiryDate) : null,
      },
    });
    await tx.assetCardLookupIndex.create({
      data: {
        companyId: asset.companyId,
        assetId: asset.id,
        lookupKeyVersion: envelope.lookupKeyVersion,
        digest: envelope.digest,
      },
    });
    updated += 1;
  }
  return updated;
}

async function reconcileClearance(tx: Tx) {
  const clearances = await tx.employeeClearance.findMany({
    where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
    include: {
      separation: { select: { employeeId: true } },
      items: { where: { clearanceType: 'ASSET' } },
    },
  });

  let summariesCreated = 0;
  let childrenCreated = 0;

  for (const clearance of clearances) {
    if (clearance.items.length > 1) {
      throw new Error(
        `Clearance ${clearance.id} has duplicate ASSET summary rows; correct before backfill`,
      );
    }
    let summary = clearance.items[0];
    if (!summary) {
      summary = await tx.employeeClearanceItem.create({
        data: {
          companyId: clearance.companyId,
          branchId: clearance.branchId,
          clearanceId: clearance.id,
          clearanceType: 'ASSET',
          itemName: 'Assets',
          status: 'PENDING',
        },
      });
      summariesCreated += 1;
    }

    const employeeId = clearance.separation.employeeId;
    const assignments = await tx.employeeAsset.findMany({
      where: { employeeId, status: 'ASSIGNED', returnedDate: null },
      select: { id: true, asset: { select: { companyId: true } } },
    });
    const allocations = await tx.softwareLicenseAllocation.findMany({
      where: { employeeId, status: 'ACTIVE' },
      select: { id: true, companyId: true },
    });

    const liveCount = assignments.length + allocations.length;
    const nextSummaryStatus = liveCount > 0 ? 'PENDING' : 'CLEARED';
    if (summary.status !== nextSummaryStatus) {
      await tx.employeeClearanceItem.update({
        where: { id: summary.id },
        data: { status: nextSummaryStatus },
      });
    }

    for (const assignment of assignments) {
      const existing = await tx.assetClearanceItem.findFirst({
        where: { clearanceId: clearance.id, employeeAssetId: assignment.id },
        select: { id: true },
      });
      if (existing) {
        continue;
      }
      await tx.assetClearanceItem.create({
        data: {
          companyId: assignment.asset.companyId,
          clearanceId: clearance.id,
          clearanceSummaryItemId: summary.id,
          employeeId,
          employeeAssetId: assignment.id,
          status: AssetClearanceItemStatus.OPEN,
        },
      });
      childrenCreated += 1;
    }

    for (const allocation of allocations) {
      const existing = await tx.assetClearanceItem.findFirst({
        where: {
          clearanceId: clearance.id,
          licenseAllocationId: allocation.id,
        },
        select: { id: true },
      });
      if (existing) {
        continue;
      }
      await tx.assetClearanceItem.create({
        data: {
          companyId: allocation.companyId,
          clearanceId: clearance.id,
          clearanceSummaryItemId: summary.id,
          employeeId,
          licenseAllocationId: allocation.id,
          status: AssetClearanceItemStatus.OPEN,
        },
      });
      childrenCreated += 1;
    }
  }

  return { summariesCreated, childrenCreated };
}
