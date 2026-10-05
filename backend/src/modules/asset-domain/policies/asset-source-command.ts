import { createHash } from 'node:crypto';

export type AssetInternalSourceType = 'ONBOARDING_TASK' | 'IMPORT';

export type AssetSourceCommandKind = 'ASSIGN' | 'ALLOCATE';

export interface AssetSourceCommandInput {
  companyId: string;
  sourceType: AssetInternalSourceType;
  sourceId: string;
  sourceCommandKey: string;
  employeeId: string;
  assetId: string;
  effectiveDate: string;
  commandKind: AssetSourceCommandKind;
}

/**
 * Frozen v1 canonical hash for internal source-command uniqueness.
 * Field order and normalization must not change; add a new version instead.
 */
export function hashAssetSourceCommand(input: AssetSourceCommandInput): string {
  const canonical = {
    format: 'asset-source-command:v1',
    companyId: input.companyId.trim().toLowerCase(),
    sourceType: input.sourceType,
    sourceId: input.sourceId.trim().toLowerCase(),
    sourceCommandKey: input.sourceCommandKey.trim(),
    employeeId: input.employeeId.trim().toLowerCase(),
    assetId: input.assetId.trim().toLowerCase(),
    effectiveDate: input.effectiveDate.trim().slice(0, 10),
    commandKind: input.commandKind,
  };

  return createHash('sha256')
    .update(JSON.stringify(canonical), 'utf8')
    .digest('hex');
}

export interface AssetCommandTransactionContext {
  actorUserId: string;
}

export interface InternalAssetFulfillmentInput {
  assetId: string;
  employeeId: string;
  effectiveDate: string;
  sourceType: AssetInternalSourceType;
  sourceId: string;
  sourceCommandKey: string;
  actorUserId: string;
  expectedAssetVersion?: number;
}
