import { Injectable, Logger } from '@nestjs/common';
import { OnboardingTemplate, Prisma } from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';

import type { ResolvedOnboardingTemplate } from '../contracts/onboarding-runtime.contracts';
import { ONBOARDING_ERROR_CODES } from '../constants/onboarding-error-codes';

@Injectable()
export class OnboardingTemplateResolutionService {
  private readonly logger = new Logger(
    OnboardingTemplateResolutionService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: EmployeeDomainScopeService,
  ) {}

  async resolve(
    companyId: string,
    branchId: string,
    designationId: string,
    asOf: Date = new Date(),
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<ResolvedOnboardingTemplate> {
    await this.scopeService.assertDesignationInScope(designationId, companyId);
    await this.scopeService.assertBranchInScope(branchId, companyId);

    const activeWhere: Prisma.DesignationOnboardingAssignmentWhereInput = {
      designationId,
      isActive: true,
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    };

    const branchAssignment = await tx.designationOnboardingAssignment.findFirst(
      {
        where: {
          ...activeWhere,
          branchId,
        },
        include: {
          onboardingTemplate: true,
        },
        orderBy: { effectiveFrom: 'desc' },
      },
    );

    if (branchAssignment) {
      return this.toResolved(
        branchAssignment.onboardingTemplate,
        'BRANCH_OVERRIDE',
      );
    }

    const defaultAssignment =
      await tx.designationOnboardingAssignment.findFirst({
        where: {
          ...activeWhere,
          branchId: null,
        },
        include: {
          onboardingTemplate: true,
        },
        orderBy: { effectiveFrom: 'desc' },
      });

    if (defaultAssignment) {
      return this.toResolved(
        defaultAssignment.onboardingTemplate,
        'DESIGNATION_DEFAULT',
      );
    }

    const designation = await tx.designation.findFirst({
      where: {
        id: designationId,
        companyId,
        ...this.scopeService.designationWhere(),
      },
      include: {
        onboardingTemplate: true,
      },
    });

    if (!designation) {
      throw new DomainNotFoundException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_CONFIGURED,
        'Designation not found.',
      );
    }

    if (designation.onboardingTemplateId && designation.onboardingTemplate) {
      this.logger.warn(
        `Using imported-record compatibility Designation.onboardingTemplateId fallback for designation ${designationId}`,
      );

      return this.toResolved(
        designation.onboardingTemplate,
        'DESIGNATION_LEGACY_FALLBACK',
      );
    }

    throw new DomainConflictException(
      ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_CONFIGURED,
      'No onboarding template is configured for this designation and branch.',
    );
  }

  async resolvePublishedTemplateVersion(
    companyId: string,
    branchId: string,
    designationId: string,
    asOf: Date = new Date(),
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const resolved = await this.resolve(
      companyId,
      branchId,
      designationId,
      asOf,
      tx,
    );

    const version = await tx.onboardingTemplateVersion.findFirst({
      where: {
        onboardingTemplateId: resolved.onboardingTemplateId,
        status: 'PUBLISHED',
        ...this.scopeService.onboardingTemplateVersionWhere(),
      },
      orderBy: { versionNo: 'desc' },
    });

    if (!version) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_PUBLISHED,
        'Resolved onboarding template does not have a published version.',
      );
    }

    await this.assertDepartmentsMatchBranch(
      version.id,
      companyId,
      branchId,
      tx,
    );

    return {
      ...resolved,
      publishedVersion: version,
    };
  }

  async assertDepartmentsMatchBranch(
    templateVersionId: string,
    companyId: string,
    branchId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const mismatched = await tx.onboardingDepartmentTemplate.findFirst({
      where: {
        onboardingTemplateVersionId: templateVersionId,
        department: {
          OR: [
            { companyId: { not: companyId } },
            { branchId: { not: branchId } },
          ],
        },
      },
      select: {
        id: true,
      },
    });

    if (mismatched) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_BRANCH_MISMATCH,
        'The resolved onboarding template contains departments outside the employee branch.',
      );
    }
  }

  private toResolved(
    template: OnboardingTemplate,
    source: ResolvedOnboardingTemplate['source'],
  ): ResolvedOnboardingTemplate {
    return {
      onboardingTemplateId: template.id,
      onboardingTemplate: {
        id: template.id,
        code: template.templateCode ?? template.id,
        name: template.templateName,
        companyId: template.companyId,
      },
      source,
    };
  }
}
