import { AssetKind, AssetTrackingMode } from '@prisma/client';

/** Ops-approved mapping file (plan §5.4). Never include card plaintext or licence keys. */
export interface AssetV2SoftwareMapping {
  vendorName: string;
  productName: string;
  seatCapacity: number;
  startsOn?: string;
  expiresOn?: string;
  renewsOn?: string;
  contractReference?: string;
  vaultReference?: string;
}

export interface AssetV2ArchiveMapping {
  entityType: 'CATEGORY' | 'TYPE' | 'ASSET';
  entityId: string;
  archivedAt: string;
}

export interface AssetV2MappingFile {
  version: 1;
  departmentByAssetId: Record<string, string>;
  classificationByAssetTypeId: Record<
    string,
    { kind: AssetKind; trackingMode: AssetTrackingMode }
  >;
  serialByAssetId: Record<string, string>;
  locationByAssetId: Record<string, string>;
  softwareByAssetId: Record<string, AssetV2SoftwareMapping>;
  archives: AssetV2ArchiveMapping[];
}

export interface AssetV2CardImportRecord {
  assetId: string;
  cardNumber: string;
  issuedDate: string;
  issuer?: string;
  accessZone?: string;
  expiryDate?: string;
}

export interface AssetV2CardImportFile {
  version: 1;
  cards: AssetV2CardImportRecord[];
}

export interface LoadedAssetV2Mapping {
  mapping: AssetV2MappingFile;
  checksum: string;
  expectedRowCount: number;
  sourcePath: string;
}

export interface LoadedAssetV2CardImport {
  cards: AssetV2CardImportRecord[];
  checksum: string;
  expectedRowCount: number;
  sourcePath: string;
}
