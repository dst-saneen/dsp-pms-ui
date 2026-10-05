/**
 * Phase B Step 8 — generate business-review artifacts from preflight exceptions.
 *
 * Usage:
 *   pnpm run migration:assets:mapping-template
 *   pnpm run migration:assets:mapping-template -- --preflight=docs/evidence/asset-v2-preflight-report.json
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AssetV2PreflightReport } from '../src/modules/asset-domain/migration/asset-v2-preflight.service';
import type { AssetV2MappingFile } from '../src/modules/asset-domain/migration/asset-v2-mapping.types';
import { createPrismaClient } from './create-prisma-client';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function loadPreflight(path: string): AssetV2PreflightReport {
  return JSON.parse(readFileSync(path, 'utf8')) as AssetV2PreflightReport;
}

function idsFor(report: AssetV2PreflightReport, code: string): string[] {
  return report.findings.find((finding) => finding.code === code)?.ids ?? [];
}

async function main() {
  const preflightPath =
    arg('preflight') ??
    resolve(process.cwd(), 'docs/evidence/asset-v2-preflight-report.json');
  const report = loadPreflight(preflightPath);
  const outDir = resolve(process.cwd(), 'docs/evidence');
  mkdirSync(outDir, { recursive: true });
  mkdirSync(resolve(process.cwd(), 'prisma/asset-v2-mapping'), {
    recursive: true,
  });

  const { prisma, disconnect } = await createPrismaClient();
  try {
    const typeIds = idsFor(report, 'TYPE_REQUIRES_KIND_TRACKING');
    const assetIds = idsFor(report, 'ASSET_REQUIRES_DEPARTMENT');
    const custodyIds = idsFor(report, 'CUSTODY_SNAPSHOT_MISSING');

    const types = typeIds.length
      ? await prisma.assetType.findMany({
          where: { id: { in: typeIds } },
          select: {
            id: true,
            assetTypeName: true,
            companyId: true,
            company: { select: { companyName: true } },
            _count: { select: { assets: true } },
          },
          orderBy: { assetTypeName: 'asc' },
        })
      : [];

    const assets = assetIds.length
      ? await prisma.asset.findMany({
          where: { id: { in: assetIds } },
          select: {
            id: true,
            assetCode: true,
            assetName: true,
            companyId: true,
            branchId: true,
            status: true,
            company: { select: { companyName: true } },
            branch: { select: { branchName: true } },
            assetType: { select: { id: true, assetTypeName: true } },
            employeeAssets: {
              where: { status: 'ASSIGNED', returnedDate: null },
              select: {
                id: true,
                employee: {
                  select: {
                    departmentId: true,
                    branchId: true,
                    department: { select: { departmentName: true } },
                  },
                },
              },
              take: 1,
            },
          },
          orderBy: { assetName: 'asc' },
        })
      : [];

    const custodyRows = custodyIds.length
      ? await prisma.employeeAsset.findMany({
          where: { id: { in: custodyIds } },
          select: {
            id: true,
            status: true,
            assignedDate: true,
            returnedDate: true,
            companyId: true,
            branchIdAtAssignment: true,
            departmentIdAtAssignment: true,
            employee: {
              select: {
                id: true,
                employeeCode: true,
                branchId: true,
                departmentId: true,
                branch: { select: { branchName: true } },
                department: { select: { departmentName: true } },
              },
            },
            asset: {
              select: {
                id: true,
                assetCode: true,
                assetName: true,
                departmentId: true,
                branchId: true,
              },
            },
          },
        })
      : [];

    const departments = await prisma.department.findMany({
      where: {
        companyId: {
          in: [
            ...new Set([
              ...types.map((t) => t.companyId),
              ...assets.map((a) => a.companyId),
            ]),
          ],
        },
        isActive: true,
      },
      select: {
        id: true,
        departmentName: true,
        companyId: true,
        branchId: true,
        branch: { select: { branchName: true } },
        company: { select: { companyName: true } },
      },
      orderBy: [{ companyId: 'asc' }, { departmentName: 'asc' }],
    });

    const mapping: AssetV2MappingFile = {
      version: 1,
      departmentByAssetId: {},
      classificationByAssetTypeId: {},
      serialByAssetId: {},
      locationByAssetId: {},
      softwareByAssetId: {},
      archives: [],
    };

    const starterPath = resolve(
      process.cwd(),
      'prisma/asset-v2-mapping/mapping.starter.json',
    );
    writeFileSync(starterPath, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');

    const pendingPath = resolve(outDir, 'asset-v2-mapping-pending.json');
    writeFileSync(
      pendingPath,
      `${JSON.stringify(
        {
          note: 'Fill approved values here, then copy into prisma/asset-v2-mapping/mapping.json',
          departmentByAssetId: Object.fromEntries(
            assets.map((asset) => {
              const suggested =
                asset.employeeAssets[0]?.employee.departmentId ?? '';
              return [asset.id, suggested];
            }),
          ),
          classificationByAssetTypeId: Object.fromEntries(
            types.map((type) => [
              type.id,
              {
                kind: 'FILL_ME',
                trackingMode: 'FILL_ME',
                assetTypeName: type.assetTypeName,
              },
            ]),
          ),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    const csvLines = [
      'section,entityId,label,company,branch,hint,approvedValue,approvedBy,evidenceReference',
    ];

    for (const type of types) {
      csvLines.push(
        [
          'TYPE_REQUIRES_KIND_TRACKING',
          type.id,
          type.assetTypeName,
          type.company.companyName,
          '',
          `${type._count.assets} assets use this type`,
          'kind+trackingMode e.g. HARDWARE+INDIVIDUAL',
          '',
          '',
        ].join(','),
      );
    }

    for (const asset of assets) {
      const open = asset.employeeAssets[0];
      const hint = open?.employee.departmentId
        ? `open custody → employee dept ${open.employee.department?.departmentName ?? open.employee.departmentId}`
        : (asset.branch?.branchName ?? '');
      csvLines.push(
        [
          'ASSET_REQUIRES_DEPARTMENT',
          asset.id,
          `${asset.assetCode} ${asset.assetName}`,
          asset.company.companyName,
          asset.branch?.branchName ?? '',
          hint,
          'owningDepartmentId UUID',
          '',
          '',
        ].join(','),
      );
    }

    for (const row of custodyRows) {
      csvLines.push(
        [
          'CUSTODY_SNAPSHOT_MISSING',
          row.id,
          `assignment on ${row.asset.assetCode}`,
          row.companyId ?? '',
          row.employee.branch?.branchName ?? '',
          `employee dept ${row.employee.department?.departmentName ?? 'unknown'}; asset dept ${row.asset.departmentId ?? 'none'}`,
          'verify assignment-time branch/dept',
          '',
          '',
        ].join(','),
      );
    }

    for (const department of departments) {
      csvLines.push(
        [
          'DEPARTMENT_REFERENCE',
          department.id,
          department.departmentName,
          department.company.companyName,
          department.branch.branchName,
          'use as owningDepartmentId target',
          '',
          '',
          '',
        ].join(','),
      );
    }

    const reviewCsvPath = resolve(outDir, 'asset-v2-mapping-review.csv');
    writeFileSync(reviewCsvPath, `${csvLines.join('\n')}\n`, 'utf8');

    const summary = {
      preflightPath,
      exceptionCount: report.exceptionCount,
      mappingTemplatePath: starterPath,
      pendingDraftPath: pendingPath,
      reviewCsvPath,
      counts: {
        typesNeedingClassification: types.length,
        assetsNeedingDepartment: assets.length,
        custodySnapshotsMissing: custodyRows.length,
        departmentReferences: departments.length,
      },
      nextSteps: [
        '1. Send asset-v2-mapping-review.csv to manager/asset owner for approval.',
        '2. Fill prisma/asset-v2-mapping/mapping.json from mapping-pending.json after manager approval.',
        '3. Run: pnpm run migration:assets:backfill -- --mapping=prisma/asset-v2-mapping/mapping.json',
        '4. After dry-run ok: pnpm run migration:assets:backfill -- --mapping=... --apply',
        '5. Re-run: pnpm run migration:assets:preflight until exceptionCount is 0.',
      ],
    };

    const summaryPath = resolve(outDir, 'asset-v2-phase-b-step8.json');
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
