import { DELIVERY_V2_PREFLIGHT_CHECKS } from './delivery-v2-preflight.queries';
import type { DeliveryV2FindingCode } from './delivery-v2-preflight.queries';

export interface DeliveryV2Finding {
  code: DeliveryV2FindingCode;
  count: number;
  ids: string[];
}

export interface DeliveryV2PreflightReport {
  generatedAt: string;
  databaseName: string;
  databaseSchema: string;
  exceptionCount: number;
  blockingExceptionCount: number;
  findings: DeliveryV2Finding[];
}

export interface DeliveryV2QueryClient {
  $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
}

/** Findings that must be zero before a contract/cutover migration. */
export const DELIVERY_V2_BLOCKING_FINDINGS: ReadonlySet<DeliveryV2FindingCode> =
  new Set([
    'DUPLICATE_CLIENT_REFERENCE',
    'DUPLICATE_DEDUPE_KEY',
    'DUPLICATE_ATTEMPT_NUMBERS',
    'DUPLICATE_PROVIDER_EVENT_ID',
    'DUPLICATE_PROVIDER_PAYLOAD_DIGEST',
    'FAILED_WITHOUT_DETERMINISTIC_CLASSIFICATION',
    'MESSAGE_MISSING_COMPANY_OR_BRANCH',
  ]);

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

export async function runDeliveryV2Preflight(
  prisma: DeliveryV2QueryClient,
  meta: { databaseName: string; databaseSchema: string },
): Promise<DeliveryV2PreflightReport> {
  const findings: DeliveryV2Finding[] = [];

  for (const check of DELIVERY_V2_PREFLIGHT_CHECKS) {
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
    blockingExceptionCount: findings
      .filter((finding) => DELIVERY_V2_BLOCKING_FINDINGS.has(finding.code))
      .reduce((sum, finding) => sum + finding.count, 0),
    findings,
  };
}

export function deliveryPreflightToCsv(
  report: DeliveryV2PreflightReport,
): string {
  const lines = ['code,id'];
  for (const finding of report.findings) {
    for (const id of finding.ids) {
      lines.push(`${finding.code},${id}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
