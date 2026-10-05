import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateExecutionRuleDto } from '../dto/create-execution-rule.dto';
import { UpdateExecutionRuleDto } from '../dto/update-execution-rule.dto';
import { OnboardingExecutionRuleValidationService } from './onboarding-execution-rule-validation.service';
import { OnboardingTemplateScopeService } from '../../onboarding-template/services/onboarding-template-scope.service';

@Injectable()
export class OnboardingExecutionRuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly validation: OnboardingExecutionRuleValidationService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async create(dto: CreateExecutionRuleDto) {
    const profile = await this.validation.validateExecutionProfile(
      dto.executionProfileId,
    );
    await this.validation.ensureUniqueSequence(
      dto.executionProfileId,
      dto.sequenceNo,
    );
    await this.validation.validateApprovalWorkflow(
      dto.approvalWorkflowId,
      this.templateScope.resolveExecutionProfileCompanyId(profile),
    );

    const rule = await this.prisma.executionRule.create({
      data: {
        executionProfileId: dto.executionProfileId,
        sequenceNo: dto.sequenceNo,
        ownerType: dto.ownerType,
        executionType: dto.executionType,
        action: dto.action,
        workType: dto.workType,
        approvalWorkflowId: dto.approvalWorkflowId,
        dueDays: dto.dueDays,
        reminderIntervalDays: dto.reminderIntervalDays,
        estimatedDurationMinutes: dto.estimatedDurationMinutes,
        conditionExpression: dto.conditionExpression,
        autoComplete: dto.autoComplete ?? false,
        allowReopen: dto.allowReopen ?? true,
        isActive: dto.isActive ?? true,
      },
      include: {
        executionProfile: {
          include: {
            contribution: {
              include: {
                departmentTemplate: {
                  include: {
                    department: true,
                    version: {
                      include: { onboardingTemplate: true },
                    },
                  },
                },
              },
            },
          },
        },
        approvalWorkflow: true,
      },
    });

    await this.auditService.log('ExecutionRule', rule.id, 'CREATE', null, rule);
    return rule;
  }

  async findAll() {
    await this.templateScope.assertEnabledForCurrentContext();

    return this.prisma.executionRule.findMany({
      where: { isActive: true, ...this.templateScope.executionRuleWhere() },
      include: {
        executionProfile: {
          include: {
            contribution: {
              include: {
                departmentTemplate: {
                  include: {
                    department: true,
                    version: {
                      include: { onboardingTemplate: true },
                    },
                  },
                },
              },
            },
          },
        },
        approvalWorkflow: true,
      },
      orderBy: [{ sequenceNo: 'asc' }],
    });
  }

  async findOne(id: string) {
    await this.validation.ensureExecutionRuleExists(id);

    return this.prisma.executionRule.findFirst({
      where: { id, ...this.templateScope.executionRuleWhere() },
      include: {
        executionProfile: {
          include: {
            contribution: {
              include: {
                departmentTemplate: {
                  include: {
                    department: true,
                    version: {
                      include: { onboardingTemplate: true },
                    },
                  },
                },
              },
            },
          },
        },
        approvalWorkflow: true,
      },
    });
  }

  async findByExecutionProfile(executionProfileId: string) {
    await this.validation.validateExecutionProfile(executionProfileId);

    return this.prisma.executionRule.findMany({
      where: {
        executionProfileId,
        isActive: true,
        ...this.templateScope.executionRuleWhere(),
      },
      orderBy: { sequenceNo: 'asc' },
    });
  }

  async update(id: string, dto: UpdateExecutionRuleDto) {
    const existing = await this.validation.ensureExecutionRuleExists(id);
    const executionProfileId =
      dto.executionProfileId ?? existing.executionProfileId;

    const targetProfile =
      await this.validation.validateExecutionProfile(executionProfileId);

    if (
      this.templateScope.resolveDepartmentTemplateCompanyId(
        existing.executionProfile.contribution.departmentTemplate,
      ) !==
      this.templateScope.resolveDepartmentTemplateCompanyId(
        targetProfile.contribution.departmentTemplate,
      )
    ) {
      throw new ConflictException(
        'An execution rule cannot be moved to a different Company.',
      );
    }

    if (dto.sequenceNo !== undefined) {
      await this.validation.ensureUniqueSequence(
        executionProfileId,
        dto.sequenceNo,
        id,
      );
    }

    await this.validation.validateApprovalWorkflow(
      dto.approvalWorkflowId ?? existing.approvalWorkflowId,
      this.templateScope.resolveExecutionProfileCompanyId(targetProfile),
    );

    const updated = await this.prisma.executionRule.update({
      where: { id },
      data: {
        executionProfileId,
        sequenceNo: dto.sequenceNo ?? existing.sequenceNo,
        ownerType: dto.ownerType ?? existing.ownerType,
        executionType: dto.executionType ?? existing.executionType,
        action: dto.action ?? existing.action,
        workType: dto.workType ?? existing.workType,
        approvalWorkflowId:
          dto.approvalWorkflowId ?? existing.approvalWorkflowId,
        dueDays: dto.dueDays ?? existing.dueDays,
        reminderIntervalDays:
          dto.reminderIntervalDays ?? existing.reminderIntervalDays,
        estimatedDurationMinutes:
          dto.estimatedDurationMinutes ?? existing.estimatedDurationMinutes,
        conditionExpression:
          dto.conditionExpression ?? existing.conditionExpression,
        autoComplete: dto.autoComplete ?? existing.autoComplete,
        allowReopen: dto.allowReopen ?? existing.allowReopen,
        isActive: dto.isActive ?? existing.isActive,
      },
      include: {
        executionProfile: {
          include: {
            contribution: {
              include: {
                departmentTemplate: {
                  include: {
                    department: true,
                    version: {
                      include: { onboardingTemplate: true },
                    },
                  },
                },
              },
            },
          },
        },
        approvalWorkflow: true,
      },
    });

    await this.auditService.log(
      'ExecutionRule',
      updated.id,
      'UPDATE',
      existing,
      updated,
    );
    return updated;
  }

  async remove(id: string) {
    const existing = await this.validation.ensureExecutionRuleExists(id);

    const deleted = await this.prisma.executionRule.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.log(
      'ExecutionRule',
      id,
      'DELETE',
      existing,
      deleted,
    );
    return deleted;
  }
}
