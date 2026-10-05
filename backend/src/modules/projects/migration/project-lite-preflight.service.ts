import {
  PROJECT_LITE_PREFLIGHT_CHECKS,
  PROJECT_LITE_PREFLIGHT_ID_LIMIT,
  type ProjectLiteFindingCode,
} from './project-lite-preflight.queries';

export interface ProjectLiteFinding {
  code: ProjectLiteFindingCode;
  blocking: boolean;
  /** Exact exception count (not truncated). */
  count: number;
  /** Sample of ids (capped). */
  sampleIds: string[];
  /** @deprecated use sampleIds — kept for older CLI consumers */
  ids: string[];
}

export interface ProjectLitePreflightReport {
  generatedAt: string;
  databaseName: string;
  databaseSchema: string;
  exceptionCount: number;
  blockingExceptionCount: number;
  businessPartyAvailable: boolean;
  findings: ProjectLiteFinding[];
}

export interface ProjectLiteQueryClient {
  $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
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

function asCount(rows: unknown): number {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }
  const row = rows[0] as { count?: unknown };
  const raw = row?.count;
  if (typeof raw === 'bigint') {
    return Number(raw);
  }
  if (typeof raw === 'number') {
    return raw;
  }
  if (typeof raw === 'string') {
    return Number(raw) || 0;
  }
  return 0;
}

async function tableExists(
  prisma: ProjectLiteQueryClient,
  tableName: string,
): Promise<boolean> {
  const rows = asIds(
    await prisma.$queryRawUnsafe(
      `
        SELECT c.oid::text AS id
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
          AND c.relname = $1
          AND n.nspname = current_schema()
        LIMIT 1
      `,
      tableName,
    ),
  );
  return rows.length > 0;
}

function toCountSql(idSql: string): string {
  const trimmed = idSql.trim().replace(/;+\s*$/, '');
  // Strip trailing LIMIT for exact count wrapper.
  const withoutLimit = trimmed.replace(
    new RegExp(`\\s+LIMIT\\s+${PROJECT_LITE_PREFLIGHT_ID_LIMIT}\\s*$`, 'i'),
    '',
  );
  return `SELECT COUNT(*)::bigint AS count FROM (${withoutLimit}) exceptions`;
}

export async function runProjectLitePreflight(
  prisma: ProjectLiteQueryClient,
  meta: { databaseName: string; databaseSchema: string },
): Promise<ProjectLitePreflightReport> {
  const findings: ProjectLiteFinding[] = [];
  const businessPartyAvailable = await tableExists(prisma, 'business_parties');

  for (const check of PROJECT_LITE_PREFLIGHT_CHECKS) {
    const sampleIds = asIds(await prisma.$queryRawUnsafe(check.sql));
    if (sampleIds.length === 0) {
      continue;
    }
    const count = asCount(await prisma.$queryRawUnsafe(toCountSql(check.sql)));
    findings.push({
      code: check.code,
      blocking: check.blocking,
      count: Math.max(count, sampleIds.length),
      sampleIds,
      ids: sampleIds,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    databaseName: meta.databaseName,
    databaseSchema: meta.databaseSchema,
    exceptionCount: findings.reduce((sum, finding) => sum + finding.count, 0),
    blockingExceptionCount: findings
      .filter((finding) => finding.blocking)
      .reduce((sum, finding) => sum + finding.count, 0),
    businessPartyAvailable,
    findings,
  };
}

export function projectLitePreflightToCsv(
  report: ProjectLitePreflightReport,
): string {
  const lines = ['code,blocking,id'];
  for (const finding of report.findings) {
    for (const id of finding.sampleIds) {
      lines.push(`${finding.code},${finding.blocking},${id}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
