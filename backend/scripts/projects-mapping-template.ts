/**
 * Project Lite Phase 2 — operator client-mapping template.
 *
 * Builds a draft mapping file for CLIENT_STRINGS_UNMAPPED projects.
 * Operators must fill businessPartyId explicitly. Never invent parties by name.
 *
 * Usage:
 *   pnpm run migration:projects:mapping-template
 *   pnpm run migration:projects:mapping-template -- --preflight=project-lite-preflight-report.json
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ProjectLitePreflightReport } from '../src/modules/projects/migration';
import {
  emptyProjectLiteClientMapping,
  type ProjectLiteClientMappingFile,
} from '../src/modules/projects/migration';
import { createPrismaClient } from './create-prisma-client';

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function loadPreflight(path: string): ProjectLitePreflightReport {
  return JSON.parse(readFileSync(path, 'utf8')) as ProjectLitePreflightReport;
}

async function main() {
  const preflightPath =
    arg('preflight') ??
    resolve(process.cwd(), 'project-lite-preflight-report.json');
  const outDir = resolve(process.cwd(), 'prisma/project-lite-mapping');
  mkdirSync(outDir, { recursive: true });

  let projectIds: string[] = [];
  try {
    const report = loadPreflight(preflightPath);
    projectIds =
      report.findings.find(
        (finding) => finding.code === 'CLIENT_STRINGS_UNMAPPED',
      )?.ids ?? [];
  } catch {
    // Fall through and discover from DB when no preflight report exists yet.
  }

  const { prisma, disconnect } = await createPrismaClient();
  try {
    if (projectIds.length === 0) {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`
        SELECT p.id
        FROM projects p
        WHERE p."businessPartyId" IS NULL
          AND (
            nullif(trim(p."clientName"), '') IS NOT NULL
            OR nullif(trim(p."clientContact"), '') IS NOT NULL
            OR p."contractValue" IS NOT NULL
          )
        ORDER BY p.id
        LIMIT 500
      `);
      projectIds = rows.map((row) => row.id);
    }

    const projects =
      projectIds.length === 0
        ? []
        : await prisma.project.findMany({
            where: { id: { in: projectIds } },
            select: {
              id: true,
              projectCode: true,
              projectName: true,
              companyId: true,
              clientName: true,
              clientContact: true,
              contractValue: true,
              currency: true,
              company: { select: { companyName: true, companyCode: true } },
            },
            orderBy: { projectCode: 'asc' },
          });

    const mapping: ProjectLiteClientMappingFile =
      emptyProjectLiteClientMapping();
    for (const project of projects) {
      mapping.businessPartyByProjectId[project.id] = '';
    }

    const mappingPath = resolve(outDir, 'mapping.draft.json');
    const reviewPath = resolve(outDir, 'client-mapping-review.csv');
    writeFileSync(mappingPath, `${JSON.stringify(mapping, null, 2)}\n`, 'utf8');
    writeFileSync(
      reviewPath,
      [
        'projectId,projectCode,projectName,companyId,companyCode,companyName,clientName,clientContact,contractValue,currency,businessPartyId',
        ...projects.map((project) =>
          [
            project.id,
            project.projectCode,
            JSON.stringify(project.projectName),
            project.companyId,
            project.company.companyCode,
            JSON.stringify(project.company.companyName),
            JSON.stringify(project.clientName ?? ''),
            JSON.stringify(project.clientContact ?? ''),
            project.contractValue?.toString() ?? '',
            project.currency ?? '',
            '',
          ].join(','),
        ),
      ].join('\n') + '\n',
      'utf8',
    );

    writeFileSync(
      resolve(outDir, 'mapping.example.json'),
      `${JSON.stringify(
        {
          version: 1,
          businessPartyByProjectId: {
            '<project-uuid>':
              '<business-party-uuid-same-company-CUSTOMER-or-BOTH>',
          },
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    console.log(
      JSON.stringify(
        {
          projectCount: projects.length,
          mappingPath,
          reviewPath,
          note: 'Fill businessPartyId explicitly. Do not invent parties by clientName. Apply with migration:projects:backfill --apply --mapping=...',
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
