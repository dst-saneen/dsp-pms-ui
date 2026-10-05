import { Injectable } from '@nestjs/common';
import { Prisma, TemplateVersionStatus } from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';
import { OnboardingFeatureGateService } from '../../onboarding-runtime/services/onboarding-feature-gate.service';

import { ONBOARDING_TEMPLATE_ERROR_CODES } from '../constants';

const VERSION_INCLUDE = {
  onboardingTemplate: {
    select: {
      id: true,
      companyId: true,
      isActive: true,
    },
  },
} satisfies Prisma.OnboardingTemplateVersionInclude;

const DEPARTMENT_TEMPLATE_INCLUDE = {
  department: true,
  version: {
    include: VERSION_INCLUDE,
  },
} satisfies Prisma.OnboardingDepartmentTemplateInclude;

const TASK_GROUP_INCLUDE = {
  departmentTemplate: {
    include: DEPARTMENT_TEMPLATE_INCLUDE,
  },
} satisfies Prisma.OnboardingTaskGroupInclude;

const TASK_INCLUDE = {
  taskGroup: {
    include: TASK_GROUP_INCLUDE,
  },
} satisfies Prisma.OnboardingTemplateTaskInclude;

type VersionRecord = Prisma.OnboardingTemplateVersionGetPayload<{
  include: typeof VERSION_INCLUDE;
}>;

type DepartmentTemplateRecord = Prisma.OnboardingDepartmentTemplateGetPayload<{
  include: typeof DEPARTMENT_TEMPLATE_INCLUDE;
}>;

type TaskGroupRecord = Prisma.OnboardingTaskGroupGetPayload<{
  include: typeof TASK_GROUP_INCLUDE;
}>;

type TaskRecord = Prisma.OnboardingTemplateTaskGetPayload<{
  include: typeof TASK_INCLUDE;
}>;

const CONTRIBUTION_INCLUDE = {
  departmentTemplate: {
    include: DEPARTMENT_TEMPLATE_INCLUDE,
  },
} satisfies Prisma.ContributionInclude;

const REQUIREMENT_INCLUDE = {
  contribution: {
    include: CONTRIBUTION_INCLUDE,
  },
} satisfies Prisma.RequirementInclude;

const EXECUTION_PROFILE_INCLUDE = {
  contribution: {
    include: CONTRIBUTION_INCLUDE,
  },
} satisfies Prisma.ExecutionProfileInclude;

const EXECUTION_RULE_INCLUDE = {
  executionProfile: {
    include: EXECUTION_PROFILE_INCLUDE,
  },
} satisfies Prisma.ExecutionRuleInclude;

type ContributionRecord = Prisma.ContributionGetPayload<{
  include: typeof CONTRIBUTION_INCLUDE;
}>;

type RequirementRecord = Prisma.RequirementGetPayload<{
  include: typeof REQUIREMENT_INCLUDE;
}>;

type ExecutionProfileRecord = Prisma.ExecutionProfileGetPayload<{
  include: typeof EXECUTION_PROFILE_INCLUDE;
}>;

type ExecutionRuleRecord = Prisma.ExecutionRuleGetPayload<{
  include: typeof EXECUTION_RULE_INCLUDE;
}>;

/**
 * Single tenant-containment predicate for the Template aggregate.
 * Every nested query/command must traverse to OnboardingTemplate.companyId
 * and the actor's server-resolved organization scope.
 */
@Injectable()
export class OnboardingTemplateScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeScope: EmployeeDomainScopeService,
    private readonly featureGate: OnboardingFeatureGateService,
  ) {}

  /** Collection routes are always bound to the selected Company. */
  assertEnabledForCurrentContext(): Promise<void> {
    return this.featureGate.assertEnabledForContext();
  }

  assertEnabledForCompany(companyId: string | null | undefined): Promise<void> {
    return this.featureGate.assertEnabledForContext(companyId ?? undefined);
  }

  templateWhere(): Prisma.OnboardingTemplateWhereInput {
    return this.employeeScope.onboardingTemplateWhere();
  }

  versionWhere(): Prisma.OnboardingTemplateVersionWhereInput {
    return {
      onboardingTemplate: this.templateWhere(),
    };
  }

  departmentTemplateWhere(): Prisma.OnboardingDepartmentTemplateWhereInput {
    return {
      version: this.versionWhere(),
    };
  }

  taskGroupWhere(): Prisma.OnboardingTaskGroupWhereInput {
    return {
      departmentTemplate: this.departmentTemplateWhere(),
    };
  }

  taskWhere(): Prisma.OnboardingTemplateTaskWhereInput {
    return {
      taskGroup: this.taskGroupWhere(),
    };
  }

  contributionWhere(): Prisma.ContributionWhereInput {
    return {
      departmentTemplate: this.departmentTemplateWhere(),
    };
  }

  requirementWhere(): Prisma.RequirementWhereInput {
    return {
      contribution: this.contributionWhere(),
    };
  }

  executionProfileWhere(): Prisma.ExecutionProfileWhereInput {
    return {
      contribution: this.contributionWhere(),
    };
  }

  executionRuleWhere(): Prisma.ExecutionRuleWhereInput {
    return {
      executionProfile: this.executionProfileWhere(),
    };
  }

  async requireTemplate(templateId: string) {
    const template = await this.prisma.onboardingTemplate.findFirst({
      where: {
        id: templateId,
        ...this.templateWhere(),
      },
    });

    if (!template) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_FOUND,
        'Onboarding template not found.',
      );
    }

    await this.assertEnabledForCompany(template.companyId);

    return template;
  }

  async requireVersion(versionId: string): Promise<VersionRecord> {
    const version = await this.prisma.onboardingTemplateVersion.findFirst({
      where: {
        id: versionId,
        ...this.versionWhere(),
      },
      include: VERSION_INCLUDE,
    });

    if (!version) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_TEMPLATE_VERSION_NOT_FOUND,
        'Template version not found.',
      );
    }

    await this.assertEnabledForCompany(this.resolveVersionCompanyId(version));

    return version;
  }

  async requireDepartmentTemplate(
    id: string,
  ): Promise<DepartmentTemplateRecord> {
    const slice = await this.prisma.onboardingDepartmentTemplate.findFirst({
      where: {
        id,
        ...this.departmentTemplateWhere(),
      },
      include: DEPARTMENT_TEMPLATE_INCLUDE,
    });

    if (!slice) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_DEPARTMENT_TEMPLATE_NOT_FOUND,
        'Department template not found.',
      );
    }

    await this.assertEnabledForCompany(
      this.resolveDepartmentTemplateCompanyId(slice),
    );

    return slice;
  }

  async requireTaskGroup(id: string): Promise<TaskGroupRecord> {
    const group = await this.prisma.onboardingTaskGroup.findFirst({
      where: {
        id,
        ...this.taskGroupWhere(),
      },
      include: TASK_GROUP_INCLUDE,
    });

    if (!group) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_TASK_GROUP_NOT_FOUND,
        'Task group not found.',
      );
    }

    await this.assertEnabledForCompany(this.resolveTaskGroupCompanyId(group));

    return group;
  }

  async requireTask(id: string): Promise<TaskRecord> {
    const task = await this.prisma.onboardingTemplateTask.findFirst({
      where: {
        id,
        ...this.taskWhere(),
      },
      include: TASK_INCLUDE,
    });

    if (!task) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_TEMPLATE_TASK_NOT_FOUND,
        'Task not found.',
      );
    }

    await this.assertEnabledForCompany(this.resolveTaskCompanyId(task));

    return task;
  }

  async requireContribution(id: string): Promise<ContributionRecord> {
    const contribution = await this.prisma.contribution.findFirst({
      where: {
        id,
        ...this.contributionWhere(),
      },
      include: CONTRIBUTION_INCLUDE,
    });

    if (!contribution) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_DEPARTMENT_TEMPLATE_NOT_FOUND,
        'Onboarding contribution not found.',
      );
    }

    await this.assertEnabledForCompany(
      this.resolveDepartmentTemplateCompanyId(contribution.departmentTemplate),
    );
    return contribution;
  }

  async requireRequirement(id: string): Promise<RequirementRecord> {
    const requirement = await this.prisma.requirement.findFirst({
      where: {
        id,
        ...this.requirementWhere(),
      },
      include: REQUIREMENT_INCLUDE,
    });

    if (!requirement) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_DEPARTMENT_TEMPLATE_NOT_FOUND,
        'Onboarding requirement not found.',
      );
    }

    await this.assertEnabledForCompany(
      this.resolveDepartmentTemplateCompanyId(
        requirement.contribution.departmentTemplate,
      ),
    );
    return requirement;
  }

  async requireExecutionProfile(id: string): Promise<ExecutionProfileRecord> {
    const profile = await this.prisma.executionProfile.findFirst({
      where: {
        id,
        ...this.executionProfileWhere(),
      },
      include: EXECUTION_PROFILE_INCLUDE,
    });

    if (!profile) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_DEPARTMENT_TEMPLATE_NOT_FOUND,
        'Onboarding execution profile not found.',
      );
    }

    await this.assertEnabledForCompany(
      this.resolveDepartmentTemplateCompanyId(
        profile.contribution.departmentTemplate,
      ),
    );
    return profile;
  }

  async requireExecutionRule(id: string): Promise<ExecutionRuleRecord> {
    const rule = await this.prisma.executionRule.findFirst({
      where: {
        id,
        ...this.executionRuleWhere(),
      },
      include: EXECUTION_RULE_INCLUDE,
    });

    if (!rule) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_DEPARTMENT_TEMPLATE_NOT_FOUND,
        'Onboarding execution rule not found.',
      );
    }

    await this.assertEnabledForCompany(
      this.resolveDepartmentTemplateCompanyId(
        rule.executionProfile.contribution.departmentTemplate,
      ),
    );
    return rule;
  }

  async requireApprovalWorkflow(approvalWorkflowId: string, companyId: string) {
    const workflow = await this.prisma.approvalWorkflow.findFirst({
      where: {
        id: approvalWorkflowId,
        OR: [{ companyId: null }, { companyId }],
      },
    });

    if (!workflow) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_TEMPLATE_NOT_FOUND,
        'Approval workflow not found for this Company.',
      );
    }

    return workflow;
  }

  async requireMutableVersion(versionId: string): Promise<VersionRecord> {
    const version = await this.requireVersion(versionId);

    if (version.status !== TemplateVersionStatus.DRAFT) {
      throw new DomainConflictException(
        ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_VERSION_STATE_CHANGED,
        'Published and archived versions are immutable.',
      );
    }

    return version;
  }

  async lockMutableVersion(
    tx: Prisma.TransactionClient,
    versionId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<
      Array<{ id: string; status: TemplateVersionStatus }>
    >(Prisma.sql`
      SELECT id, status
      FROM "OnboardingTemplateVersion"
      WHERE id = ${versionId}
      FOR UPDATE
    `);
    const version = rows[0];

    if (!version || version.status !== TemplateVersionStatus.DRAFT) {
      throw new DomainConflictException(
        ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_VERSION_STATE_CHANGED,
        'Published and archived versions are immutable.',
      );
    }
  }

  assertRowVersion(actual: number, expected?: number) {
    if (expected !== undefined && expected !== actual) {
      throw new DomainConflictException(
        ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_VERSION_STATE_CHANGED,
        'The template version changed. Review the latest data and retry.',
      );
    }
  }

  assertMutationApplied(count: number) {
    if (count !== 1) {
      throw new DomainConflictException(
        ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_VERSION_STATE_CHANGED,
        'The template data changed. Review the latest data and retry.',
      );
    }
  }

  async requireDepartmentInCompanyBranch(input: {
    companyId: string;
    branchId: string;
    departmentId: string;
  }) {
    const department = await this.prisma.department.findFirst({
      where: {
        id: input.departmentId,
        companyId: input.companyId,
        branchId: input.branchId,
        ...this.employeeScope.departmentWhere(),
      },
    });

    if (!department) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.DEPARTMENT_NOT_FOUND,
        'Department not found.',
      );
    }

    return department;
  }

  async requireDepartmentInCompany(input: {
    companyId: string;
    departmentId: string;
  }) {
    const department = await this.prisma.department.findFirst({
      where: {
        id: input.departmentId,
        companyId: input.companyId,
        ...this.employeeScope.departmentWhere(),
      },
    });

    if (!department) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.DEPARTMENT_NOT_FOUND,
        'Department not found.',
      );
    }

    return department;
  }

  resolveVersionCompanyId(version: VersionRecord): string {
    return version.companyId ?? version.onboardingTemplate.companyId;
  }

  resolveDepartmentTemplateCompanyId(
    departmentTemplate: DepartmentTemplateRecord,
  ): string {
    return (
      departmentTemplate.companyId ??
      departmentTemplate.version.companyId ??
      departmentTemplate.version.onboardingTemplate.companyId
    );
  }

  resolveContributionCompanyId(contribution: ContributionRecord): string {
    return this.resolveDepartmentTemplateCompanyId(
      contribution.departmentTemplate,
    );
  }

  resolveExecutionProfileCompanyId(profile: ExecutionProfileRecord): string {
    return this.resolveContributionCompanyId(profile.contribution);
  }

  resolveExecutionRuleCompanyId(rule: ExecutionRuleRecord): string {
    return this.resolveExecutionProfileCompanyId(rule.executionProfile);
  }

  private resolveTaskGroupCompanyId(taskGroup: TaskGroupRecord): string {
    return (
      taskGroup.companyId ??
      this.resolveDepartmentTemplateCompanyId(taskGroup.departmentTemplate)
    );
  }

  private resolveTaskCompanyId(task: TaskRecord): string {
    const taskGroup = task.taskGroup;
    if (!taskGroup) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_TASK_GROUP_NOT_FOUND,
        'Task group not found.',
      );
    }

    return task.companyId ?? this.resolveTaskGroupCompanyId(taskGroup);
  }
}
