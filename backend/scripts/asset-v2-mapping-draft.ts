/**
 * Build a DEV-ONLY proposed mapping from preflight + review artifacts.
 * Requires manager sign-off before --apply on shared databases.
 *
 * Usage: pnpm run migration:assets:mapping-draft
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AssetV2MappingFile } from '../src/modules/asset-domain/migration/asset-v2-mapping.types';
import { createPrismaClient } from './create-prisma-client';

const LOCATION_TYPES = new Set(['chair', 'desk']);

function classifyType(name: string): {
  kind: 'GENERAL' | 'HARDWARE';
  trackingMode: 'LOCATION' | 'INDIVIDUAL';
} {
  const normalized = name.trim().toLowerCase();
  if (LOCATION_TYPES.has(normalized)) {
    return { kind: 'GENERAL', trackingMode: 'LOCATION' };
  }
  return { kind: 'HARDWARE', trackingMode: 'INDIVIDUAL' };
}

async function main() {
  const pendingPath = resolve(
    process.cwd(),
    'docs/evidence/asset-v2-mapping-pending.json',
  );
  const pending = JSON.parse(readFileSync(pendingPath, 'utf8')) as {
    classificationByAssetTypeId: Record<
      string,
      { kind: string; trackingMode: string; assetTypeName: string }
    >;
    departmentByAssetId: Record<string, string>;
  };

  const { prisma, disconnect } = await createPrismaClient();
  try {
    const branchDepartments = await prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        departmentName: true,
        branchId: true,
        branch: { select: { branchName: true } },
        company: { select: { companyName: true } },
      },
    });

    const pickDepartment = (branchId: string, prefer: string[]) => {
      const inBranch = branchDepartments.filter(
        (row) => row.branchId === branchId,
      );
      for (const label of prefer) {
        const hit = inBranch.find((row) =>
          row.departmentName.toLowerCase().includes(label.toLowerCase()),
        );
        if (hit) {
          return hit.id;
        }
      }
      return inBranch[0]?.id ?? '';
    };

    const assets = await prisma.asset.findMany({
      where: { id: { in: Object.keys(pending.departmentByAssetId) } },
      select: {
        id: true,
        branchId: true,
        employeeAssets: {
          where: { status: 'ASSIGNED', returnedDate: null },
          select: { employee: { select: { departmentId: true } } },
          take: 1,
        },
      },
    });

    const classificationByAssetTypeId: AssetV2MappingFile['classificationByAssetTypeId'] =
      {};
    for (const [typeId, spec] of Object.entries(
      pending.classificationByAssetTypeId,
    )) {
      classificationByAssetTypeId[typeId] = classifyType(spec.assetTypeName);
    }

    const departmentByAssetId: Record<string, string> = {};
    for (const asset of assets) {
      const openDept = asset.employeeAssets[0]?.employee.departmentId;
      if (openDept) {
        departmentByAssetId[asset.id] = openDept;
        continue;
      }
      departmentByAssetId[asset.id] = pickDepartment(asset.branchId ?? '', [
        'Software Development',
        'Data & AI',
        'DevOps',
        'Project / Program Management',
      ]);
    }

    const mapping: AssetV2MappingFile = {
      version: 1,
      departmentByAssetId,
      classificationByAssetTypeId,
      serialByAssetId: {},
      locationByAssetId: {},
      softwareByAssetId: {},
      archives: [],
    };

    const outDir = resolve(process.cwd(), 'prisma/asset-v2-mapping');
    mkdirSync(outDir, { recursive: true });
    const mappingPath = resolve(outDir, 'mapping.dev-proposed.json');
    writeFileSync(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');

    const provenancePath = resolve(
      process.cwd(),
      'docs/evidence/asset-v2-mapping-dev-provenance.json',
    );
    writeFileSync(
      provenancePath,
      `${JSON.stringify(
        {
          warning:
            'DEV PROPOSAL ONLY — obtain manager sign-off before apply on dsp_erp_dev.',
          rules: {
            types:
              'Chair/Desk → GENERAL+LOCATION; all other listed types → HARDWARE+INDIVIDUAL',
            assets:
              'Open custody → employee department; otherwise branch default IT/engineering department',
          },
          mappingPath,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    console.log(
      JSON.stringify(
        {
          mappingPath,
          provenancePath,
          typeMappings: Object.keys(classificationByAssetTypeId).length,
          assetMappings: Object.keys(departmentByAssetId).length,
        },
        null,
        2,
      ),
    );
  } finally {
    await disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
