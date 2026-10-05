import { ASSET_V2_PREFLIGHT_CHECKS } from './asset-v2-preflight.queries';
import type { AssetV2FindingCode } from './asset-v2-preflight.queries';

export interface AssetV2Finding {
  code: AssetV2FindingCode;
  count: number;
  ids: string[];
}

export interface AssetV2PreflightReport {
  generatedAt: string;
  databaseName: string;
  databaseSchema: string;
  exceptionCount: number;
  findings: AssetV2Finding[];
}

export interface AssetV2QueryClient {
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

export async function runAssetV2Preflight(
  prisma: AssetV2QueryClient,
  meta: { databaseName: string; databaseSchema: string },
): Promise<AssetV2PreflightReport> {
  const findings: AssetV2Finding[] = [];

  for (const check of ASSET_V2_PREFLIGHT_CHECKS) {
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

export function preflightToCsv(report: AssetV2PreflightReport): string {
  const lines = ['code,id'];
  for (const finding of report.findings) {
    for (const id of finding.ids) {
      lines.push(`${finding.code},${id}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
