/**
 * Inspect and reconcile onboarding template preflight exceptions.
 *
 * Usage:
 *   npx tsx scripts/onboarding-template-reconcile-preflight.ts --inspect
 *   npx tsx scripts/onboarding-template-reconcile-preflight.ts --apply
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Prisma, TemplateVersionStatus } from '@prisma/client';

import { createPrismaClient } from './create-prisma-client';

type PrismaClient = Awaited<ReturnType<typeof createPrismaClient>>['prisma'];

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const versionInclude = {
  scopes: true,
  departments: {
    orderBy: { displayOrder: 'asc' as const },
    include: {
      taskGroups: {
        orderBy: { displayOrder: 'asc' as const },
        include: {
          tasks: {
            orderBy: { sequenceNo: 'asc' as const },
          },
        },
      },
    },
  },
} satisfies Prisma.OnboardingTemplateVersionInclude;

type SourceVersion = Prisma.OnboardingTemplateVersionGetPayload<{
  include: typeof versionInclude;
}>;

async function inspect(prisma: PrismaClient) {
  const sliceMismatch = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      companyId: string | null;
      branchId: string | null;
      departmentId: string;
      versionId: string;
      versionStatus: string;
      versionIsCurrent: boolean;
      templateCompanyId: string;
      depCompanyId: string;
      depBranchId: string;
      depName: string;
    }>
  >(
    `SELECT d.id,
            d."companyId",
            d."branchId",
            d."departmentId",
            d."onboardingTemplateVersionId" AS "versionId",
            v.status AS "versionStatus",
            v."isCurrent" AS "versionIsCurrent",
            t."companyId" AS "templateCompanyId",
            dep."companyId" AS "depCompanyId",
            dep."branchId" AS "depBranchId",
            dep."departmentName" AS "depName"
     FROM "OnboardingDepartmentTemplate" d
     JOIN "OnboardingTemplateVersion" v ON v.id = d."onboardingTemplateVersionId"
     JOIN "OnboardingTemplate" t ON t.id = v."onboardingTemplateId"
     JOIN "departments" dep ON dep.id = d."departmentId"
     WHERE t."companyId" <> dep."companyId"`,
  );

  const nullOwner = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      taskName: string;
      ownerType: string | null;
      versionId: string;
      versionStatus: string;
      versionIsCurrent: boolean;
      templateId: string;
      templateName: string;
    }>
  >(
    `SELECT task.id,
            task."taskName",
            task."ownerType"::text,
            v.id AS "versionId",
            v.status AS "versionStatus",
            v."isCurrent" AS "versionIsCurrent",
            t.id AS "templateId",
            t."templateName"
     FROM "OnboardingTemplateTask" task
     JOIN "OnboardingTemplateVersion" v
       ON v.id = task."onboardingTemplateVersionId"
     JOIN "OnboardingTemplate" t ON t.id = v."onboardingTemplateId"
     WHERE v.status = 'PUBLISHED' AND v."isCurrent" = true
       AND task."ownerType" IS NULL`,
  );

  return { sliceMismatch, nullOwner };
}

async function cloneDraft(
  tx: Prisma.TransactionClient,
  sourceVersion: SourceVersion,
) {
  const latestVersion = await tx.onboardingTemplateVersion.findFirst({
    where: { onboardingTemplateId: sourceVersion.onboardingTemplateId },
    orderBy: { versionNo: 'desc' },
  });
  const nextVersionNo = latestVersion ? latestVersion.versionNo + 1 : 1;
  const root = await tx.onboardingTemplate.findUnique({
    where: { id: sourceVersion.onboardingTemplateId },
    select: { companyId: true },
  });

  const targetVersion = await tx.onboardingTemplateVersion.create({
    data: {
      onboardingTemplateId: sourceVersion.onboardingTemplateId,
      companyId: sourceVersion.companyId ?? root?.companyId ?? null,
      versionNo: nextVersionNo,
      versionName: `Version ${nextVersionNo}`,
      status: TemplateVersionStatus.DRAFT,
      isCurrent: false,
      changeSummary: `Reconciled from version ${sourceVersion.versionNo}`,
      rowVersion: 1,
    },
  });

  for (const scope of sourceVersion.scopes) {
    await tx.onboardingTemplateScope.create({
      data: {
        onboardingTemplateVersionId: targetVersion.id,
        companyId: scope.companyId,
        branchId: scope.branchId,
        departmentId: scope.departmentId,
        designationId: scope.designationId,
        employeeType: scope.employeeType,
        priority: scope.priority,
        isActive: scope.isActive,
        description: scope.description,
      },
    });
  }

  const departmentMap = new Map<string, string>();
  for (const department of sourceVersion.departments) {
    const clonedDepartment = await tx.onboardingDepartmentTemplate.create({
      data: {
        onboardingTemplateVersionId: targetVersion.id,
        departmentId: department.departmentId,
        companyId: department.companyId,
        branchId: department.branchId,
        displayOrder: department.displayOrder,
        isRequired: department.isRequired,
        isActive: department.isActive,
        approvalWorkflowId: null,
        rowVersion: 1,
      },
    });
    departmentMap.set(department.id, clonedDepartment.id);
  }

  const taskGroupMap = new Map<string, string>();
  for (const department of sourceVersion.departments) {
    const targetDepartmentId = departmentMap.get(department.id);
    if (!targetDepartmentId) continue;

    for (const group of department.taskGroups) {
      const clonedGroup = await tx.onboardingTaskGroup.create({
        data: {
          onboardingDepartmentTemplateId: targetDepartmentId,
          companyId: targetVersion.companyId ?? group.companyId,
          onboardingTemplateVersionId: targetVersion.id,
          groupCode: group.groupCode,
          groupName: group.groupName,
          description: group.description,
          displayOrder: group.displayOrder,
          isMandatory: group.isMandatory,
          isActive: group.isActive,
          rowVersion: 1,
        },
      });
      taskGroupMap.set(group.id, clonedGroup.id);
    }
  }

  const taskMap = new Map<string, string>();
  const dependencyMappings: Array<{
    newTaskId: string;
    oldDependsOnTaskId: string | null;
  }> = [];

  for (const department of sourceVersion.departments) {
    for (const group of department.taskGroups) {
      const targetGroupId = taskGroupMap.get(group.id);
      if (!targetGroupId) continue;

      for (const task of group.tasks) {
        const ownerType =
          task.ownerType ??
          (task.workType === 'CHECKLIST' ? 'EMPLOYEE' : 'DEPARTMENT');

        const clonedTask = await tx.onboardingTemplateTask.create({
          data: {
            onboardingTemplateId: targetVersion.onboardingTemplateId,
            onboardingTemplateVersionId: targetVersion.id,
            companyId: targetVersion.companyId ?? task.companyId,
            taskGroupId: targetGroupId,
            taskName: task.taskName,
            description: task.description,
            sequenceNo: task.sequenceNo,
            priority: task.priority,
            isMandatory: task.isMandatory,
            allowSkip: task.allowSkip,
            allowResubmit: task.allowResubmit,
            allowReopen: task.allowReopen,
            autoComplete: false,
            workType: task.workType,
            ownerType,
            referenceType: task.referenceType,
            referenceId: task.referenceId,
            approvalWorkflowId: null,
            assignedDepartmentId:
              ownerType === 'DEPARTMENT' ? department.departmentId : null,
            assignedDesignationId: null,
            assignedEmployeeId: null,
            dueDays: task.dueDays,
            reminderIntervalDays: task.reminderIntervalDays,
            estimatedDurationMinutes: task.estimatedDurationMinutes,
            dependsOnTaskId: null,
            rowVersion: 1,
          },
        });

        taskMap.set(task.id, clonedTask.id);
        dependencyMappings.push({
          newTaskId: clonedTask.id,
          oldDependsOnTaskId: task.dependsOnTaskId,
        });
      }
    }
  }

  for (const mapping of dependencyMappings) {
    if (!mapping.oldDependsOnTaskId) continue;
    const newDependsOnTaskId = taskMap.get(mapping.oldDependsOnTaskId);
    if (!newDependsOnTaskId) continue;

    await tx.onboardingTemplateTask.update({
      where: { id: mapping.newTaskId },
      data: { dependsOnTaskId: newDependsOnTaskId },
    });
  }

  return { targetVersion, taskMap };
}

async function publishDraft(
  tx: Prisma.TransactionClient,
  draftVersionId: string,
  templateId: string,
) {
  await tx.onboardingTemplateVersion.updateMany({
    where: {
      onboardingTemplateId: templateId,
      isCurrent: true,
      NOT: { id: draftVersionId },
    },
    data: {
      isCurrent: false,
      status: TemplateVersionStatus.ARCHIVED,
    },
  });

  await tx.onboardingTemplateVersion.update({
    where: { id: draftVersionId },
    data: {
      status: TemplateVersionStatus.PUBLISHED,
      isCurrent: true,
      publishedAt: new Date(),
      effectiveFrom: new Date(),
      rowVersion: { increment: 1 },
    },
  });
}

async function applyFixes(prisma: PrismaClient) {
  const { sliceMismatch, nullOwner } = await inspect(prisma);
  const actions: string[] = [];

  for (const slice of sliceMismatch) {
    if (slice.versionStatus === 'DRAFT') {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "OnboardingDepartmentTemplate" WHERE id = $1`,
        slice.id,
      );
      actions.push(
        `Removed draft department slice ${slice.id} (${slice.depName}) with foreign-company department.`,
      );
      continue;
    }

    actions.push(
      `Skipped immutable department slice ${slice.id} on ${slice.versionStatus} version ${slice.versionId}. Manual clone/replace required.`,
    );
  }

  for (const task of nullOwner) {
    if (task.versionStatus !== 'PUBLISHED' || !task.versionIsCurrent) {
      await prisma.$executeRawUnsafe(
        `UPDATE "OnboardingTemplateTask" SET "ownerType" = 'EMPLOYEE' WHERE id = $1`,
        task.id,
      );
      actions.push(
        `Set task ${task.id} (${task.taskName}) ownerType=EMPLOYEE on non-current published version.`,
      );
      continue;
    }

    const result = await prisma.$transaction(async (tx) => {
      const sourceVersion = await tx.onboardingTemplateVersion.findUnique({
        where: { id: task.versionId },
        include: versionInclude,
      });
      if (!sourceVersion) {
        throw new Error(`Version ${task.versionId} not found.`);
      }

      const { targetVersion, taskMap } = await cloneDraft(tx, sourceVersion);
      const clonedTaskId = taskMap.get(task.id);
      if (clonedTaskId) {
        await tx.onboardingTemplateTask.update({
          where: { id: clonedTaskId },
          data: { ownerType: 'EMPLOYEE' },
        });
      }

      await publishDraft(
        tx,
        targetVersion.id,
        sourceVersion.onboardingTemplateId,
      );

      return {
        oldVersionId: task.versionId,
        newVersionId: targetVersion.id,
        clonedTaskId,
      };
    });

    actions.push(
      `Cloned published template "${task.templateName}" version ${task.versionId} to draft ${result.newVersionId}, fixed owner on task ${result.clonedTaskId ?? task.id}, and published replacement.`,
    );
  }

  return actions;
}

async function main() {
  const { prisma, disconnect } = await createPrismaClient();
  try {
    const report = await inspect(prisma);
    const reportPath = resolve(
      process.cwd(),
      'onboarding-template-reconcile-report.json',
    );
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    if (hasFlag('apply')) {
      const actions = await applyFixes(prisma);
      console.log(
        JSON.stringify({ applied: true, actions, reportPath }, null, 2),
      );
      return;
    }

    console.log(
      JSON.stringify({ inspectOnly: true, report, reportPath }, null, 2),
    );
  } finally {
    await disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
