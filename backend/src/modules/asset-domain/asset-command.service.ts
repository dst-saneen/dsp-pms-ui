import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  AssetActionEntityType,
  AssetActionType,
  AssetKind,
  AssetLifecycleStatus,
  AssetTrackingMode,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { DomainConflictException, DomainNotFoundException } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';
import { NumberSeriesService } from '../number-series';

import { AssetAccessService } from './asset-access.service';
import type { AssetAccessContext } from './asset-access.types';
import { AssetAuditMapper } from './asset-audit.mapper';
import { AssetIdempotencyService } from './asset-idempotency.service';
import { AssetQueryService } from './asset-query.service';
import { AssetSensitiveIdentifierService } from './asset-sensitive-identifier.service';
import { AssetTaxonomyQueryService } from './asset-taxonomy-query.service';
import { CreateAssetCategoryCommandDto } from './dto/create-asset-category-command.dto';
import { CreateAssetCommandDto } from './dto/create-asset-command.dto';
import { CreateAssetTypeCommandDto } from './dto/create-asset-type-command.dto';
import {
  CardExactLookupDto,
  CompleteAssetRepairCommandDto,
  CorrectAssetIdentifierCommandDto,
  ResizeLicensePoolCommandDto,
} from './dto/lifecycle-command.dto';
import { UpdateAssetCategoryCommandDto } from './dto/update-asset-category-command.dto';
import { UpdateAssetMetadataCommandDto } from './dto/update-asset-metadata-command.dto';
import { UpdateAssetTypeCommandDto } from './dto/update-asset-type-command.dto';
import {
  VersionedCommandDto,
  VersionedEffectiveDateCommandDto,
  VersionedReasonCommandDto,
} from './dto/versioned-command.dto';
import { ASSET_ERROR_CODES } from './policies/asset-error-codes';
import {
  ASSET_LIFECYCLE_COMMAND,
  type AssetLifecycleCommand,
  isTerminalLifecycleStatus,
  resolveLifecycleTransition,
} from './policies/asset-lifecycle-transitions';
import {
  isValidAssetKindTracking,
  legacyStatusForLifecycle,
  normalizeSerialNumber,
} from './policies/asset-kind-tracking';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class AssetCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AssetAccessService,
    private readonly organizationScope: EmployeeDomainScopeService,
    private readonly numberSeries: NumberSeriesService,
    private readonly auditService: AuditService,
    private readonly auditMapper: AssetAuditMapper,
    private readonly identifiers: AssetSensitiveIdentifierService,
    private readonly assetQuery: AssetQueryService,
    private readonly taxonomyQuery: AssetTaxonomyQueryService,
    private readonly idempotency: AssetIdempotencyService,
  ) {}

  createCategory(
    dto: CreateAssetCategoryCommandDto,
    context: AssetAccessContext,
  ) {
    this.assertTaxonomyManage(context);

    return this.executeIdempotent(
      context,
      dto.companyId,
      'CREATE_CATEGORY',
      dto,
      async (tx) => {
        await this.organizationScope.assertCompanyInScope(dto.companyId);

        const duplicate = await tx.assetCategory.findFirst({
          where: {
            companyId: dto.companyId,
            assetCategoryName: dto.assetCategoryName.trim(),
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_CATEGORY_DUPLICATE,
            'Asset category name already exists',
          );
        }

        const assetCategoryCode = await this.numberSeries.next(
          'ASSET_CATEGORY',
          dto.companyId,
          'AC',
          6,
          tx,
        );

        const created = await tx.assetCategory.create({
          data: {
            companyId: dto.companyId,
            assetCategoryName: dto.assetCategoryName.trim(),
            description: dto.description?.trim() || null,
            assetCategoryCode,
          },
        });

        await this.auditService.log(
          'Asset Category',
          created.id,
          'CREATE',
          null,
          this.auditMapper.toSafeSnapshot(created),
          { tx, userId: context.userId },
        );

        return this.commandMeta('CATEGORY', created.id);
      },
      (id) => this.taxonomyQuery.findCategoryDetail(id, context),
    );
  }

  updateCategory(
    id: string,
    dto: UpdateAssetCategoryCommandDto,
    context: AssetAccessContext,
  ) {
    this.assertTaxonomyManage(context);

    return this.executeIdempotent(
      context,
      context.activeCompanyId ?? 'unknown',
      'UPDATE_CATEGORY',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadCategory(tx, id);
        this.assertExpectedVersion(current.version, dto.expectedVersion);

        if (dto.assetCategoryName) {
          const duplicate = await tx.assetCategory.findFirst({
            where: {
              companyId: current.companyId,
              assetCategoryName: dto.assetCategoryName.trim(),
              NOT: { id },
            },
            select: { id: true },
          });
          if (duplicate) {
            throw new DomainConflictException(
              ASSET_ERROR_CODES.ASSET_CATEGORY_DUPLICATE,
              'Asset category name already exists',
            );
          }
        }

        const updated = await tx.assetCategory.update({
          where: { id },
          data: {
            assetCategoryName: dto.assetCategoryName?.trim(),
            description:
              dto.description === undefined
                ? undefined
                : dto.description?.trim() || null,
            version: { increment: 1 },
          },
        });

        await this.auditService.log(
          'Asset Category',
          id,
          'UPDATE',
          this.auditMapper.toSafeSnapshot(current),
          this.auditMapper.toSafeSnapshot(updated),
          { tx, userId: context.userId },
        );

        return this.commandMeta('CATEGORY', id);
      },
      () => this.taxonomyQuery.findCategoryDetail(id, context),
    );
  }

  archiveCategory(
    id: string,
    dto: VersionedReasonCommandDto,
    context: AssetAccessContext,
  ) {
    this.assertTaxonomyManage(context);

    return this.executeIdempotent(
      context,
      context.activeCompanyId ?? 'unknown',
      'ARCHIVE_CATEGORY',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadCategory(tx, id);
        this.assertExpectedVersion(current.version, dto.expectedVersion);

        if (current.archivedAt) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_INVALID_STATE_TRANSITION,
            'Asset category is already archived',
          );
        }

        const activeTypes = await tx.assetType.count({
          where: {
            assetCategoryId: id,
            archivedAt: null,
            isActive: true,
          },
        });
        if (activeTypes > 0) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_CATEGORY_IN_USE,
            'Asset category still has active types',
          );
        }

        const updated = await tx.assetCategory.update({
          where: { id },
          data: {
            isActive: false,
            archivedAt: new Date(),
            archivedByUserId: context.userId,
            version: { increment: 1 },
          },
        });

        await this.writeActionEvent(tx, {
          context,
          companyId: current.companyId,
          entityType: AssetActionEntityType.CATEGORY,
          action: AssetActionType.CATEGORY_ARCHIVED,
          assetCategoryId: id,
          operationId: this.operationId(dto),
          versionBefore: current.version,
          versionAfter: updated.version,
          reason: dto.reason,
        });

        await this.auditService.log(
          'Asset Category',
          id,
          'ARCHIVE',
          current,
          updated,
          { tx, userId: context.userId },
        );

        return this.commandMeta('CATEGORY', id);
      },
      () => this.taxonomyQuery.findCategoryDetail(id, context),
    );
  }

  reactivateCategory(
    id: string,
    dto: VersionedCommandDto,
    context: AssetAccessContext,
  ) {
    this.assertTaxonomyManage(context);

    return this.executeIdempotent(
      context,
      context.activeCompanyId ?? 'unknown',
      'REACTIVATE_CATEGORY',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadCategory(tx, id);
        this.assertExpectedVersion(current.version, dto.expectedVersion);

        if (!current.archivedAt && current.isActive) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_INVALID_STATE_TRANSITION,
            'Asset category is already active',
          );
        }

        const updated = await tx.assetCategory.update({
          where: { id },
          data: {
            isActive: true,
            archivedAt: null,
            archivedByUserId: null,
            version: { increment: 1 },
          },
        });

        await this.writeActionEvent(tx, {
          context,
          companyId: current.companyId,
          entityType: AssetActionEntityType.CATEGORY,
          action: AssetActionType.CATEGORY_REACTIVATED,
          assetCategoryId: id,
          operationId: this.operationId(dto),
          versionBefore: current.version,
          versionAfter: updated.version,
        });

        await this.auditService.log(
          'Asset Category',
          id,
          'REACTIVATE',
          current,
          updated,
          { tx, userId: context.userId },
        );

        return this.commandMeta('CATEGORY', id);
      },
      () => this.taxonomyQuery.findCategoryDetail(id, context),
    );
  }

  async createType(
    dto: CreateAssetTypeCommandDto,
    context: AssetAccessContext,
  ) {
    this.assertTaxonomyManage(context);
    this.assertKindTracking(dto.kind, dto.trackingMode);

    return this.executeIdempotent(
      context,
      dto.companyId,
      'CREATE_TYPE',
      dto,
      async (tx) => {
        await this.organizationScope.assertCompanyInScope(dto.companyId);
        await this.organizationScope.assertAssetCategoryInScope(
          dto.assetCategoryId,
          dto.companyId,
        );

        const duplicate = await tx.assetType.findFirst({
          where: {
            companyId: dto.companyId,
            assetTypeName: dto.assetTypeName.trim(),
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_TYPE_DUPLICATE,
            'Asset type name already exists',
          );
        }

        const assetTypeCode = await this.numberSeries.next(
          'ASSET_TYPE',
          dto.companyId,
          'AT',
          6,
          tx,
        );

        const created = await tx.assetType.create({
          data: {
            companyId: dto.companyId,
            assetCategoryId: dto.assetCategoryId,
            assetTypeName: dto.assetTypeName.trim(),
            description: dto.description?.trim() || null,
            assetTypeCode,
            kind: dto.kind,
            trackingMode: dto.trackingMode,
          },
        });

        await this.auditService.log(
          'Asset Type',
          created.id,
          'CREATE',
          null,
          this.auditMapper.toSafeSnapshot(created),
          { tx, userId: context.userId },
        );

        return this.commandMeta('TYPE', created.id);
      },
      (id) => this.taxonomyQuery.findTypeDetail(id, context),
    );
  }

  updateType(
    id: string,
    dto: UpdateAssetTypeCommandDto,
    context: AssetAccessContext,
  ) {
    this.assertTaxonomyManage(context);

    return this.executeIdempotent(
      context,
      context.activeCompanyId ?? 'unknown',
      'UPDATE_TYPE',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadType(tx, id);
        this.assertExpectedVersion(current.version, dto.expectedVersion);

        const classificationChanging =
          (dto.kind && dto.kind !== current.kind) ||
          (dto.trackingMode && dto.trackingMode !== current.trackingMode) ||
          (dto.assetCategoryId &&
            dto.assetCategoryId !== current.assetCategoryId);

        if (classificationChanging) {
          const usage = await tx.asset.count({
            where: { assetTypeId: id },
          });
          if (usage > 0) {
            throw new DomainConflictException(
              ASSET_ERROR_CODES.ASSET_TYPE_CLASSIFICATION_IMMUTABLE,
              'Asset type classification cannot change while in use',
            );
          }
        }

        const nextKind = dto.kind ?? current.kind;
        const nextTracking = dto.trackingMode ?? current.trackingMode;
        if (nextKind && nextTracking) {
          this.assertKindTracking(nextKind, nextTracking);
        }

        if (dto.assetTypeName) {
          const duplicate = await tx.assetType.findFirst({
            where: {
              companyId: current.companyId,
              assetTypeName: dto.assetTypeName.trim(),
              NOT: { id },
            },
            select: { id: true },
          });
          if (duplicate) {
            throw new DomainConflictException(
              ASSET_ERROR_CODES.ASSET_TYPE_DUPLICATE,
              'Asset type name already exists',
            );
          }
        }

        if (dto.assetCategoryId) {
          await this.organizationScope.assertAssetCategoryInScope(
            dto.assetCategoryId,
            current.companyId,
          );
        }

        const updated = await tx.assetType.update({
          where: { id },
          data: {
            assetCategoryId: dto.assetCategoryId,
            assetTypeName: dto.assetTypeName?.trim(),
            description:
              dto.description === undefined
                ? undefined
                : dto.description?.trim() || null,
            kind: dto.kind,
            trackingMode: dto.trackingMode,
            version: { increment: 1 },
          },
        });

        await this.auditService.log(
          'Asset Type',
          id,
          'UPDATE',
          current,
          updated,
          { tx, userId: context.userId },
        );

        return this.commandMeta('TYPE', id);
      },
      () => this.taxonomyQuery.findTypeDetail(id, context),
    );
  }

  archiveType(
    id: string,
    dto: VersionedReasonCommandDto,
    context: AssetAccessContext,
  ) {
    this.assertTaxonomyManage(context);

    return this.executeIdempotent(
      context,
      context.activeCompanyId ?? 'unknown',
      'ARCHIVE_TYPE',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadType(tx, id);
        this.assertExpectedVersion(current.version, dto.expectedVersion);

        const activeAssets = await tx.asset.count({
          where: { assetTypeId: id, archivedAt: null, isActive: true },
        });
        if (activeAssets > 0) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_TYPE_IN_USE,
            'Asset type still has active assets',
          );
        }

        const updated = await tx.assetType.update({
          where: { id },
          data: {
            isActive: false,
            archivedAt: new Date(),
            archivedByUserId: context.userId,
            version: { increment: 1 },
          },
        });

        await this.writeActionEvent(tx, {
          context,
          companyId: current.companyId,
          entityType: AssetActionEntityType.TYPE,
          action: AssetActionType.TYPE_ARCHIVED,
          assetTypeId: id,
          operationId: this.operationId(dto),
          versionBefore: current.version,
          versionAfter: updated.version,
          reason: dto.reason,
        });

        await this.auditService.log(
          'Asset Type',
          id,
          'ARCHIVE',
          current,
          updated,
          {
            tx,
            userId: context.userId,
          },
        );

        return this.commandMeta('TYPE', id);
      },
      () => this.taxonomyQuery.findTypeDetail(id, context),
    );
  }

  reactivateType(
    id: string,
    dto: VersionedCommandDto,
    context: AssetAccessContext,
  ) {
    this.assertTaxonomyManage(context);

    return this.executeIdempotent(
      context,
      context.activeCompanyId ?? 'unknown',
      'REACTIVATE_TYPE',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadType(tx, id);
        this.assertExpectedVersion(current.version, dto.expectedVersion);

        const updated = await tx.assetType.update({
          where: { id },
          data: {
            isActive: true,
            archivedAt: null,
            archivedByUserId: null,
            version: { increment: 1 },
          },
        });

        await this.writeActionEvent(tx, {
          context,
          companyId: current.companyId,
          entityType: AssetActionEntityType.TYPE,
          action: AssetActionType.TYPE_REACTIVATED,
          assetTypeId: id,
          operationId: this.operationId(dto),
          versionBefore: current.version,
          versionAfter: updated.version,
        });

        await this.auditService.log(
          'Asset Type',
          id,
          'REACTIVATE',
          current,
          updated,
          { tx, userId: context.userId },
        );

        return this.commandMeta('TYPE', id);
      },
      () => this.taxonomyQuery.findTypeDetail(id, context),
    );
  }

  async createAsset(dto: CreateAssetCommandDto, context: AssetAccessContext) {
    if (!this.access.canManageInventory(context)) {
      throw new ForbiddenException();
    }

    return this.executeIdempotent(
      context,
      dto.companyId,
      'CREATE_ASSET',
      dto,
      async (tx) => {
        await this.organizationScope.assertCompanyInScope(dto.companyId);
        await this.access.assertDepartmentManageable(dto.departmentId, context);

        const department = await this.organizationScope.assertDepartmentInScope(
          dto.departmentId,
          dto.companyId,
        );

        const assetType = await tx.assetType.findFirst({
          where: {
            id: dto.assetTypeId,
            companyId: dto.companyId,
            archivedAt: null,
            isActive: true,
          },
        });
        if (!assetType?.kind || !assetType.trackingMode) {
          throw new DomainNotFoundException(
            ASSET_ERROR_CODES.ASSET_TYPE_NOT_FOUND,
            'Asset type not found',
          );
        }
        this.assertKindTracking(assetType.kind, assetType.trackingMode);
        this.assertSubtypePayload(assetType.kind, dto);

        const serialNumberNormalized = normalizeSerialNumber(dto.serialNumber);
        if (assetType.kind === AssetKind.HARDWARE && !serialNumberNormalized) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_IDENTIFIER_FORMAT_INVALID,
            'Hardware assets require a serial number',
          );
        }
        if (serialNumberNormalized) {
          await this.assertSerialAvailable(
            tx,
            dto.companyId,
            serialNumberNormalized,
          );
        }

        const assetCode = await this.numberSeries.next(
          'ASSET',
          dto.companyId,
          'AST',
          6,
          tx,
        );

        const created = await tx.asset.create({
          data: {
            companyId: dto.companyId,
            branchId: department.branchId,
            departmentId: dto.departmentId,
            assetTypeId: dto.assetTypeId,
            assetCode,
            assetName: dto.assetName.trim(),
            kind: assetType.kind,
            trackingMode: assetType.trackingMode,
            serialNumber: dto.serialNumber?.trim() || null,
            serialNumberNormalized,
            manufacturer: dto.manufacturer?.trim() || null,
            modelNumber: dto.modelNumber?.trim() || null,
            purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
            purchaseCost: dto.purchaseCost
              ? new Prisma.Decimal(dto.purchaseCost)
              : null,
            currency: dto.currency?.trim() || null,
            warrantyExpiry: dto.warrantyExpiry
              ? new Date(dto.warrantyExpiry)
              : null,
            location: dto.location?.trim() || null,
            remarks: dto.remarks?.trim() || null,
            lifecycleStatus: AssetLifecycleStatus.ACTIVE,
            status: 'AVAILABLE',
            isActive: true,
          },
        });

        if (assetType.kind === AssetKind.CARD && dto.card) {
          await this.writeCardEnvelope(tx, created.id, dto.companyId, dto.card);
        }

        if (
          assetType.kind === AssetKind.SOFTWARE_LICENSE &&
          dto.softwareLicense
        ) {
          this.assertLicenseDates(dto.softwareLicense);
          await tx.assetSoftwareLicenseDetail.create({
            data: {
              assetId: created.id,
              companyId: dto.companyId,
              vendorName: dto.softwareLicense.vendorName.trim(),
              productName: dto.softwareLicense.productName.trim(),
              contractReference:
                dto.softwareLicense.contractReference?.trim() || null,
              vaultReference:
                dto.softwareLicense.vaultReference?.trim() || null,
              startsOn: dto.softwareLicense.startsOn
                ? new Date(dto.softwareLicense.startsOn)
                : null,
              expiresOn: dto.softwareLicense.expiresOn
                ? new Date(dto.softwareLicense.expiresOn)
                : null,
              renewsOn: dto.softwareLicense.renewsOn
                ? new Date(dto.softwareLicense.renewsOn)
                : null,
              seatCapacity: dto.softwareLicense.seatCapacity,
              allocatedSeatCount: 0,
            },
          });
        }

        await this.auditService.log(
          'Asset',
          created.id,
          'CREATE',
          null,
          this.auditMapper.toSafeSnapshot(created),
          { tx, userId: context.userId },
        );

        return this.commandMeta('ASSET', created.id);
      },
      (id) => this.assetQuery.findInventoryDetail(id, context),
    );
  }

  updateAssetMetadata(
    id: string,
    dto: UpdateAssetMetadataCommandDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canManageInventory(context)) {
      throw new ForbiddenException();
    }

    return this.executeIdempotent(
      context,
      context.activeCompanyId ?? 'unknown',
      'UPDATE_ASSET_METADATA',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadManagedAsset(tx, id, context);
        this.assertExpectedVersion(current.version, dto.expectedVersion);

        const updated = await tx.asset.update({
          where: { id },
          data: {
            assetName: dto.assetName?.trim(),
            manufacturer: dto.manufacturer?.trim(),
            modelNumber: dto.modelNumber?.trim(),
            purchaseDate:
              dto.purchaseDate === undefined
                ? undefined
                : dto.purchaseDate
                  ? new Date(dto.purchaseDate)
                  : null,
            purchaseCost:
              dto.purchaseCost === undefined
                ? undefined
                : dto.purchaseCost
                  ? new Prisma.Decimal(dto.purchaseCost)
                  : null,
            currency:
              dto.currency === undefined
                ? undefined
                : dto.currency?.trim() || null,
            warrantyExpiry:
              dto.warrantyExpiry === undefined
                ? undefined
                : dto.warrantyExpiry
                  ? new Date(dto.warrantyExpiry)
                  : null,
            location:
              dto.location === undefined
                ? undefined
                : dto.location?.trim() || null,
            remarks:
              dto.remarks === undefined
                ? undefined
                : dto.remarks?.trim() || null,
            version: { increment: 1 },
          },
        });

        if (dto.cardMetadata && current.kind === AssetKind.CARD) {
          await tx.assetCardDetail.update({
            where: { assetId: id },
            data: {
              issuer:
                dto.cardMetadata.issuer === undefined
                  ? undefined
                  : dto.cardMetadata.issuer,
              accessZone:
                dto.cardMetadata.accessZone === undefined
                  ? undefined
                  : dto.cardMetadata.accessZone,
              expiryDate:
                dto.cardMetadata.expiryDate === undefined
                  ? undefined
                  : dto.cardMetadata.expiryDate
                    ? new Date(dto.cardMetadata.expiryDate)
                    : null,
            },
          });
        }

        if (
          dto.licenseMetadata &&
          current.kind === AssetKind.SOFTWARE_LICENSE
        ) {
          await tx.assetSoftwareLicenseDetail.update({
            where: { assetId: id },
            data: {
              vendorName: dto.licenseMetadata.vendorName,
              productName: dto.licenseMetadata.productName,
              contractReference:
                dto.licenseMetadata.contractReference === undefined
                  ? undefined
                  : dto.licenseMetadata.contractReference,
              vaultReference:
                dto.licenseMetadata.vaultReference === undefined
                  ? undefined
                  : dto.licenseMetadata.vaultReference,
              startsOn:
                dto.licenseMetadata.startsOn === undefined
                  ? undefined
                  : dto.licenseMetadata.startsOn
                    ? new Date(dto.licenseMetadata.startsOn)
                    : null,
              expiresOn:
                dto.licenseMetadata.expiresOn === undefined
                  ? undefined
                  : dto.licenseMetadata.expiresOn
                    ? new Date(dto.licenseMetadata.expiresOn)
                    : null,
              renewsOn:
                dto.licenseMetadata.renewsOn === undefined
                  ? undefined
                  : dto.licenseMetadata.renewsOn
                    ? new Date(dto.licenseMetadata.renewsOn)
                    : null,
            },
          });
        }

        await this.auditService.log('Asset', id, 'UPDATE', current, updated, {
          tx,
          userId: context.userId,
        });

        return this.commandMeta('ASSET', id);
      },
      () => this.assetQuery.findInventoryDetail(id, context),
    );
  }

  archiveAsset(
    id: string,
    dto: VersionedReasonCommandDto,
    context: AssetAccessContext,
  ) {
    return this.mutateAssetLifecycle(id, dto, context, {
      commandType: 'ARCHIVE_ASSET',
      action: AssetActionType.ARCHIVED,
      requireBroad: false,
      apply: async (tx, current) => {
        await this.assertNoBlockingUsage(tx, current.id);
        return tx.asset.update({
          where: { id },
          data: {
            isActive: false,
            archivedAt: new Date(),
            archivedByUserId: context.userId,
            status: legacyStatusForLifecycle({
              lifecycleStatus: current.lifecycleStatus,
              archived: true,
              hasOpenCustody: false,
            }),
            version: { increment: 1 },
          },
        });
      },
    });
  }

  reactivateAsset(
    id: string,
    dto: VersionedCommandDto,
    context: AssetAccessContext,
  ) {
    return this.mutateAssetLifecycle(id, dto, context, {
      commandType: 'REACTIVATE_ASSET',
      action: AssetActionType.REACTIVATED,
      requireBroad: false,
      apply: async (tx, current) => {
        if (isTerminalLifecycleStatus(current.lifecycleStatus)) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_INVALID_STATE_TRANSITION,
            'Terminal assets cannot be reactivated',
          );
        }

        return tx.asset.update({
          where: { id },
          data: {
            isActive: true,
            archivedAt: null,
            archivedByUserId: null,
            status: legacyStatusForLifecycle({
              lifecycleStatus: current.lifecycleStatus,
              archived: false,
              hasOpenCustody: false,
            }),
            version: { increment: 1 },
          },
        });
      },
    });
  }

  sendToRepair(
    id: string,
    dto: VersionedEffectiveDateCommandDto,
    context: AssetAccessContext,
  ) {
    return this.applyLifecycleCommand(
      id,
      dto,
      context,
      ASSET_LIFECYCLE_COMMAND.SEND_TO_REPAIR,
      AssetActionType.SENT_TO_REPAIR,
      'SEND_TO_REPAIR',
      false,
    );
  }

  completeRepair(
    id: string,
    dto: CompleteAssetRepairCommandDto,
    context: AssetAccessContext,
  ) {
    return this.applyLifecycleCommand(
      id,
      dto,
      context,
      ASSET_LIFECYCLE_COMMAND.COMPLETE_REPAIR,
      AssetActionType.REPAIR_COMPLETED,
      'COMPLETE_REPAIR',
      false,
      {
        repairDetailsPresent: true,
        extraData: {
          location: dto.location?.trim(),
        },
      },
    );
  }

  markLost(
    id: string,
    dto: VersionedEffectiveDateCommandDto,
    context: AssetAccessContext,
  ) {
    return this.applyLifecycleCommand(
      id,
      dto,
      context,
      ASSET_LIFECYCLE_COMMAND.MARK_LOST,
      AssetActionType.MARKED_LOST,
      'MARK_LOST',
      false,
    );
  }

  dispose(
    id: string,
    dto: VersionedEffectiveDateCommandDto,
    context: AssetAccessContext,
  ) {
    return this.applyLifecycleCommand(
      id,
      dto,
      context,
      ASSET_LIFECYCLE_COMMAND.DISPOSE,
      AssetActionType.DISPOSED,
      'DISPOSE',
      true,
    );
  }

  suspend(
    id: string,
    dto: VersionedReasonCommandDto,
    context: AssetAccessContext,
  ) {
    return this.applyLifecycleCommand(
      id,
      dto,
      context,
      ASSET_LIFECYCLE_COMMAND.SUSPEND,
      AssetActionType.SUSPENDED,
      'SUSPEND',
      false,
    );
  }

  resume(
    id: string,
    dto: VersionedReasonCommandDto,
    context: AssetAccessContext,
  ) {
    return this.applyLifecycleCommand(
      id,
      dto,
      context,
      ASSET_LIFECYCLE_COMMAND.RESUME,
      AssetActionType.RESUMED,
      'RESUME',
      false,
    );
  }

  retire(
    id: string,
    dto: VersionedEffectiveDateCommandDto,
    context: AssetAccessContext,
  ) {
    return this.applyLifecycleCommand(
      id,
      dto,
      context,
      ASSET_LIFECYCLE_COMMAND.RETIRE,
      AssetActionType.RETIRED,
      'RETIRE',
      true,
    );
  }

  resizeLicenseCapacity(
    id: string,
    dto: ResizeLicensePoolCommandDto,
    context: AssetAccessContext,
  ) {
    if (!this.access.canManageInventory(context)) {
      throw new ForbiddenException();
    }

    return this.executeIdempotent(
      context,
      context.activeCompanyId ?? 'unknown',
      'RESIZE_LICENSE_CAPACITY',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadManagedAsset(tx, id, context);
        this.assertExpectedVersion(current.version, dto.expectedVersion);

        if (
          current.kind !== AssetKind.SOFTWARE_LICENSE ||
          current.trackingMode !== AssetTrackingMode.POOL
        ) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_INVALID_STATE_TRANSITION,
            'Only licence pools can be resized',
          );
        }

        const detail = await tx.assetSoftwareLicenseDetail.findUnique({
          where: { assetId: id },
        });
        if (!detail) {
          throw new DomainNotFoundException(
            ASSET_ERROR_CODES.ASSET_NOT_FOUND,
            'Asset not found',
          );
        }

        if (dto.seatCapacity < detail.allocatedSeatCount) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.LICENSE_CAPACITY_BELOW_USAGE,
            'Seat capacity cannot be below active allocations',
          );
        }

        await tx.assetSoftwareLicenseDetail.update({
          where: { assetId: id },
          data: { seatCapacity: dto.seatCapacity },
        });

        const updated = await tx.asset.update({
          where: { id },
          data: { version: { increment: 1 } },
        });

        await this.writeActionEvent(tx, {
          context,
          companyId: current.companyId,
          entityType: AssetActionEntityType.ASSET,
          action: AssetActionType.LICENSE_CAPACITY_RESIZED,
          assetId: id,
          operationId: this.operationId(dto),
          versionBefore: current.version,
          versionAfter: updated.version,
          reason: dto.reason,
        });

        await this.auditService.log(
          'Asset',
          id,
          'RESIZE_POOL',
          current,
          updated,
          {
            tx,
            userId: context.userId,
          },
        );

        return this.commandMeta('ASSET', id);
      },
      () => this.assetQuery.findInventoryDetail(id, context),
    );
  }

  correctIdentifier(
    id: string,
    dto: CorrectAssetIdentifierCommandDto,
    context: AssetAccessContext,
  ) {
    this.assertTaxonomyManage(context);

    return this.executeIdempotent(
      context,
      context.activeCompanyId ?? 'unknown',
      'CORRECT_IDENTIFIER',
      { id, serialNumber: dto.serialNumber, reason: dto.reason },
      async (tx) => {
        const current = await this.loadManagedAsset(tx, id, context);
        this.assertExpectedVersion(current.version, dto.expectedVersion);

        const usage = await this.loadUsage(tx, id);
        if (usage.hasOpenCustody) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_IDENTIFIER_CORRECTION_BLOCKED,
            'Identifier cannot be corrected while custody is open',
          );
        }

        const hasSerial = Boolean(dto.serialNumber?.trim());
        const hasCard = Boolean(dto.cardNumber?.trim());
        if (hasSerial === hasCard) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_IDENTIFIER_FORMAT_INVALID,
            'Provide exactly one identifier field',
          );
        }

        if (hasSerial) {
          if (current.kind === AssetKind.CARD) {
            throw new DomainConflictException(
              ASSET_ERROR_CODES.ASSET_IDENTIFIER_FORMAT_INVALID,
              'Card assets require a card number',
            );
          }
          const serialNumberNormalized = normalizeSerialNumber(
            dto.serialNumber,
          );
          if (!serialNumberNormalized) {
            throw new DomainConflictException(
              ASSET_ERROR_CODES.ASSET_IDENTIFIER_FORMAT_INVALID,
              'Serial number is invalid',
            );
          }
          await this.assertSerialAvailable(
            tx,
            current.companyId,
            serialNumberNormalized,
            id,
          );
          await tx.asset.update({
            where: { id },
            data: {
              serialNumber: dto.serialNumber?.trim(),
              serialNumberNormalized,
              version: { increment: 1 },
            },
          });
        } else {
          if (current.kind !== AssetKind.CARD) {
            throw new DomainConflictException(
              ASSET_ERROR_CODES.ASSET_IDENTIFIER_FORMAT_INVALID,
              'Only card assets accept a card number',
            );
          }
          await tx.assetCardLookupIndex.deleteMany({ where: { assetId: id } });
          await this.writeCardEnvelope(
            tx,
            id,
            current.companyId,
            {
              cardNumber: dto.cardNumber!,
              issuedDate: new Date().toISOString().slice(0, 10),
            },
            true,
          );
          await tx.asset.update({
            where: { id },
            data: { version: { increment: 1 } },
          });
        }

        const updated = await tx.asset.findUniqueOrThrow({ where: { id } });

        await this.writeActionEvent(tx, {
          context,
          companyId: current.companyId,
          entityType: AssetActionEntityType.ASSET,
          action: AssetActionType.IDENTIFIER_CORRECTED,
          assetId: id,
          operationId: this.operationId(dto),
          versionBefore: current.version,
          versionAfter: updated.version,
          reason: dto.reason,
        });

        await this.auditService.log(
          'Asset',
          id,
          'CORRECT_IDENTIFIER',
          current,
          this.auditMapper.toSafeSnapshot(updated),
          { tx, userId: context.userId },
        );

        return this.commandMeta('ASSET', id);
      },
      () => this.assetQuery.findInventoryDetail(id, context),
    );
  }

  async lookupCardExact(dto: CardExactLookupDto, context: AssetAccessContext) {
    if (!this.access.canLookupSensitiveCards(context)) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_NOT_FOUND,
        'Asset not found',
      );
    }

    const lookup = this.identifiers.lookupDigest(dto.cardNumber);
    const index = await this.prisma.assetCardLookupIndex.findFirst({
      where: {
        lookupKeyVersion: lookup.lookupKeyVersion,
        digest: lookup.digest,
        ...(context.activeCompanyId
          ? { companyId: context.activeCompanyId }
          : {}),
      },
      select: { assetId: true },
    });

    if (!index) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_NOT_FOUND,
        'Asset not found',
      );
    }

    await this.auditService.log(
      'Asset',
      index.assetId,
      'CARD_EXACT_LOOKUP',
      null,
      { purposeCode: dto.purposeCode },
      { userId: context.userId },
    );

    return this.assetQuery.findInventoryDetail(index.assetId, context);
  }

  private applyLifecycleCommand(
    id: string,
    dto:
      | VersionedReasonCommandDto
      | VersionedEffectiveDateCommandDto
      | CompleteAssetRepairCommandDto,
    context: AssetAccessContext,
    command: AssetLifecycleCommand,
    action: AssetActionType,
    commandType: string,
    requireBroad: boolean,
    options?: {
      repairDetailsPresent?: boolean;
      extraData?: Prisma.AssetUpdateInput;
    },
  ) {
    return this.mutateAssetLifecycle(id, dto, context, {
      commandType,
      action,
      requireBroad,
      apply: async (tx, current) => {
        if (!current.kind || !current.trackingMode) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_INVALID_STATE_TRANSITION,
            'Asset classification is incomplete',
          );
        }

        const usage = await this.loadUsage(tx, id);
        const next = resolveLifecycleTransition(
          current.lifecycleStatus,
          command,
          {
            kind: current.kind,
            trackingMode: current.trackingMode,
            hasOpenCustody: usage.hasOpenCustody,
            hasOpenRequest: usage.hasOpenRequest,
            hasActiveAllocations: usage.hasActiveAllocations,
            isAssignedIndividual: usage.hasOpenCustody,
            repairDetailsPresent: options?.repairDetailsPresent ?? true,
          },
        );

        if (!next) {
          throw new DomainConflictException(
            ASSET_ERROR_CODES.ASSET_INVALID_STATE_TRANSITION,
            'Invalid asset lifecycle transition',
          );
        }

        return tx.asset.update({
          where: { id },
          data: {
            lifecycleStatus: next,
            status: legacyStatusForLifecycle({
              lifecycleStatus: next,
              archived: Boolean(current.archivedAt),
              hasOpenCustody: usage.hasOpenCustody,
            }),
            ...options?.extraData,
            version: { increment: 1 },
          },
        });
      },
    });
  }

  private mutateAssetLifecycle(
    id: string,
    dto: { operationId?: string; expectedVersion?: number; reason?: string },
    context: AssetAccessContext,
    options: {
      commandType: string;
      action: AssetActionType;
      requireBroad: boolean;
      apply: (
        tx: DbClient,
        current: Prisma.AssetGetPayload<object>,
      ) => Promise<Prisma.AssetGetPayload<object>>;
    },
  ) {
    if (options.requireBroad) {
      if (!this.access.canDisposeOrRetire(context)) {
        throw new ForbiddenException();
      }
    } else if (!this.access.canManageInventory(context)) {
      throw new ForbiddenException();
    }

    return this.executeIdempotent(
      context,
      context.activeCompanyId ?? 'unknown',
      options.commandType,
      { id, ...dto },
      async (tx) => {
        const current = await this.loadManagedAsset(tx, id, context);
        this.assertExpectedVersion(current.version, dto.expectedVersion);
        const updated = await options.apply(tx, current);

        await this.writeActionEvent(tx, {
          context,
          companyId: current.companyId,
          entityType: AssetActionEntityType.ASSET,
          action: options.action,
          assetId: id,
          operationId: this.operationId(dto),
          versionBefore: current.version,
          versionAfter: updated.version,
          reason: dto.reason,
        });

        await this.auditService.log(
          'Asset',
          id,
          options.commandType,
          current,
          updated,
          { tx, userId: context.userId },
        );

        return this.commandMeta('ASSET', id);
      },
      () => this.assetQuery.findInventoryDetail(id, context),
    );
  }

  private executeIdempotent<T>(
    context: AssetAccessContext,
    companyId: string,
    commandType: string,
    requestPayload: unknown,
    execute: (tx: DbClient) => Promise<{
      entityType: string;
      entityId: string;
      snapshot: Prisma.InputJsonValue;
    }>,
    replay: (entityId: string) => Promise<T>,
  ): Promise<T> {
    return this.idempotency.execute(
      context,
      companyId,
      commandType,
      requestPayload,
      execute,
      replay,
    );
  }

  private async writeCardEnvelope(
    tx: DbClient,
    assetId: string,
    companyId: string,
    card: {
      cardNumber: string;
      issuer?: string;
      accessZone?: string;
      issuedDate: string;
      expiryDate?: string;
    },
    replace = false,
  ) {
    const envelope = this.identifiers.encryptCardNumber(card.cardNumber);

    const duplicate = await tx.assetCardLookupIndex.findFirst({
      where: {
        companyId,
        lookupKeyVersion: envelope.lookupKeyVersion,
        digest: envelope.digest,
        NOT: replace ? { assetId } : undefined,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_CARD_IDENTIFIER_DUPLICATE,
        'Card identifier already exists',
      );
    }

    const data = {
      companyId,
      cardNumberCiphertext: Uint8Array.from(envelope.cardNumberCiphertext),
      encryptionNonce: Uint8Array.from(envelope.encryptionNonce),
      encryptionAuthTag: Uint8Array.from(envelope.encryptionAuthTag),
      wrappedDataKey: Uint8Array.from(envelope.wrappedDataKey),
      maskedCardNumber: envelope.maskedCardNumber,
      keyEncryptionKeyVersion: envelope.keyEncryptionKeyVersion,
      encryptionFormatVersion: envelope.encryptionFormatVersion,
      issuer: card.issuer?.trim() || null,
      accessZone: card.accessZone?.trim() || null,
      issuedDate: new Date(card.issuedDate),
      expiryDate: card.expiryDate ? new Date(card.expiryDate) : null,
    };

    if (replace) {
      await tx.assetCardDetail.update({
        where: { assetId },
        data,
      });
    } else {
      await tx.assetCardDetail.create({
        data: { assetId, ...data },
      });
    }

    await tx.assetCardLookupIndex.create({
      data: {
        companyId,
        assetId,
        lookupKeyVersion: envelope.lookupKeyVersion,
        digest: envelope.digest,
      },
    });
  }

  private async writeActionEvent(
    tx: DbClient,
    input: {
      context: AssetAccessContext;
      companyId: string;
      entityType: AssetActionEntityType;
      action: AssetActionType;
      operationId: string;
      versionBefore: number;
      versionAfter: number;
      assetCategoryId?: string;
      assetTypeId?: string;
      assetId?: string;
      reason?: string;
    },
  ) {
    await tx.assetDomainActionEvent.create({
      data: {
        companyId: input.companyId,
        entityType: input.entityType,
        action: input.action,
        assetCategoryId: input.assetCategoryId,
        assetTypeId: input.assetTypeId,
        assetId: input.assetId,
        actorUserId: input.context.userId,
        operationId: input.operationId,
        versionBefore: input.versionBefore,
        versionAfter: input.versionAfter,
        privateReason: input.reason,
      },
    });
  }

  private async loadUsage(tx: DbClient, assetId: string) {
    const [openCustody, activeAllocations, openRequest] = await Promise.all([
      tx.employeeAsset.findFirst({
        where: { assetId, returnedDate: null, status: 'ASSIGNED' },
        select: { id: true },
      }),
      tx.softwareLicenseAllocation.count({
        where: { assetId, status: 'ACTIVE' },
      }),
      tx.assetCustodyRequest.findFirst({
        where: {
          status: { in: ['SUBMITTED', 'IN_REVIEW'] },
          OR: [
            { employeeAsset: { is: { assetId } } },
            { licenseAllocation: { is: { assetId } } },
          ],
        },
        select: { id: true },
      }),
    ]);

    return {
      hasOpenCustody: Boolean(openCustody),
      hasActiveAllocations: activeAllocations > 0,
      hasOpenRequest: Boolean(openRequest),
    };
  }

  private async assertNoBlockingUsage(tx: DbClient, assetId: string) {
    const usage = await this.loadUsage(tx, assetId);
    if (usage.hasOpenCustody || usage.hasActiveAllocations) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_ACTIVE_CUSTODY_EXISTS,
        'Asset still has active custody or allocations',
      );
    }
    if (usage.hasOpenRequest) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_REQUEST_ALREADY_OPEN,
        'Asset still has an open custody request',
      );
    }
  }

  private async assertSerialAvailable(
    tx: DbClient,
    companyId: string,
    serialNumberNormalized: string,
    excludeAssetId?: string,
  ) {
    const existing = await tx.asset.findFirst({
      where: {
        companyId,
        serialNumberNormalized,
        ...(excludeAssetId ? { NOT: { id: excludeAssetId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_SERIAL_DUPLICATE,
        'Serial number already exists',
      );
    }
  }

  private assertSubtypePayload(kind: AssetKind, dto: CreateAssetCommandDto) {
    if (kind === AssetKind.CARD && !dto.card) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_KIND_DETAILS_INVALID,
        'Card assets require card details',
      );
    }
    if (kind !== AssetKind.CARD && dto.card) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_KIND_DETAILS_INVALID,
        'Card details are not valid for this type',
      );
    }
    if (kind === AssetKind.SOFTWARE_LICENSE && !dto.softwareLicense) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_KIND_DETAILS_INVALID,
        'Licence assets require licence details',
      );
    }
    if (kind !== AssetKind.SOFTWARE_LICENSE && dto.softwareLicense) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_KIND_DETAILS_INVALID,
        'Licence details are not valid for this type',
      );
    }
  }

  private assertLicenseDates(
    license: NonNullable<CreateAssetCommandDto['softwareLicense']>,
  ) {
    if (
      license.startsOn &&
      license.expiresOn &&
      license.startsOn > license.expiresOn
    ) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_DATE_RANGE_INVALID,
        'Licence start date cannot be after expiry',
      );
    }
  }

  private async loadManagedAsset(
    tx: DbClient,
    id: string,
    context: AssetAccessContext,
  ) {
    const asset = await tx.asset.findFirst({
      where: {
        id,
        ...(await this.access.buildAssetManageWhere(context)),
      },
    });
    if (!asset) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_NOT_FOUND,
        'Asset not found',
      );
    }
    return asset;
  }

  private async loadCategory(tx: DbClient, id: string) {
    const category = await tx.assetCategory.findFirst({
      where: { id, ...this.organizationScope.assetCategoryWhere() },
    });
    if (!category) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_CATEGORY_NOT_FOUND,
        'Asset category not found',
      );
    }
    return category;
  }

  private async loadType(tx: DbClient, id: string) {
    const assetType = await tx.assetType.findFirst({
      where: { id, ...this.organizationScope.assetTypeWhere() },
    });
    if (!assetType) {
      throw new DomainNotFoundException(
        ASSET_ERROR_CODES.ASSET_TYPE_NOT_FOUND,
        'Asset type not found',
      );
    }
    return assetType;
  }

  private assertTaxonomyManage(context: AssetAccessContext) {
    if (!this.access.canManageTaxonomy(context)) {
      throw new ForbiddenException();
    }
  }

  private assertKindTracking(kind: AssetKind, trackingMode: AssetTrackingMode) {
    if (!isValidAssetKindTracking(kind, trackingMode)) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_KIND_DETAILS_INVALID,
        'Asset kind and tracking mode are not a valid pair',
      );
    }
  }

  private assertExpectedVersion(actual: number, expected?: number) {
    if (expected !== undefined && expected !== actual) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.ASSET_VERSION_CONFLICT,
        'Asset version conflict',
      );
    }
  }

  private operationId(dto: { operationId?: string }) {
    return dto.operationId ?? randomUUID();
  }

  private commandMeta(entityType: string, entityId: string) {
    return {
      entityType,
      entityId,
      snapshot: {
        id: entityId,
        type: entityType,
      } satisfies Prisma.InputJsonValue,
    };
  }
}
