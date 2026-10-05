import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { DomainConflictException } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { PROJECTS_ERROR_CODES } from '../projects/constants/projects-error-codes';

@Injectable()
export class ApprovalService {
  constructor(private prisma: PrismaService) {}

  private rejectLegacyWorkLogApproval(entityType: string): void {
    if (entityType === 'WORK_LOG_HEADER') {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_LEGACY_APPROVAL_DISABLED,
        'Work-log approvals must use /team/timesheets. The deprecated generic approval path is disabled for timesheets.',
      );
    }
  }

  async approve(transactionStepId: string) {
    const step = await this.prisma.approvalTransactionStep.findUnique({
      where: {
        id: transactionStepId,
      },
      include: {
        transaction: true,
      },
    });

    if (!step) {
      throw new NotFoundException('Approval step not found');
    }

    this.rejectLegacyWorkLogApproval(step.transaction.entityType);

    if (step.status !== 'PENDING') {
      throw new ConflictException('Approval step already processed');
    }

    const currentPendingStep =
      await this.prisma.approvalTransactionStep.findFirst({
        where: {
          transactionId: step.transactionId,
          status: 'PENDING',
        },
        orderBy: {
          stepNo: 'asc',
        },
      });

    if (!currentPendingStep || currentPendingStep.id !== transactionStepId) {
      throw new ConflictException('Previous approval step is pending');
    }

    await this.prisma.approvalTransactionStep.update({
      where: {
        id: transactionStepId,
      },
      data: {
        status: 'APPROVED',
        action: 'APPROVED',
        actionDate: new Date(),
      },
    });

    const nextStep = await this.prisma.approvalTransactionStep.findFirst({
      where: {
        transactionId: step.transactionId,
        stepNo: {
          gt: step.stepNo,
        },
      },
      orderBy: {
        stepNo: 'asc',
      },
    });

    if (nextStep) {
      await this.prisma.approvalTransaction.update({
        where: {
          id: step.transactionId,
        },
        data: {
          currentStep: nextStep.stepNo,
        },
      });

      return {
        message: 'Step approved. Moved to next approver.',
      };
    }

    const transaction = await this.prisma.approvalTransaction.update({
      where: {
        id: step.transactionId,
      },
      data: {
        status: 'APPROVED',
      },
    });

    return {
      message: 'Workflow fully approved',
      transactionId: transaction.id,
    };
  }

  async reject(transactionStepId: string, remarks?: string) {
    const step = await this.prisma.approvalTransactionStep.findUnique({
      where: {
        id: transactionStepId,
      },
      include: {
        transaction: true,
      },
    });

    if (!step) {
      throw new NotFoundException('Approval step not found');
    }

    this.rejectLegacyWorkLogApproval(step.transaction.entityType);

    if (step.status !== 'PENDING') {
      throw new ConflictException('Approval step already processed');
    }

    const currentPendingStep =
      await this.prisma.approvalTransactionStep.findFirst({
        where: {
          transactionId: step.transactionId,
          status: 'PENDING',
        },
        orderBy: {
          stepNo: 'asc',
        },
      });

    if (!currentPendingStep || currentPendingStep.id !== transactionStepId) {
      throw new ConflictException('Previous approval step is pending');
    }

    await this.prisma.approvalTransactionStep.update({
      where: {
        id: transactionStepId,
      },
      data: {
        status: 'REJECTED',
        action: 'REJECTED',
        remarks,
        actionDate: new Date(),
      },
    });

    await this.prisma.approvalTransaction.update({
      where: {
        id: step.transactionId,
      },
      data: {
        status: 'REJECTED',
      },
    });

    return {
      message: 'Workflow rejected',
    };
  }

  async getPendingApprovals(approverId: string) {
    const steps = await this.prisma.approvalTransactionStep.findMany({
      where: {
        approverId,
        status: 'PENDING',

        transaction: {
          status: 'PENDING',
        },
      },

      include: {
        transaction: true,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    const pendingSteps = steps.filter(
      (step) => step.stepNo === step.transaction.currentStep,
    );

    return {
      success: true,
      data: pendingSteps,
    };
  }

  async getApprovalDetails(transactionId: string) {
    const transaction = await this.prisma.approvalTransaction.findUnique({
      where: {
        id: transactionId,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Approval transaction not found');
    }

    if (transaction.entityType !== 'WORK_LOG_HEADER') {
      return {
        success: true,
        data: transaction,
      };
    }

    const timesheet = await this.prisma.workLogHeader.findUnique({
      where: {
        id: transaction.entityId,
      },
      include: {
        employee: true,
        lines: {
          include: {
            task: true,
            workCategory: true,
            taskWorkSession: true,
          },
          orderBy: {
            workDate: 'asc',
          },
        },
      },
    });

    return {
      success: true,
      data: {
        transaction,
        timesheet,
      },
    };
  }

  async getApprovalHistory(entityType: string, entityId: string) {
    const transaction = await this.prisma.approvalTransaction.findFirst({
      where: {
        entityType,
        entityId,
      },
      include: {
        approvalSteps: {
          include: {
            approver: true,
          },
          orderBy: {
            stepNo: 'asc',
          },
        },
      },
    });

    return {
      success: true,
      data: transaction,
    };
  }
}
