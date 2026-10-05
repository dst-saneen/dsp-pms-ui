import {
  PROJECT_LITE_INTEGRITY_CHECKS,
  type ProjectLiteIntegrityCode,
} from './project-lite-integrity.queries';
import type { ProjectLiteQueryClient } from './project-lite-preflight.service';

export interface ProjectLiteIntegrityFinding {
  code: ProjectLiteIntegrityCode;
  count: number;
  ids: string[];
}

export interface ProjectLiteIntegrityReport {
  generatedAt: string;
  databaseName: string;
  databaseSchema: string;
  exceptionCount: number;
  findings: ProjectLiteIntegrityFinding[];
}

function asIds(rows: unknown): string[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object' || !('id' in row)) {
        return null;
      }
      const id = (row as { id: unknown }).id;
      return typeof id === 'string' ? id : null;
    })
    .filter((id): id is string => Boolean(id));
}

export async function runProjectLiteIntegrity(
  prisma: ProjectLiteQueryClient,
  meta: { databaseName: string; databaseSchema: string },
): Promise<ProjectLiteIntegrityReport> {
  const findings: ProjectLiteIntegrityFinding[] = [];

  for (const check of PROJECT_LITE_INTEGRITY_CHECKS) {
    const ids = asIds(await prisma.$queryRawUnsafe(check.sql));
    if (ids.length > 0) {
      findings.push({
        code: check.code,
        count: ids.length,
        ids,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    databaseName: meta.databaseName,
    databaseSchema: meta.databaseSchema,
    exceptionCount: findings.reduce((sum, finding) => sum + finding.count, 0),
    findings,
  };
}
