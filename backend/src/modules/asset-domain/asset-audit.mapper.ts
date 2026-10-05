import { Injectable } from '@nestjs/common';

/** Redacted audit/outbox snapshots for Asset domain mutations (plan §10). */
@Injectable()
export class AssetAuditMapper {
  toSafeSnapshot<T extends Record<string, unknown>>(entity: T): T {
    const blocked = new Set([
      'remarks',
      'reason',
      'privateReason',
      'privateNote',
      'employeeNote',
      'decisionNote',
      'conditionOnReturn',
      'vaultReference',
      'cardNumber',
      'cardNumberCiphertext',
      'encryptionNonce',
      'encryptionAuthTag',
      'wrappedDataKey',
      'digest',
      'serialNumber',
      'serialNumberNormalized',
      'maskedCardNumber',
    ]);

    return Object.fromEntries(
      Object.entries(entity).filter(([key]) => !blocked.has(key)),
    ) as T;
  }
}
