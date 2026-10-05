import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { isValidAssetKindTracking } from '../policies/asset-kind-tracking';

import type {
  AssetV2MappingFile,
  LoadedAssetV2CardImport,
  LoadedAssetV2Mapping,
} from './asset-v2-mapping.types';

const FORBIDDEN_KEY_PATTERN =
  /^(cardnumber|cardnumbers|licencekey|licensekey|licensekeyvalue|remarks|reason|plaintext)$/i;

function assertPlainObject(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
}

function walkForbiddenKeys(value: unknown, path: string): void {
  if (!value || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walkForbiddenKeys(item, `${path}[${index}]`),
    );
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) {
      throw new Error(
        `Forbidden mapping key "${key}" at ${path}. Card plaintext and private fields must not appear in the mapping file.`,
      );
    }
    walkForbiddenKeys(nested, `${path}.${key}`);
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  assertPlainObject(value, label);
  return value;
}

function requireStringRecord(
  value: unknown,
  label: string,
): Record<string, string> {
  const record = requireRecord(value, label);
  const result: Record<string, string> = {};
  for (const [key, nested] of Object.entries(record)) {
    if (typeof nested !== 'string' || !nested.trim()) {
      throw new Error(`${label}.${key} must be a non-empty string`);
    }
    result[key] = nested.trim();
  }
  return result;
}

function canonicalChecksum(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function parseIsoDate(value: string, label: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} is not a valid timestamp`);
  }
}

export function parseAssetV2MappingFile(
  raw: unknown,
  sourcePath: string,
): LoadedAssetV2Mapping {
  walkForbiddenKeys(raw, '$');
  assertPlainObject(raw, 'mapping');
  if (raw.version !== 1) {
    throw new Error('mapping.version must be 1');
  }

  const departmentByAssetId = requireStringRecord(
    raw.departmentByAssetId,
    'departmentByAssetId',
  );
  const serialByAssetId = requireStringRecord(
    raw.serialByAssetId,
    'serialByAssetId',
  );
  const locationByAssetId = requireStringRecord(
    raw.locationByAssetId,
    'locationByAssetId',
  );

  const classificationRaw = requireRecord(
    raw.classificationByAssetTypeId,
    'classificationByAssetTypeId',
  );
  const classificationByAssetTypeId: AssetV2MappingFile['classificationByAssetTypeId'] =
    {};
  for (const [assetTypeId, spec] of Object.entries(classificationRaw)) {
    assertPlainObject(spec, `classificationByAssetTypeId.${assetTypeId}`);
    const kind = spec.kind;
    const trackingMode = spec.trackingMode;
    if (typeof kind !== 'string' || typeof trackingMode !== 'string') {
      throw new Error(
        `classificationByAssetTypeId.${assetTypeId} requires kind and trackingMode`,
      );
    }
    if (!isValidAssetKindTracking(kind as never, trackingMode as never)) {
      throw new Error(
        `classificationByAssetTypeId.${assetTypeId} has an illegal kind/tracking pair`,
      );
    }
    classificationByAssetTypeId[assetTypeId] = {
      kind: kind as AssetV2MappingFile['classificationByAssetTypeId'][string]['kind'],
      trackingMode:
        trackingMode as AssetV2MappingFile['classificationByAssetTypeId'][string]['trackingMode'],
    };
  }

  const softwareRaw = requireRecord(raw.softwareByAssetId, 'softwareByAssetId');
  const softwareByAssetId: AssetV2MappingFile['softwareByAssetId'] = {};
  for (const [assetId, spec] of Object.entries(softwareRaw)) {
    assertPlainObject(spec, `softwareByAssetId.${assetId}`);
    const vendorName =
      typeof spec.vendorName === 'string' ? spec.vendorName.trim() : '';
    const productName =
      typeof spec.productName === 'string' ? spec.productName.trim() : '';
    const seatCapacity = spec.seatCapacity;
    if (
      !vendorName ||
      !productName ||
      typeof seatCapacity !== 'number' ||
      !Number.isInteger(seatCapacity) ||
      seatCapacity < 1
    ) {
      throw new Error(
        `softwareByAssetId.${assetId} requires vendorName, productName, and positive seatCapacity`,
      );
    }
    softwareByAssetId[assetId] = {
      vendorName,
      productName,
      seatCapacity,
      startsOn: typeof spec.startsOn === 'string' ? spec.startsOn : undefined,
      expiresOn:
        typeof spec.expiresOn === 'string' ? spec.expiresOn : undefined,
      renewsOn: typeof spec.renewsOn === 'string' ? spec.renewsOn : undefined,
      contractReference:
        typeof spec.contractReference === 'string'
          ? spec.contractReference
          : undefined,
      vaultReference:
        typeof spec.vaultReference === 'string'
          ? spec.vaultReference
          : undefined,
    };
  }

  if (!Array.isArray(raw.archives)) {
    throw new Error('archives must be an array');
  }
  const archives: AssetV2MappingFile['archives'] = raw.archives.map(
    (item, index) => {
      assertPlainObject(item, `archives[${index}]`);
      const entityType = item.entityType;
      const entityId = item.entityId;
      const archivedAt = item.archivedAt;
      if (
        entityType !== 'CATEGORY' &&
        entityType !== 'TYPE' &&
        entityType !== 'ASSET'
      ) {
        throw new Error(`archives[${index}].entityType is invalid`);
      }
      if (typeof entityId !== 'string' || !entityId.trim()) {
        throw new Error(`archives[${index}].entityId is required`);
      }
      if (typeof archivedAt !== 'string') {
        throw new Error(`archives[${index}].archivedAt is required`);
      }
      parseIsoDate(archivedAt, `archives[${index}].archivedAt`);
      return { entityType, entityId: entityId.trim(), archivedAt };
    },
  );

  const mapping: AssetV2MappingFile = {
    version: 1,
    departmentByAssetId,
    classificationByAssetTypeId,
    serialByAssetId,
    locationByAssetId,
    softwareByAssetId,
    archives,
  };

  return {
    mapping,
    checksum: canonicalChecksum(mapping),
    expectedRowCount:
      Object.keys(departmentByAssetId).length +
      Object.keys(classificationByAssetTypeId).length +
      Object.keys(serialByAssetId).length +
      Object.keys(locationByAssetId).length +
      Object.keys(softwareByAssetId).length +
      archives.length,
    sourcePath,
  };
}

export function loadAssetV2MappingFile(path: string): LoadedAssetV2Mapping {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  return parseAssetV2MappingFile(raw, path);
}

export function parseAssetV2CardImportFile(
  raw: unknown,
  sourcePath: string,
): LoadedAssetV2CardImport {
  assertPlainObject(raw, 'card import');
  if (raw.version !== 1) {
    throw new Error('card import version must be 1');
  }
  if (!Array.isArray(raw.cards)) {
    throw new Error('card import cards must be an array');
  }
  const cards = (raw.cards as unknown[]).map((item, index) => {
    assertPlainObject(item, `cards[${index}]`);
    const assetId = typeof item.assetId === 'string' ? item.assetId.trim() : '';
    const cardNumber =
      typeof item.cardNumber === 'string' ? item.cardNumber.trim() : '';
    const issuedDate =
      typeof item.issuedDate === 'string' ? item.issuedDate.trim() : '';
    if (!assetId || !cardNumber || !issuedDate) {
      throw new Error(
        `cards[${index}] requires assetId, cardNumber, and issuedDate`,
      );
    }
    return {
      assetId,
      cardNumber,
      issuedDate,
      issuer: typeof item.issuer === 'string' ? item.issuer : undefined,
      accessZone:
        typeof item.accessZone === 'string' ? item.accessZone : undefined,
      expiryDate:
        typeof item.expiryDate === 'string' ? item.expiryDate : undefined,
    };
  });

  return {
    cards,
    checksum: canonicalChecksum({ version: 1, count: cards.length }),
    expectedRowCount: cards.length,
    sourcePath,
  };
}

export function loadAssetV2CardImportFile(
  path: string,
): LoadedAssetV2CardImport {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  return parseAssetV2CardImportFile(raw, path);
}

export function emptyAssetV2Mapping(): AssetV2MappingFile {
  return {
    version: 1,
    departmentByAssetId: {},
    classificationByAssetTypeId: {},
    serialByAssetId: {},
    locationByAssetId: {},
    softwareByAssetId: {},
    archives: [],
  };
}
