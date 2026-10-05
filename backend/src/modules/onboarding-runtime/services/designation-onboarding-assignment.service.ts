import { Injectable, NotFoundException } from '@nestjs/common';
import { OnboardingCommandType, Prisma } from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../../auth/auth.types';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';

import type {
  DesignationOnboardingAssignmentListResponse,
  DesignationOnboardingAssignmentResponse,
} from '../contracts/onboarding-runtime.contracts';
import { ONBOARDING_ERROR_CODES } from '../constants/onboarding-error-codes';
import {
  DeactivateDesignationOnboardingAssignmentDto,
  DesignationOnboardingAssignmentQueryDto,
  WriteDesignationOnboardingAssignmentDto,
} from '../dto/designation-assignment.dto';
import { OnboardingCommandReceiptService } from './onboarding-command-receipt.service';
import { OnboardingFeatureGateService } from './onboarding-feature-gate.service';

@Injectable()
export class DesignationOnboardingAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: EmployeeDomainScopeService,
    private readonly receiptService: OnboardingCommandReceiptService,
    private readonly featureGate: OnboardingFeatureGateService,
  ) {}

  async findAll(
    query: DesignationOnboardingAssignmentQueryDto,
  ): Promise<DesignationOnboardingAssignmentListResponse> {
    await this.featureGate.assertEnabledForContext();

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where = {
      designation: this.scopeService.designationWhere(),
      ...(query.designationId ? { designationId: query.designationId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.onboardingTemplateId
        ? { onboardingTemplateId: query.onboardingTemplateId }
        : {}),
      ...(query.keyword
        ? {
            OR: [
              {
                designation: {
                  designationName: {
                    contains: query.keyword,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                designation: {
                  designationCode: {
                    contains: query.keyword,
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.designationOnboardingAssignment.findMany({
        where,
        include: {
          designation: true,
          branch: true,
          onboardingTemplate: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { effectiveFrom: 'desc' },
      }),
      this.prisma.designationOnboardingAssignment.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page,
      limit,
      collectionAllowedActions: ['CREATE'],
    };
  }

  async create(
    user: AuthenticatedUser,
    dto: WriteDesignationOnboardingAssignmentDto,
  ): Promise<DesignationOnboardingAssignmentResponse> {
    const designation = await this.prisma.designation.findFirst({
      where: {
        id: dto.designationId,
        ...this.scopeService.designationWhere(),
      },
    });

    if (!designation) {
      throw new DomainNotFoundException(
        ONBOARDING_ERROR_CODES.DESIGNATION_OUT_OF_SCOPE,
        'Designation not found.',
      );
    }

    await this.featureGate.assertEnabledForContext(designation.companyId);

    const template = await this.prisma.onboardingTemplate.findFirst({
      where: {
        id: dto.onboardingTemplateId,
        ...this.scopeService.onboardingTemplateWhere(),
      },
    });

    if (!template) {
      throw new DomainNotFoundException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_CONFIGURED,
        'Onboarding template not found.',
      );
    }

    if (template.companyId !== designation.companyId) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_INVALID,
        'Template does not belong to the designation company.',
      );
    }

    if (dto.branchId) {
      await this.scopeService.assertBranchInScope(
        dto.branchId,
        designation.companyId,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const claim = await this.receiptService.claimOrReplay(
        {
          companyId: designation.companyId,
          operationId: dto.operationId,
          commandType: OnboardingCommandType.CREATE_DESIGNATION_ASSIGNMENT,
          actorUserId: user.id,
          requestPayload: this.assignmentRequestPayload(dto),
        },
        this.receiptService.getActiveKeyVersion(),
        tx,
      );

      if (claim.isReplay) {
        return this.responseFromReceipt(claim.safeResultSnapshot);
      }

      await this.lockAssignmentKey(tx, dto.designationId, dto.branchId ?? null);
      await this.assertNoEffectiveOverlap(
        {
          designationId: dto.designationId,
          branchId: dto.branchId ?? null,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        },
        tx,
      );

      const assignment = await tx.designationOnboardingAssignment.create({
        data: {
          companyId: designation.companyId,
          designationId: dto.designationId,
          branchId: dto.branchId ?? null,
          onboardingTemplateId: dto.onboardingTemplateId,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: {
          designation: true,
          branch: true,
          onboardingTemplate: true,
        },
      });

      const response = this.toResponse(assignment);
      await this.receiptService.completeReceipt(
        claim.receiptId!,
        {
          resultEntityType: 'DesignationOnboardingAssignment',
          resultEntityId: assignment.id,
          safeResultSnapshot: response as unknown as Record<string, unknown>,
        },
        tx,
      );

      return response;
    });

    return created;
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: WriteDesignationOnboardingAssignmentDto,
  ): Promise<DesignationOnboardingAssignmentResponse> {
    const existing = await this.loadScoped(id);

    if (dto.designationId !== existing.designationId) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_INVALID,
        'An onboarding assignment cannot be moved to another designation.',
      );
    }

    const template = await this.prisma.onboardingTemplate.findFirst({
      where: {
        id: dto.onboardingTemplateId,
        ...this.scopeService.onboardingTemplateWhere(),
      },
    });

    if (!template) {
      throw new DomainNotFoundException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_CONFIGURED,
        'Onboarding template not found.',
      );
    }

    if (template.companyId !== existing.designation.companyId) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_INVALID,
        'Template does not belong to the designation company.',
      );
    }

    if (dto.branchId) {
      await this.scopeService.assertBranchInScope(
        dto.branchId,
        existing.designation.companyId,
      );
    }

    if (dto.expectedVersion === undefined) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.VERSION_CONFLICT,
        'expectedVersion is required.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const claim = await this.receiptService.claimOrReplay(
        {
          companyId: existing.designation.companyId,
          operationId: dto.operationId,
          commandType: OnboardingCommandType.UPDATE_DESIGNATION_ASSIGNMENT,
          actorUserId: user.id,
          requestPayload: {
            assignmentId: id,
            ...this.assignmentRequestPayload(dto),
          },
        },
        this.receiptService.getActiveKeyVersion(),
        tx,
      );

      if (claim.isReplay) {
        return this.responseFromReceipt(claim.safeResultSnapshot);
      }

      await this.lockAssignmentKey(
        tx,
        existing.designationId,
        dto.branchId ?? null,
      );

      const current = await tx.designationOnboardingAssignment.findUnique({
        where: { id: existing.id },
        select: { version: true },
      });
      if (!current || current.version !== dto.expectedVersion) {
        throw new DomainConflictException(
          ONBOARDING_ERROR_CODES.VERSION_CONFLICT,
          'Assignment version changed.',
        );
      }

      await this.assertNoEffectiveOverlap(
        {
          designationId: existing.designationId,
          branchId: dto.branchId ?? null,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          excludeId: existing.id,
        },
        tx,
      );

      const result = await tx.designationOnboardingAssignment.updateMany({
        where: { id: existing.id, version: dto.expectedVersion },
        data: {
          onboardingTemplateId: dto.onboardingTemplateId,
          branchId: dto.branchId ?? null,
          effectiveFrom: new Date(dto.effectiveFrom),
          effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          updatedByUserId: user.id,
          version: { increment: 1 },
        },
      });
      this.assertAssignmentMutationApplied(result.count);

      const assignment =
        await tx.designationOnboardingAssignment.findUniqueOrThrow({
          where: { id: existing.id },
          include: {
            designation: true,
            branch: true,
            onboardingTemplate: true,
          },
        });

      const response = this.toResponse(assignment);
      await this.receiptService.completeReceipt(
        claim.receiptId!,
        {
          resultEntityType: 'DesignationOnboardingAssignment',
          resultEntityId: assignment.id,
          safeResultSnapshot: response as unknown as Record<string, unknown>,
        },
        tx,
      );

      return response;
    });

    return updated;
  }

  async deactivate(
    user: AuthenticatedUser,
    id: string,
    dto: DeactivateDesignationOnboardingAssignmentDto,
  ): Promise<DesignationOnboardingAssignmentResponse> {
    const existing = await this.loadScoped(id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const claim = await this.receiptService.claimOrReplay(
        {
          companyId: existing.designation.companyId,
          operationId: dto.operationId,
          commandType: OnboardingCommandType.DEACTIVATE_DESIGNATION_ASSIGNMENT,
          actorUserId: user.id,
          requestPayload: {
            assignmentId: id,
            expectedVersion: dto.expectedVersion,
            reason: dto.reason,
          },
        },
        this.receiptService.getActiveKeyVersion(),
        tx,
      );

      if (claim.isReplay) {
        return this.responseFromReceipt(claim.safeResultSnapshot);
      }

      await this.lockAssignmentKey(
        tx,
        existing.designationId,
        existing.branchId,
      );

      const current = await tx.designationOnboardingAssignment.findUnique({
        where: { id: existing.id },
        select: { version: true, isActive: true },
      });
      if (!current || current.version !== dto.expectedVersion) {
        throw new DomainConflictException(
          ONBOARDING_ERROR_CODES.VERSION_CONFLICT,
          'Assignment version changed.',
        );
      }
      if (!current.isActive) {
        throw new DomainConflictException(
          ONBOARDING_ERROR_CODES.ASSIGNMENT_ALREADY_INACTIVE,
          'Assignment is already inactive.',
        );
      }

      const result = await tx.designationOnboardingAssignment.updateMany({
        where: {
          id: existing.id,
          version: dto.expectedVersion,
          isActive: true,
        },
        data: {
          isActive: false,
          effectiveTo: new Date(),
          deactivatedAt: new Date(),
          deactivatedByUserId: user.id,
          deactivationReason: dto.reason.trim(),
          updatedByUserId: user.id,
          version: { increment: 1 },
        },
      });
      this.assertAssignmentMutationApplied(result.count);

      const assignment =
        await tx.designationOnboardingAssignment.findUniqueOrThrow({
          where: { id: existing.id },
          include: {
            designation: true,
            branch: true,
            onboardingTemplate: true,
          },
        });

      const response = this.toResponse(assignment);
      await this.receiptService.completeReceipt(
        claim.receiptId!,
        {
          resultEntityType: 'DesignationOnboardingAssignment',
          resultEntityId: assignment.id,
          safeResultSnapshot: response as unknown as Record<string, unknown>,
        },
        tx,
      );

      return response;
    });

    return updated;
  }

  private async assertNoEffectiveOverlap(
    input: {
      designationId: string;
      branchId: string | null;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      excludeId?: string;
    },
    db: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_INVALID,
        'Effective end cannot be earlier than effective start.',
      );
    }

    const candidates = await db.designationOnboardingAssignment.findMany({
      where: {
        designationId: input.designationId,
        isActive: true,
        ...(input.branchId ? { branchId: input.branchId } : { branchId: null }),
        ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}),
      },
      select: {
        id: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    });

    const overlaps = candidates.some((candidate) => {
      const candidateEnd = candidate.effectiveTo ?? new Date('9999-12-31');
      const inputEnd = input.effectiveTo ?? new Date('9999-12-31');
      return (
        candidate.effectiveFrom <= inputEnd &&
        input.effectiveFrom <= candidateEnd
      );
    });

    if (overlaps) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_INVALID,
        input.branchId
          ? 'This designation already has an overlapping Branch override.'
          : 'This designation already has an overlapping Company default.',
      );
    }
  }

  private async lockAssignmentKey(
    tx: Prisma.TransactionClient,
    designationId: string,
    branchId: string | null,
  ): Promise<void> {
    const lockKey = `onboarding-assignment:${designationId}:${branchId ?? 'COMPANY'}`;
    await tx.$queryRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    `);
  }

  private assertAssignmentMutationApplied(count: number): void {
    if (count !== 1) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.VERSION_CONFLICT,
        'Assignment version changed.',
      );
    }
  }

  private assignmentRequestPayload(
    dto: WriteDesignationOnboardingAssignmentDto,
  ): Record<string, unknown> {
    return {
      designationId: dto.designationId,
      branchId: dto.branchId ?? null,
      onboardingTemplateId: dto.onboardingTemplateId,
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo ?? null,
      expectedVersion: dto.expectedVersion ?? null,
    };
  }

  private responseFromReceipt(
    snapshot: Record<string, unknown> | undefined,
  ): DesignationOnboardingAssignmentResponse {
    if (!snapshot || typeof snapshot.id !== 'string') {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ONBOARDING_STATE_CHANGED,
        'The previous assignment command did not store a complete response.',
      );
    }

    return snapshot as unknown as DesignationOnboardingAssignmentResponse;
  }

  private async loadScoped(id: string) {
    const assignment =
      await this.prisma.designationOnboardingAssignment.findFirst({
        where: {
          id,
          designation: this.scopeService.designationWhere(),
        },
        include: {
          designation: true,
          branch: true,
          onboardingTemplate: true,
        },
      });

    if (!assignment) {
      throw new NotFoundException();
    }

    await this.featureGate.assertEnabledForContext(
      assignment.designation.companyId,
      assignment.branchId ?? undefined,
    );

    return assignment;
  }

  private toResponse(item: {
    id: string;
    version: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    isActive: boolean;
    designation: {
      id: string;
      designationCode: string;
      designationName: string;
    };
    branch: {
      id: string;
      branchCode: string;
      branchName: string;
    } | null;
    onboardingTemplate: {
      id: string;
      templateCode: string | null;
      templateName: string;
    };
  }): DesignationOnboardingAssignmentResponse {
    const allowedActions: DesignationOnboardingAssignmentResponse['allowedActions'] =
      item.isActive ? ['EDIT', 'DEACTIVATE'] : [];

    return {
      id: item.id,
      version: item.version,
      designation: {
        id: item.designation.id,
        code: item.designation.designationCode,
        name: item.designation.designationName,
      },
      branch: item.branch
        ? {
            id: item.branch.id,
            code: item.branch.branchCode,
            name: item.branch.branchName,
          }
        : null,
      template: {
        id: item.onboardingTemplate.id,
        code:
          item.onboardingTemplate.templateCode ?? item.onboardingTemplate.id,
        name: item.onboardingTemplate.templateName,
      },
      effectiveFrom: item.effectiveFrom.toISOString(),
      effectiveTo: item.effectiveTo?.toISOString() ?? null,
      isActive: item.isActive,
      allowedActions,
    };
  }
}
