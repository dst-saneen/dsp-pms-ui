import { Injectable } from '@nestjs/common';
import {
  AssetTrackingMode,
  Prisma,
  TemplateVersionStatus,
} from '@prisma/client';

import { DomainConflictException, getRequestActor } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';

import { OnboardingTemplateCloneService } from './onboarding-template-clone.service';
import { OnboardingTemplateValidationService } from './onboarding-template-validation.service';
import { OnboardingTemplateScopeService } from './onboarding-template-scope.service';
import { ONBOARDING_TEMPLATE_ERROR_CODES } from '../constants';
import { OnboardingFeatureGateService } from '../../onboarding-runtime/services/onboarding-feature-gate.service';

@Injectable()
export class OnboardingTemplateVersionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloneService: OnboardingTemplateCloneService,
    private readonly validationService: OnboardingTemplateValidationService,
    private readonly templateScope: OnboardingTemplateScopeService,
    private readonly featureGate: OnboardingFeatureGateService,
    private readonly auditService: AuditService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async getCurrentVersion(onboardingTemplateId: string) {
    await this.templateScope.requireTemplate(onboardingTemplateId);

    return this.prisma.onboardingTemplateVersion.findFirst({
      where: {
        onboardingTemplateId,
        isCurrent: true,
        ...this.templateScope.versionWhere(),
      },
    });
  }

  async getVersionHistory(onboardingTemplateId: string) {
    await this.templateScope.requireTemplate(onboardingTemplateId);

    return this.prisma.onboardingTemplateVersion.findMany({
      where: {
        onboardingTemplateId,
        ...this.templateScope.versionWhere(),
      },
      orderBy: { versionNo: 'desc' },
    });
  }

  async createDraft(versionId: string) {
    await this.templateScope.requireVersion(versionId);

    const draft = await this.cloneService.createDraft(versionId);

    await this.auditService.log(
      'OnboardingTemplateVersion',
      draft.id,
      'CREATE_DRAFT',
      null,
      {
        id: draft.id,
        onboardingTemplateId: draft.onboardingTemplateId,
        versionNo: draft.versionNo,
        status: draft.status,
      },
    );

    return draft;
  }

  async validate(versionId: string) {
    await this.templateScope.requireVersion(versionId);
    return this.validationService.validate(versionId);
  }

  async listExecutableAssetTypes(versionId: string) {
    const version = await this.templateScope.requireVersion(versionId);
    const companyId = this.templateScope.resolveVersionCompanyId(version);

    return this.prisma.assetType.findMany({
      where: {
        companyId,
        isActive: true,
        archivedAt: null,
        trackingMode: {
          in: [AssetTrackingMode.INDIVIDUAL, AssetTrackingMode.POOL],
        },
      },
      select: {
        id: true,
        assetTypeCode: true,
        assetTypeName: true,
        trackingMode: true,
        kind: true,
      },
      orderBy: {
        assetTypeName: 'asc',
      },
    });
  }

  async publish(versionId: string, expectedVersion: number) {
    const scoped = await this.templateScope.requireVersion(versionId);
    const companyId = this.templateScope.resolveVersionCompanyId(scoped);
    await this.featureGate.assertEnabledForContext(companyId);

    if (scoped.status !== TemplateVersionStatus.DRAFT) {
      throw new DomainConflictException(
        'VERSION_NOT_DRAFT',
        'Only draft versions can be published.',
      );
    }

    this.templateScope.assertRowVersion(scoped.rowVersion, expectedVersion);

    const validation = await this.validationService.validate(versionId);

    if (!validation.valid) {
      throw new DomainConflictException(
        'TEMPLATE_VALIDATION_FAILED',
        `Template version failed validation with ${validation.errorCount} error(s).`,
      );
    }

    const actor = getRequestActor();

    const published = await this.prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<
        Array<{
          id: string;
          status: TemplateVersionStatus;
          rowVersion: number;
          onboardingTemplateId: string;
        }>
      >(Prisma.sql`
        SELECT id, status, "rowVersion", "onboardingTemplateId"
        FROM "OnboardingTemplateVersion"
        WHERE id = ${versionId}
        FOR UPDATE
      `);

      const locked = lockedRows[0];

      if (
        !locked ||
        locked.status !== TemplateVersionStatus.DRAFT ||
        locked.rowVersion !== expectedVersion
      ) {
        throw new DomainConflictException(
          ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_VERSION_STATE_CHANGED,
          'The template version changed. Review the latest data and retry.',
        );
      }

      await tx.$queryRaw(Prisma.sql`
        SELECT id
        FROM "OnboardingTemplateScope"
        WHERE "onboardingTemplateVersionId" = ${versionId}
        ORDER BY id
        FOR UPDATE
      `);
      await tx.$queryRaw(Prisma.sql`
        SELECT id
        FROM "OnboardingDepartmentTemplate"
        WHERE "onboardingTemplateVersionId" = ${versionId}
        ORDER BY id
        FOR UPDATE
      `);
      await tx.$queryRaw(Prisma.sql`
        SELECT id
        FROM "OnboardingTaskGroup"
        WHERE "onboardingTemplateVersionId" = ${versionId}
        ORDER BY id
        FOR UPDATE
      `);
      await tx.$queryRaw(Prisma.sql`
        SELECT id
        FROM "OnboardingTemplateTask"
        WHERE "onboardingTemplateVersionId" = ${versionId}
        ORDER BY id
        FOR UPDATE
      `);

      const revalidation = await this.validationService.validate(versionId);
      if (!revalidation.valid) {
        throw new DomainConflictException(
          'TEMPLATE_VALIDATION_FAILED',
          `Template version failed validation with ${revalidation.errorCount} error(s).`,
        );
      }

      await tx.onboardingTemplateVersion.updateMany({
        where: {
          onboardingTemplateId: locked.onboardingTemplateId,
          NOT: { id: locked.id },
          OR: [
            { isCurrent: true },
            { status: TemplateVersionStatus.PUBLISHED },
          ],
        },
        data: {
          isCurrent: false,
          status: TemplateVersionStatus.ARCHIVED,
        },
      });

      const next = await tx.onboardingTemplateVersion.update({
        where: { id: locked.id },
        data: {
          status: TemplateVersionStatus.PUBLISHED,
          isCurrent: true,
          publishedAt: new Date(),
          effectiveFrom: new Date(),
          publishedByUserId: actor.userId ?? null,
          rowVersion: { increment: 1 },
        },
      });

      await this.auditService.log(
        'OnboardingTemplateVersion',
        next.id,
        'PUBLISH',
        {
          id: scoped.id,
          status: scoped.status,
          versionNo: scoped.versionNo,
        },
        {
          id: next.id,
          status: next.status,
          versionNo: next.versionNo,
          publishedAt: next.publishedAt,
        },
        { tx },
      );

      await this.outboxWriter.write(tx, {
        aggregateType: 'OnboardingTemplateVersion',
        aggregateId: next.id,
        eventType: 'ONBOARDING_TEMPLATE_VERSION_PUBLISHED',
        dedupeKey: `onboarding-template-version-published:${next.id}:${next.rowVersion}`,
        companyId: next.companyId ?? scoped.onboardingTemplate.companyId,
        payload: {
          onboardingTemplateId: next.onboardingTemplateId,
          onboardingTemplateVersionId: next.id,
          status: next.status,
        },
      });

      return next;
    });

    return published;
  }

  async archive(versionId: string) {
    const version = await this.templateScope.requireVersion(versionId);

    if (version.isCurrent) {
      throw new DomainConflictException(
        'CURRENT_VERSION_NOT_ARCHIVABLE',
        'Current published version cannot be archived.',
      );
    }

    if (version.status === TemplateVersionStatus.ARCHIVED) {
      throw new DomainConflictException(
        'VERSION_ALREADY_ARCHIVED',
        'Template version is already archived.',
      );
    }

    const archived = await this.prisma.onboardingTemplateVersion.update({
      where: { id: versionId },
      data: { status: TemplateVersionStatus.ARCHIVED },
    });

    await this.auditService.log(
      'OnboardingTemplateVersion',
      archived.id,
      'ARCHIVE',
      {
        id: version.id,
        status: version.status,
      },
      {
        id: archived.id,
        status: archived.status,
      },
    );

    return archived;
  }
}
