import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ONBOARDING_TEMPLATE_ERROR_CODES } from '../../onboarding-template/constants';
import { OnboardingTemplateScopeService } from '../../onboarding-template/services/onboarding-template-scope.service';

import { CreateTaskContributionDto, UpdateTaskContributionDto } from '../dto';

import { TaskContributionValidationService } from './task-contribution-validation.service';

const TASK_CONTRIBUTION_INCLUDE = {
  contribution: true,
  task: {
    select: {
      taskGroup: {
        select: {
          onboardingDepartmentTemplateId: true,
        },
      },
    },
  },
} satisfies Prisma.TaskContributionInclude;

type TaskContributionRecord = Prisma.TaskContributionGetPayload<{
  include: typeof TASK_CONTRIBUTION_INCLUDE;
}>;

type TaskTemplateContext = {
  taskGroup: {
    onboardingDepartmentTemplateId: string;
    departmentTemplate: {
      onboardingTemplateVersionId: string;
    };
  } | null;
};

type ContributionTemplateContext = {
  onboardingDepartmentTemplateId: string;
  departmentTemplate: {
    onboardingTemplateVersionId: string;
  };
};

/**
 * Links a template task to a contribution belonging to the same department
 * template. The relationship has no company column of its own, so every read
 * and mutation must traverse both parents through the authoritative template
 * scope. This prevents a direct ID from bypassing tenant containment.
 */
@Injectable()
export class TaskContributionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: TaskContributionValidationService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async create(dto: CreateTaskContributionDto) {
    const task = await this.validation.ensureTaskExists(dto.taskId);
    const contribution = await this.validation.ensureContributionExists(
      dto.contributionId,
    );
    const context = this.assertMatchingTemplateContext(task, contribution);
    const version = await this.templateScope.requireMutableVersion(
      context.versionId,
    );

    await this.validation.ensureUniqueTaskContribution(
      dto.taskId,
      dto.contributionId,
    );

    return this.prisma.$transaction(async (tx) => {
      await this.templateScope.lockMutableVersion(tx, version.id);

      return tx.taskContribution.create({
        data: {
          taskId: dto.taskId,
          contributionId: dto.contributionId,
          displayOrder: dto.displayOrder ?? 0,
          isRequired: dto.isRequired ?? true,
        },
        include: {
          contribution: true,
        },
      });
    });
  }

  async findAll() {
    await this.templateScope.assertEnabledForCurrentContext();

    const rows = await this.prisma.taskContribution.findMany({
      where: this.scopedWhere(),
      include: TASK_CONTRIBUTION_INCLUDE,
      orderBy: [
        {
          taskId: 'asc',
        },
        {
          displayOrder: 'asc',
        },
      ],
    });

    return rows.map((row) => this.toResponse(row));
  }

  async findOne(id: string) {
    return this.toResponse(await this.requireScopedTaskContribution(id));
  }

  async findByTask(taskId: string) {
    const task = await this.validation.ensureTaskExists(taskId);
    const taskDepartmentTemplateId = this.requireTaskDepartmentTemplateId(task);

    const rows = await this.prisma.taskContribution.findMany({
      where: {
        taskId,
        ...this.scopedWhere(),
      },
      include: TASK_CONTRIBUTION_INCLUDE,
      orderBy: {
        displayOrder: 'asc',
      },
    });

    return rows.map((row) => {
      const response = this.toResponse(row);

      if (
        row.task.taskGroup?.onboardingDepartmentTemplateId !==
        taskDepartmentTemplateId
      ) {
        this.throwContextMismatch();
      }

      return response;
    });
  }

  async update(id: string, dto: UpdateTaskContributionDto) {
    const existing = await this.requireScopedTaskContribution(id);
    const version = await this.requireMutableVersionFor(existing);

    await this.prisma.$transaction(async (tx) => {
      await this.templateScope.lockMutableVersion(tx, version.id);

      const result = await tx.taskContribution.updateMany({
        where: {
          id,
          ...this.scopedWhere(),
        },
        data: {
          displayOrder: dto.displayOrder,
          isRequired: dto.isRequired,
        },
      });
      this.templateScope.assertMutationApplied(result.count);
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.requireScopedTaskContribution(id);
    const version = await this.requireMutableVersionFor(existing);

    await this.prisma.$transaction(async (tx) => {
      await this.templateScope.lockMutableVersion(tx, version.id);

      const result = await tx.taskContribution.deleteMany({
        where: {
          id,
          ...this.scopedWhere(),
        },
      });
      this.templateScope.assertMutationApplied(result.count);
    });

    return this.toResponse(existing);
  }

  private scopedWhere(): Prisma.TaskContributionWhereInput {
    return {
      task: this.templateScope.taskWhere(),
      contribution: this.templateScope.contributionWhere(),
    };
  }

  private async requireScopedTaskContribution(id: string) {
    const record = await this.prisma.taskContribution.findFirst({
      where: {
        id,
        ...this.scopedWhere(),
      },
      include: TASK_CONTRIBUTION_INCLUDE,
    });

    if (!record) {
      throw new DomainNotFoundException(
        ONBOARDING_TEMPLATE_ERROR_CODES.ONBOARDING_TASK_CONTRIBUTION_NOT_FOUND,
        'Task contribution not found.',
      );
    }

    this.assertPersistedLinkContext(record);
    await this.requireMutableContext(record);

    return record;
  }

  private async requireMutableVersionFor(record: TaskContributionRecord) {
    const context = await this.requireMutableContext(record);
    return this.templateScope.requireMutableVersion(context.versionId);
  }

  private async requireMutableContext(record: TaskContributionRecord) {
    const [task, contribution] = await Promise.all([
      this.validation.ensureTaskExists(record.taskId),
      this.validation.ensureContributionExists(record.contributionId),
    ]);

    return this.assertMatchingTemplateContext(task, contribution);
  }

  private assertMatchingTemplateContext(
    task: TaskTemplateContext,
    contribution: ContributionTemplateContext,
  ): { versionId: string } {
    const taskGroup = task.taskGroup;

    if (
      !taskGroup ||
      taskGroup.onboardingDepartmentTemplateId !==
        contribution.onboardingDepartmentTemplateId ||
      taskGroup.departmentTemplate.onboardingTemplateVersionId !==
        contribution.departmentTemplate.onboardingTemplateVersionId
    ) {
      this.throwContextMismatch();
    }

    return {
      versionId: taskGroup.departmentTemplate.onboardingTemplateVersionId,
    };
  }

  private assertPersistedLinkContext(record: TaskContributionRecord) {
    const taskGroup = record.task.taskGroup;

    if (
      !taskGroup ||
      taskGroup.onboardingDepartmentTemplateId !==
        record.contribution.onboardingDepartmentTemplateId
    ) {
      this.throwContextMismatch();
    }
  }

  private requireTaskDepartmentTemplateId(task: TaskTemplateContext): string {
    const departmentTemplateId = task.taskGroup?.onboardingDepartmentTemplateId;

    if (!departmentTemplateId) {
      this.throwContextMismatch();
    }

    return departmentTemplateId;
  }

  private toResponse(record: TaskContributionRecord) {
    this.assertPersistedLinkContext(record);

    return {
      id: record.id,
      taskId: record.taskId,
      contributionId: record.contributionId,
      displayOrder: record.displayOrder,
      isRequired: record.isRequired,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      contribution: record.contribution,
    };
  }

  private throwContextMismatch(): never {
    throw new DomainConflictException(
      ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_CONTRIBUTION_CONTEXT_MISMATCH,
      'Task and contribution must belong to the same onboarding department template version.',
    );
  }
}
