import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CareerEventType,
  OnboardingCommandType,
  OnboardingContractVersion,
  OnboardingSourceType,
  Prisma,
  TaskStatus,
  TemplateVersionStatus,
  WorkOwnerType,
  WorkType,
} from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { SortOrder } from '../../../common/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AuthenticatedUser } from '../../auth/auth.types';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';
import { isValidIanaTimeZone } from '../../leave-policy/leave-calendar.util';

import type {
  EmployeeOnboardingCompletionPreflightResponse,
  OnboardingPreflightResponse,
  PagedResult,
  EmployeeOnboardingRuntimeView,
} from '../contracts/onboarding-runtime.contracts';
import { ONBOARDING_ERROR_CODES } from '../constants/onboarding-error-codes';
import {
  hasOnboardingPermission,
  ONBOARDING_PERMISSIONS,
} from '../constants/onboarding-permissions';
import {
  CancelEmployeeOnboardingDto,
  CompleteEmployeeOnboardingDto,
  OverrideStartEmployeeOnboardingDto,
  StartEmployeeOnboardingDto,
} from '../dto/onboarding-command.dto';
import { EmployeeOnboardingListQueryDto } from '../dto/onboarding-query.dto';
import {
  onboardingDetailInclude,
  OnboardingResponseMapper,
} from '../mappers/onboarding-response.mapper';
import { OnboardingActorContextService } from './onboarding-actor-context.service';
import { OnboardingCapabilityService } from './onboarding-capability.service';
import { OnboardingCommandReceiptService } from './onboarding-command-receipt.service';
import { OnboardingFeatureGateService } from './onboarding-feature-gate.service';
import { OnboardingProgressService } from './onboarding-progress.service';
import { OnboardingScopeService } from './onboarding-scope.service';
import { OnboardingTemplateResolutionService } from './onboarding-template-resolution.service';
import { OnboardingTransactionRunnerService } from './onboarding-transaction-runner.service';

@Injectable()
export class EmployeeOnboardingRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: EmployeeDomainScopeService,
    private readonly onboardingScope: OnboardingScopeService,
    private readonly actorContext: OnboardingActorContextService,
    private readonly templateResolution: OnboardingTemplateResolutionService,
    private readonly featureGate: OnboardingFeatureGateService,
    private readonly receiptService: OnboardingCommandReceiptService,
    private readonly transactionRunner: OnboardingTransactionRunnerService,
    private readonly progressService: OnboardingProgressService,
    private readonly capabilityService: OnboardingCapabilityService,
    private readonly mapper: OnboardingResponseMapper,
    private readonly auditService: AuditService,
  ) {}

  async preflight(
    user: AuthenticatedUser,
    query: {
      employeeId: string;
      startDate: string;
      overrideTemplateId?: string;
    },
  ): Promise<OnboardingPreflightResponse> {
    const actor = await this.actorContext.resolve(user);
    const employee = await this.loadEmployee(query.employeeId);
    const startDate = new Date(query.startDate);
    const isOverride = Boolean(query.overrideTemplateId);

    await this.featureGate.assertEnabledForContext(
      employee.companyId,
      employee.branchId,
    );

    const blockers: OnboardingPreflightResponse['blockers'] = [];
    const warnings: OnboardingPreflightResponse['warnings'] = [];

    if (!this.configuredBranchTimezone(employee.branch.timezone)) {
      blockers.push({
        code: ONBOARDING_ERROR_CODES.ONBOARDING_BRANCH_TIMEZONE_REQUIRED,
        message:
          'Configure a valid IANA timezone on the employee branch before starting onboarding.',
        entityId: employee.branchId,
      });
    }

    const existing = await this.prisma.employeeOnboarding.findFirst({
      where: {
        employeeId: employee.id,
        status: TaskStatus.IN_PROGRESS,
        ...this.scopeService.onboardingWhere(),
      },
    });

    if (existing) {
      blockers.push({
        code: ONBOARDING_ERROR_CODES.ACTIVE_ONBOARDING_EXISTS,
        message: 'Employee already has an active onboarding.',
        entityId: existing.id,
      });
    }

    let resolvedTemplate: OnboardingPreflightResponse['resolvedTemplate'];
    let automaticResolution: OnboardingPreflightResponse['automaticResolution'];
    let automaticResolutionFailureCode: OnboardingPreflightResponse['automaticResolutionFailureCode'];

    try {
      if (isOverride && query.overrideTemplateId) {
        if (!actor.permissions.includes(ONBOARDING_PERMISSIONS.OVERRIDE)) {
          blockers.push({
            code: 'FORBIDDEN',
            message: 'Override start is not authorized.',
          });
        } else {
          const template = await this.prisma.onboardingTemplate.findFirst({
            where: {
              id: query.overrideTemplateId,
              companyId: employee.companyId,
              ...this.scopeService.onboardingTemplateWhere(),
            },
          });

          if (!template) {
            blockers.push({
              code: ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_CONFIGURED,
              message: 'Override template not found.',
            });
          } else {
            const version =
              await this.prisma.onboardingTemplateVersion.findFirst({
                where: {
                  onboardingTemplateId: template.id,
                  status: TemplateVersionStatus.PUBLISHED,
                },
                orderBy: { versionNo: 'desc' },
              });

            if (!version) {
              blockers.push({
                code: ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_PUBLISHED,
                message: 'Override template is not published.',
              });
            } else {
              resolvedTemplate = {
                templateId: template.id,
                templateCode: template.templateCode ?? template.id,
                templateName: template.templateName,
                templateVersionId: version.id,
                versionNo: version.versionNo,
                resolutionSource: 'PRIVILEGED_OVERRIDE',
              };
            }
          }
        }

        try {
          const automatic =
            await this.templateResolution.resolvePublishedTemplateVersion(
              employee.companyId,
              employee.branchId,
              employee.designationId ?? '',
              startDate,
            );
          automaticResolution = {
            templateId: automatic.onboardingTemplateId,
            templateCode: automatic.onboardingTemplate.code,
            templateName: automatic.onboardingTemplate.name,
            templateVersionId: automatic.publishedVersion.id,
            versionNo: automatic.publishedVersion.versionNo,
            resolutionSource: automatic.source,
          };
        } catch (error) {
          if (
            error instanceof DomainConflictException ||
            error instanceof DomainNotFoundException
          ) {
            automaticResolutionFailureCode =
              error.code as OnboardingPreflightResponse['automaticResolutionFailureCode'];
          }
        }
      } else {
        const automatic =
          await this.templateResolution.resolvePublishedTemplateVersion(
            employee.companyId,
            employee.branchId,
            employee.designationId ?? '',
            startDate,
          );

        resolvedTemplate = {
          templateId: automatic.onboardingTemplateId,
          templateCode: automatic.onboardingTemplate.code,
          templateName: automatic.onboardingTemplate.name,
          templateVersionId: automatic.publishedVersion.id,
          versionNo: automatic.publishedVersion.versionNo,
          resolutionSource: automatic.source,
        };
      }
    } catch (error) {
      if (
        error instanceof DomainConflictException ||
        error instanceof DomainNotFoundException
      ) {
        automaticResolutionFailureCode =
          error.code as OnboardingPreflightResponse['automaticResolutionFailureCode'];
        blockers.push({
          code: error.code,
          message: error.message,
        });
      } else {
        throw error;
      }
    }

    const canStart = blockers.length === 0 && Boolean(resolvedTemplate);
    const allowedActions: OnboardingPreflightResponse['allowedActions'] = [];

    if (canStart) {
      allowedActions.push(isOverride ? 'OVERRIDE_START' : 'START');
    }

    let summary: OnboardingPreflightResponse['summary'] = {
      totalTasks: 0,
      mandatoryTasks: 0,
      departmentTasks: 0,
      employeeTasks: 0,
      managerTasks: 0,
      assetTasks: 0,
    };
    let departments: OnboardingPreflightResponse['departments'] = [];

    if (resolvedTemplate?.templateVersionId) {
      const versionWithTasks =
        await this.prisma.onboardingTemplateVersion.findFirst({
          where: { id: resolvedTemplate.templateVersionId },
          include: {
            departments: {
              include: {
                department: true,
                taskGroups: {
                  where: { isActive: true },
                  include: {
                    tasks: true,
                  },
                },
              },
            },
          },
        });

      if (versionWithTasks) {
        const allTasks = versionWithTasks.departments.flatMap((dept) =>
          dept.taskGroups.flatMap((group) => group.tasks),
        );

        summary = {
          totalTasks: allTasks.length,
          mandatoryTasks: allTasks.filter((task) => task.isMandatory).length,
          departmentTasks: allTasks.filter(
            (task) => task.ownerType === WorkOwnerType.DEPARTMENT,
          ).length,
          employeeTasks: allTasks.filter(
            (task) => task.ownerType === WorkOwnerType.EMPLOYEE,
          ).length,
          managerTasks: allTasks.filter(
            (task) => task.ownerType === WorkOwnerType.MANAGER,
          ).length,
          assetTasks: allTasks.filter(
            (task) => task.workType === WorkType.ASSET,
          ).length,
        };

        departments = versionWithTasks.departments.map((dept) => ({
          id: dept.departmentId,
          name: dept.department?.departmentName ?? dept.departmentId,
          taskCount: dept.taskGroups.reduce(
            (count, group) => count + group.tasks.length,
            0,
          ),
          hasActiveAssigner: true,
        }));
      }
    }

    return {
      mode: isOverride ? 'OVERRIDE' : 'NORMAL',
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        displayName: `${employee.firstName} ${employee.lastName ?? ''}`.trim(),
        companyId: employee.companyId,
        branchId: employee.branchId,
        departmentId: employee.departmentId,
        designationId: employee.designationId,
      },
      resolvedTemplate,
      automaticResolution,
      automaticResolutionFailureCode,
      summary,
      departments,
      blockers,
      warnings,
      canStart,
      allowedActions,
      actionCapabilities: allowedActions.map((action) => ({
        action,
        authorityMode: 'NORMAL' as const,
        reasonRequired: action === 'OVERRIDE_START',
        reasonField:
          action === 'OVERRIDE_START' ? ('overrideReason' as const) : null,
        remarksRequired: false,
        confirmationTone:
          action === 'OVERRIDE_START'
            ? ('BREAK_GLASS' as const)
            : ('NORMAL' as const),
        preflight: 'NONE' as const,
      })),
    };
  }

  async start(
    user: AuthenticatedUser,
    dto: StartEmployeeOnboardingDto,
  ): Promise<EmployeeOnboardingRuntimeView> {
    if (dto.templateId) {
      throw new BadRequestException({
        code: ONBOARDING_ERROR_CODES.ONBOARDING_START_PRECONDITION_FAILED,
        message: 'Normal start must not include templateId.',
      });
    }

    const actor = await this.actorContext.resolve(user);
    this.assertCanManage(actor);
    const employee = await this.loadEmployee(dto.employeeId);
    await this.featureGate.assertEnabledForContext(
      employee.companyId,
      employee.branchId,
    );

    const startDate = new Date(dto.startDate);
    const resolved =
      await this.templateResolution.resolvePublishedTemplateVersion(
        employee.companyId,
        employee.branchId,
        employee.designationId ?? '',
        startDate,
      );

    const branchTimeZone = this.requireConfiguredBranchTimezone(
      employee.branch.timezone,
    );

    const keyVersion = this.receiptService.getActiveKeyVersion();
    const onboardingId = await this.transactionRunner.run(async (tx) => {
      const claim = await this.receiptService.claimOrReplay(
        {
          companyId: employee.companyId,
          operationId: dto.operationId,
          commandType: OnboardingCommandType.START,
          actorUserId: actor.userId,
          requestPayload: {
            employeeId: dto.employeeId,
            startDate: dto.startDate,
            remarks: dto.remarks ?? null,
          },
        },
        keyVersion,
        tx,
      );

      if (claim.isReplay) {
        return this.replayedOnboardingId(claim.safeResultSnapshot);
      }

      const existing = await tx.employeeOnboarding.findFirst({
        where: {
          employeeId: employee.id,
          status: TaskStatus.IN_PROGRESS,
        },
      });

      if (existing) {
        throw new DomainConflictException(
          ONBOARDING_ERROR_CODES.ACTIVE_ONBOARDING_EXISTS,
          'Employee already has an active onboarding.',
        );
      }

      const onboarding = await this.snapshotRuntime(tx, {
        employee,
        templateId: resolved.onboardingTemplateId,
        templateVersionId: resolved.publishedVersion.id,
        resolutionSource: resolved.source,
        startDate,
        remarks: dto.remarks,
        startedByUserId: actor.userId,
        branchTimeZone,
        sourceType: OnboardingSourceType.MANUAL,
      });

      await this.receiptService.completeReceipt(
        claim.receiptId!,
        {
          resultEntityType: 'EmployeeOnboarding',
          resultEntityId: onboarding.id,
          safeResultSnapshot: { onboardingId: onboarding.id },
        },
        tx,
      );

      return onboarding.id;
    });

    return this.findOne(user, onboardingId);
  }

  async overrideStart(
    user: AuthenticatedUser,
    dto: OverrideStartEmployeeOnboardingDto,
  ): Promise<EmployeeOnboardingRuntimeView> {
    const actor = await this.actorContext.resolve(user);
    if (!actor.permissions.includes(ONBOARDING_PERMISSIONS.OVERRIDE)) {
      throw new NotFoundException();
    }

    const employee = await this.loadEmployee(dto.employeeId);
    await this.featureGate.assertEnabledForContext(
      employee.companyId,
      employee.branchId,
    );

    const template = await this.prisma.onboardingTemplate.findFirst({
      where: {
        id: dto.templateId,
        companyId: employee.companyId,
        ...this.scopeService.onboardingTemplateWhere(),
      },
    });

    if (!template) {
      throw new DomainNotFoundException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_CONFIGURED,
        'Override template not found.',
      );
    }

    const publishedVersion =
      await this.prisma.onboardingTemplateVersion.findFirst({
        where: {
          onboardingTemplateId: template.id,
          status: TemplateVersionStatus.PUBLISHED,
        },
        orderBy: { versionNo: 'desc' },
      });

    if (!publishedVersion) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_PUBLISHED,
        'Override template is not published.',
      );
    }

    await this.templateResolution.assertDepartmentsMatchBranch(
      publishedVersion.id,
      employee.companyId,
      employee.branchId,
    );

    const startDate = new Date(dto.startDate);
    const branchTimeZone = this.requireConfiguredBranchTimezone(
      employee.branch.timezone,
    );

    const keyVersion = this.receiptService.getActiveKeyVersion();
    const onboardingId = await this.transactionRunner.run(async (tx) => {
      const claim = await this.receiptService.claimOrReplay(
        {
          companyId: employee.companyId,
          operationId: dto.operationId,
          commandType: OnboardingCommandType.OVERRIDE_START,
          actorUserId: actor.userId,
          requestPayload: {
            employeeId: dto.employeeId,
            templateId: dto.templateId,
            startDate: dto.startDate,
            reason: dto.reason,
            remarks: dto.remarks ?? null,
          },
        },
        keyVersion,
        tx,
      );

      if (claim.isReplay) {
        return this.replayedOnboardingId(claim.safeResultSnapshot);
      }

      const onboarding = await this.snapshotRuntime(tx, {
        employee,
        templateId: template.id,
        templateVersionId: publishedVersion.id,
        resolutionSource: 'PRIVILEGED_OVERRIDE',
        startDate,
        remarks: dto.remarks,
        startedByUserId: actor.userId,
        branchTimeZone,
        sourceType: OnboardingSourceType.MANUAL,
        overrideStartReason: dto.reason,
      });

      await this.receiptService.completeReceipt(
        claim.receiptId!,
        {
          resultEntityType: 'EmployeeOnboarding',
          resultEntityId: onboarding.id,
          safeResultSnapshot: { onboardingId: onboarding.id },
        },
        tx,
      );

      return onboarding.id;
    });

    return this.findOne(user, onboardingId);
  }

  async findAll(
    user: AuthenticatedUser,
    query: EmployeeOnboardingListQueryDto,
  ): Promise<PagedResult<EmployeeOnboardingRuntimeView>> {
    await this.featureGate.assertEnabledForContext();

    const actor = await this.actorContext.resolve(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeOnboardingWhereInput = {
      ...this.scopeService.onboardingWhere(),
      ...(query.status
        ? {
            statusV2:
              query.status as Prisma.EnumEmployeeOnboardingStatusNullableFilter['equals'],
          }
        : {}),
      ...(query.keyword
        ? {
            employee: {
              OR: [
                {
                  employeeCode: {
                    contains: query.keyword,
                    mode: 'insensitive',
                  },
                },
                { firstName: { contains: query.keyword, mode: 'insensitive' } },
                { lastName: { contains: query.keyword, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.employeeOnboarding.findMany({
        where,
        include: onboardingDetailInclude,
        skip,
        take: limit,
        orderBy: {
          startDate: query.sortOrder === SortOrder.ASC ? 'asc' : 'desc',
        },
      }),
      this.prisma.employeeOnboarding.count({ where }),
    ]);

    return {
      items: items.map(
        (item) =>
          this.mapper.mapOnboarding(
            item,
            actor,
          ) as EmployeeOnboardingRuntimeView,
      ),
      total,
      page,
      limit,
    };
  }

  async findOne(
    user: AuthenticatedUser,
    id: string,
  ): Promise<EmployeeOnboardingRuntimeView> {
    const actor = await this.actorContext.resolve(user);
    const record = await this.onboardingScope.loadOnboarding(id);
    return this.mapper.mapOnboarding(
      record,
      actor,
    ) as EmployeeOnboardingRuntimeView;
  }

  async completionPreflight(
    user: AuthenticatedUser,
    id: string,
  ): Promise<EmployeeOnboardingCompletionPreflightResponse> {
    const actor = await this.actorContext.resolve(user);
    const record = await this.onboardingScope.loadOnboarding(id);
    const view = this.mapper.mapOnboarding(
      record,
      actor,
    ) as EmployeeOnboardingRuntimeView;

    return {
      onboardingId: record.id,
      contractVersion: record.contractVersion,
      expectedOnboardingVersion: record.version,
      canComplete: view.progress.canComplete,
      mandatoryRemaining: view.progress.mandatoryRemaining,
      optionalTasksToAutoSkip: view.progress.unfinishedOptional,
      probationWillStart: true,
      blockedReasons: view.blockedReasons,
      warnings: [],
      allowedActions: view.allowedActions,
      actionCapabilities: view.actionCapabilities,
    };
  }

  async complete(
    user: AuthenticatedUser,
    id: string,
    dto: CompleteEmployeeOnboardingDto,
  ): Promise<EmployeeOnboardingRuntimeView> {
    const actor = await this.actorContext.resolve(user);
    this.assertCanManage(actor);
    const keyVersion = this.receiptService.getActiveKeyVersion();

    const onboardingId = await this.transactionRunner.run(async (tx) => {
      const record = await tx.employeeOnboarding.findFirst({
        where: {
          id,
          ...this.scopeService.onboardingWhere(),
        },
        include: onboardingDetailInclude,
      });

      if (!record) {
        throw new NotFoundException();
      }

      await this.featureGate.assertEnabledForContext(
        record.companyId,
        record.branchId ?? undefined,
      );

      const claim = await this.receiptService.claimOrReplay(
        {
          companyId: record.companyId,
          operationId: dto.operationId,
          commandType: OnboardingCommandType.COMPLETE_ONBOARDING,
          actorUserId: actor.userId,
          requestPayload: {
            onboardingId: id,
            expectedOnboardingVersion: dto.expectedOnboardingVersion,
            note: dto.note ?? null,
          },
        },
        keyVersion,
        tx,
      );

      if (claim.isReplay) {
        return this.replayedOnboardingId(claim.safeResultSnapshot);
      }

      if (record.version !== dto.expectedOnboardingVersion) {
        throw new DomainConflictException(
          ONBOARDING_ERROR_CODES.ONBOARDING_STATE_CHANGED,
          'Onboarding version changed.',
        );
      }

      const capabilities = this.capabilityService.calculateOnboardingActions(
        actor,
        { ...record, status: record.statusV2 ?? record.status },
        record.tasks.map((task) => ({
          ...task,
          status: task.statusV2 ?? task.status,
        })),
      );
      const progress = this.progressService.calculateFromTasks(
        record.tasks.map((task) => ({
          status: String(task.statusV2 ?? task.status),
          isMandatory: task.isMandatory,
          assignedToUserId: task.assignedToUserId,
        })),
        record.statusV2 ?? 'IN_PROGRESS',
      );

      if (!capabilities.allowedActions.includes('COMPLETE')) {
        if (!progress.canComplete) {
          throw new DomainConflictException(
            ONBOARDING_ERROR_CODES.MANDATORY_TASKS_INCOMPLETE,
            'Mandatory tasks remain incomplete.',
          );
        }

        throw new NotFoundException();
      }

      const transition = await tx.employeeOnboarding.updateMany({
        where: {
          id,
          version: dto.expectedOnboardingVersion,
          status: TaskStatus.IN_PROGRESS,
        },
        data: {
          status: TaskStatus.COMPLETED,
          statusV2: 'COMPLETED',
          completedAt: new Date(),
          completedDate: new Date(),
          completedByUserId: actor.userId,
          version: { increment: 1 },
          progress: 100,
        },
      });

      this.assertOnboardingTransitionWon(transition.count);

      await tx.employeeOnboardingTask.updateMany({
        where: {
          onboardingId: id,
          isMandatory: false,
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        },
        data: {
          status: TaskStatus.SKIPPED,
          statusV2: 'SKIPPED',
          resolvedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await tx.employeeCareerEvent.create({
        data: {
          employeeId: record.employeeId,
          eventType: CareerEventType.ONBOARDING_COMPLETED,
          eventAt: new Date(),
          employeeVisibleSummary: 'Onboarding completed.',
          sourceModule: 'ONBOARDING',
          sourceRecordId: id,
        },
      });

      await this.receiptService.completeReceipt(
        claim.receiptId!,
        {
          resultEntityType: 'EmployeeOnboarding',
          resultEntityId: id,
          safeResultSnapshot: { onboardingId: id },
        },
        tx,
      );

      return id;
    });

    return this.findOne(user, onboardingId);
  }

  async cancel(
    user: AuthenticatedUser,
    id: string,
    dto: CancelEmployeeOnboardingDto,
  ): Promise<EmployeeOnboardingRuntimeView> {
    const actor = await this.actorContext.resolve(user);
    this.assertCanManage(actor);
    const keyVersion = this.receiptService.getActiveKeyVersion();

    const onboardingId = await this.transactionRunner.run(async (tx) => {
      const record = await tx.employeeOnboarding.findFirst({
        where: {
          id,
          ...this.scopeService.onboardingWhere(),
        },
        include: onboardingDetailInclude,
      });

      if (!record) {
        throw new NotFoundException();
      }

      await this.featureGate.assertEnabledForContext(
        record.companyId,
        record.branchId ?? undefined,
      );

      const claim = await this.receiptService.claimOrReplay(
        {
          companyId: record.companyId,
          operationId: dto.operationId,
          commandType: OnboardingCommandType.CANCEL_ONBOARDING,
          actorUserId: actor.userId,
          requestPayload: {
            onboardingId: id,
            expectedOnboardingVersion: dto.expectedOnboardingVersion,
            reason: dto.reason,
          },
        },
        keyVersion,
        tx,
      );

      if (claim.isReplay) {
        return this.replayedOnboardingId(claim.safeResultSnapshot);
      }

      if (record.version !== dto.expectedOnboardingVersion) {
        throw new DomainConflictException(
          ONBOARDING_ERROR_CODES.ONBOARDING_STATE_CHANGED,
          'Onboarding version changed.',
        );
      }

      const capabilities = this.capabilityService.calculateOnboardingActions(
        actor,
        { ...record, status: record.statusV2 ?? record.status },
        record.tasks.map((task) => ({
          ...task,
          status: task.statusV2 ?? task.status,
        })),
      );

      if (!capabilities.allowedActions.includes('CANCEL')) {
        throw new NotFoundException();
      }

      const transition = await tx.employeeOnboarding.updateMany({
        where: {
          id,
          version: dto.expectedOnboardingVersion,
          status: TaskStatus.IN_PROGRESS,
        },
        data: {
          status: TaskStatus.CANCELLED,
          statusV2: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledByUserId: actor.userId,
          cancellationReason: dto.reason,
          version: { increment: 1 },
        },
      });

      this.assertOnboardingTransitionWon(transition.count);

      await tx.employeeOnboardingTask.updateMany({
        where: {
          onboardingId: id,
          status: {
            notIn: [
              TaskStatus.COMPLETED,
              TaskStatus.SKIPPED,
              TaskStatus.CANCELLED,
            ],
          },
        },
        data: {
          status: TaskStatus.CANCELLED,
          statusV2: 'CANCELLED',
          version: { increment: 1 },
        },
      });

      await this.receiptService.completeReceipt(
        claim.receiptId!,
        {
          resultEntityType: 'EmployeeOnboarding',
          resultEntityId: id,
          safeResultSnapshot: { onboardingId: id },
        },
        tx,
      );

      return id;
    });

    return this.findOne(user, onboardingId);
  }

  private assertCanManage(
    actor: Awaited<ReturnType<OnboardingActorContextService['resolve']>>,
  ): void {
    if (!hasOnboardingPermission(actor, ONBOARDING_PERMISSIONS.MANAGE)) {
      throw new NotFoundException();
    }
  }

  private replayedOnboardingId(
    snapshot: Record<string, unknown> | undefined,
  ): string {
    const onboardingId = snapshot?.onboardingId;

    if (typeof onboardingId !== 'string' || onboardingId.length === 0) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ONBOARDING_STATE_CHANGED,
        'The completed command receipt has no replayable onboarding result.',
      );
    }

    return onboardingId;
  }

  private assertOnboardingTransitionWon(updatedCount: number): void {
    if (updatedCount === 0) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ONBOARDING_STATE_CHANGED,
        'Onboarding state changed concurrently. Refetch and retry.',
      );
    }
  }

  private async loadEmployee(employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        isActive: true,
        ...this.scopeService.employeeWhere(),
      },
      include: {
        user: { select: { id: true } },
        manager: { include: { user: { select: { id: true } } } },
        branch: { select: { timezone: true } },
      },
    });

    if (!employee) {
      throw new DomainNotFoundException(
        ONBOARDING_ERROR_CODES.EMPLOYEE_NOT_FOUND,
        'Employee not found.',
      );
    }

    return employee;
  }

  private configuredBranchTimezone(
    timezone: string | null | undefined,
  ): string | null {
    const value = timezone?.trim() ?? '';
    return value && isValidIanaTimeZone(value) ? value : null;
  }

  private requireConfiguredBranchTimezone(
    timezone: string | null | undefined,
  ): string {
    const value = this.configuredBranchTimezone(timezone);
    if (value) {
      return value;
    }

    throw new BadRequestException({
      code: ONBOARDING_ERROR_CODES.ONBOARDING_BRANCH_TIMEZONE_REQUIRED,
      message:
        'Configure a valid IANA timezone on the employee branch before starting onboarding.',
    });
  }

  private async snapshotRuntime(
    tx: Prisma.TransactionClient,
    input: {
      employee: {
        id: string;
        companyId: string;
        branchId: string;
        departmentId: string;
        designationId: string | null;
        user: { id: string } | null;
        manager: { user: { id: string } | null } | null;
      };
      templateId: string;
      templateVersionId: string;
      resolutionSource: string;
      startDate: Date;
      remarks?: string;
      startedByUserId: string;
      branchTimeZone: string;
      sourceType: OnboardingSourceType;
      overrideStartReason?: string;
    },
  ) {
    const versionWithTasks = await tx.onboardingTemplateVersion.findUnique({
      where: { id: input.templateVersionId },
      include: {
        departments: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          include: {
            department: true,
            taskGroups: {
              where: { isActive: true },
              orderBy: { displayOrder: 'asc' },
              include: {
                tasks: { orderBy: { sequenceNo: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!versionWithTasks) {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ONBOARDING_START_PRECONDITION_FAILED,
        'Failed to load template version.',
      );
    }

    const templateTasks = versionWithTasks.departments.flatMap((dept) =>
      dept.taskGroups.flatMap((group) =>
        group.tasks.map((task) => ({
          ...task,
          workstreamDepartmentId: dept.departmentId,
          executorDepartmentId:
            task.ownerType === WorkOwnerType.DEPARTMENT
              ? dept.departmentId
              : null,
        })),
      ),
    );

    const onboarding = await tx.employeeOnboarding.create({
      data: {
        companyId: input.employee.companyId,
        branchId: input.employee.branchId,
        branchTimeZoneAtStart: input.branchTimeZone,
        employeeId: input.employee.id,
        departmentIdAtStart: input.employee.departmentId,
        designationIdAtStart: input.employee.designationId,
        templateId: input.templateId,
        templateVersionId: input.templateVersionId,
        templateResolutionSource: input.resolutionSource as never,
        sourceType: input.sourceType,
        status: TaskStatus.IN_PROGRESS,
        statusV2: 'IN_PROGRESS',
        contractVersion: OnboardingContractVersion.V2,
        startDate: input.startDate,
        startedByUserId: input.startedByUserId,
        remarks: input.remarks,
        totalTasks: templateTasks.length,
        overrideStartReason: input.overrideStartReason,
        overrideStartedAt: input.overrideStartReason ? new Date() : undefined,
        overrideStartedByUserId: input.overrideStartReason
          ? input.startedByUserId
          : undefined,
      },
    });

    const sourceToEmployeeTaskId = new Map<string, string>();

    for (const task of templateTasks) {
      const assignedToUserId = this.resolveAssigneeUserId(task, input.employee);
      const dueDate =
        task.dueDays != null
          ? this.addDays(input.startDate, task.dueDays)
          : null;

      const createdTask = await tx.employeeOnboardingTask.create({
        data: {
          onboardingId: onboarding.id,
          companyId: input.employee.companyId,
          branchId: input.employee.branchId,
          employeeId: input.employee.id,
          workstreamDepartmentId: task.workstreamDepartmentId,
          executorDepartmentId: task.executorDepartmentId,
          templateVersionId: input.templateVersionId,
          taskName: task.taskName,
          description: task.description,
          sequenceNo: task.sequenceNo,
          priority: task.priority,
          isMandatory: task.isMandatory,
          allowSkip: task.allowSkip,
          allowReopen: task.allowReopen,
          workType: task.workType,
          ownerType: task.ownerType,
          referenceType: task.referenceType,
          referenceId: task.referenceId,
          sourceTemplateTaskId: task.id,
          assignedDepartmentId: task.executorDepartmentId,
          assignedToUserId,
          dueDate,
          status: TaskStatus.PENDING,
          statusV2: 'PENDING',
          contractVersion: OnboardingContractVersion.V2,
        },
      });

      sourceToEmployeeTaskId.set(task.id, createdTask.id);
    }

    for (const task of templateTasks) {
      if (!task.dependsOnTaskId) {
        continue;
      }

      const employeeTaskId = sourceToEmployeeTaskId.get(task.id);
      const dependsOnEmployeeTaskId = sourceToEmployeeTaskId.get(
        task.dependsOnTaskId,
      );

      if (employeeTaskId && dependsOnEmployeeTaskId) {
        await tx.employeeOnboardingTask.update({
          where: { id: employeeTaskId },
          data: { dependsOnTaskId: dependsOnEmployeeTaskId },
        });
      }
    }

    await this.auditService.log(
      'EmployeeOnboarding',
      onboarding.id,
      'CREATE',
      null,
      { id: onboarding.id, contractVersion: 'V2' },
      { tx },
    );

    return tx.employeeOnboarding.findUniqueOrThrow({
      where: { id: onboarding.id },
      include: onboardingDetailInclude,
    });
  }

  private resolveAssigneeUserId(
    task: {
      ownerType: WorkOwnerType | null;
      assignedEmployeeId?: string | null;
    },
    employee: {
      user: { id: string } | null;
      manager: { user: { id: string } | null } | null;
    },
  ): string | null {
    if (task.ownerType === WorkOwnerType.EMPLOYEE) {
      return employee.user?.id ?? null;
    }

    if (task.ownerType === WorkOwnerType.MANAGER) {
      return employee.manager?.user?.id ?? null;
    }

    return null;
  }

  private addDays(startDate: Date, days: number): Date {
    const dueDate = new Date(startDate);
    dueDate.setUTCDate(dueDate.getUTCDate() + days);
    return dueDate;
  }
}
