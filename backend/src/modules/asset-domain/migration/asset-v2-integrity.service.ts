import { ASSET_V2_INTEGRITY_QUERIES } from './asset-v2-integrity.queries';
import type { AssetV2IntegrityCheckName } from './asset-v2-integrity.queries';
import type { AssetV2QueryClient } from './asset-v2-preflight.service';

export interface AssetV2IntegrityFinding {
  name: AssetV2IntegrityCheckName;
  count: number;
  ids: string[];
}

export interface AssetV2IntegrityReport {
  generatedAt: string;
  databaseName: string;
  databaseSchema: string;
  exceptionCount: number;
  findings: AssetV2IntegrityFinding[];
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

export async function runAssetV2Integrity(
  prisma: AssetV2QueryClient,
  meta: { databaseName: string; databaseSchema: string },
): Promise<AssetV2IntegrityReport> {
  const findings: AssetV2IntegrityFinding[] = [];

  for (const check of ASSET_V2_INTEGRITY_QUERIES) {
    const ids = asIds(await prisma.$queryRawUnsafe(check.sql));
    if (ids.length > 0) {
      findings.push({
        name: check.name,
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
