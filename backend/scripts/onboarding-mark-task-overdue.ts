/**
 * Mark one exact assigned onboarding task as overdue in the guarded staging
 * schema so the reminder job can enqueue an in-app notification.
 *
 * From backend/:
 *   pnpm exec tsx scripts/onboarding-mark-task-overdue.ts
 *
 * Required:
 *   TASK_ID=<uuid>
 */
import {
  assertQaStagingSentinel,
  assertQaWriteEnvironment,
  requiredEnv,
} from './assert-destructive-db-guard';
import { createPrismaClient } from './create-prisma-client';

async function main() {
  const target = assertQaWriteEnvironment('onboarding-mark-task-overdue');
  const taskId = requiredEnv('TASK_ID');
  const databaseClient = await createPrismaClient();
  const { prisma } = databaseClient;

  try {
    await assertQaStagingSentinel(
      prisma,
      'onboarding-mark-task-overdue',
      target,
    );
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(12, 0, 0, 0);

    const task = await prisma.employeeOnboardingTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        taskName: true,
        status: true,
        assignedToUserId: true,
        dueDate: true,
        onboardingId: true,
        updatedAt: true,
      },
    });

    if (!task) {
      throw new Error(`Onboarding task ${taskId} was not found.`);
    }

    if (task.status !== 'PENDING' && task.status !== 'IN_PROGRESS') {
      throw new Error(
        `Task ${task.id} must be PENDING or IN_PROGRESS; current status is ${task.status}.`,
      );
    }

    if (!task.assignedToUserId) {
      throw new Error(
        `Task ${task.id} (${task.taskName}) has no assignee. Assign it first.`,
      );
    }

    const update = await prisma.employeeOnboardingTask.updateMany({
      where: { id: task.id, updatedAt: task.updatedAt },
      data: { dueDate: yesterday },
    });
    if (update.count !== 1) {
      throw new Error(
        `Task ${task.id} changed after it was read; no overdue mutation was applied.`,
      );
    }

    const assignee = await prisma.user.findUnique({
      where: { id: task.assignedToUserId },
      select: { email: true, displayName: true },
    });

    console.log('Marked task overdue for ONB-008 reminder test:');
    console.log(`  taskId:      ${task.id}`);
    console.log(`  taskName:    ${task.taskName}`);
    console.log(`  onboarding:  ${task.onboardingId}`);
    console.log(`  assignee:    ${assignee?.email ?? task.assignedToUserId}`);
    console.log(`  dueDate:     ${yesterday.toISOString()}`);
  } finally {
    await databaseClient.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
