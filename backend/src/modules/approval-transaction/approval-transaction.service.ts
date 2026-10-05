import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import { CreateApprovalTransactionDto } from './dto/create-approval-transaction.dto';

import { ForbiddenException } from '@nestjs/common';

import { ApproveTransactionDto } from './dto/approve-transaction.dto';

import { RejectTransactionDto } from './dto/reject-transaction.dto';

@Injectable()
export class ApprovalTransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateApprovalTransactionDto) {
    const transaction = await this.prisma.approvalTransaction.create({
      data: dto,
    });

    await this.auditService.log(
      'ApprovalTransaction',
      transaction.id,
      'CREATE',
      null,
      transaction,
    );

    return transaction;
  }

  async findAll() {
    return this.prisma.approvalTransaction.findMany({
      include: {
        workflow: true,
        requestedBy: true,
        approvalSteps: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const transaction = await this.prisma.approvalTransaction.findUnique({
      where: { id },
      include: {
        workflow: true,
        requestedBy: true,
        approvalSteps: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Approval Transaction not found');
    }

    return transaction;
  }

  async approve(id: string, dto: ApproveTransactionDto) {
    const transaction = await this.prisma.approvalTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Approval Transaction not found');
    }

    const currentStep = await this.prisma.approvalTransactionStep.findFirst({
      where: {
        transactionId: id,
        stepNo: transaction.currentStep,
      },
    });

    if (!currentStep) {
      throw new NotFoundException('Approval step not found');
    }

    if (currentStep.approverId !== dto.approverId) {
      throw new ForbiddenException(
        'You are not authorized to approve this step',
      );
    }

    await this.prisma.approvalTransactionStep.update({
      where: {
        id: currentStep.id,
      },
      data: {
        status: 'APPROVED',
        action: 'APPROVED',
        remarks: dto.remarks,
        actionDate: new Date(),
      },
    });

    const nextStep = await this.prisma.approvalTransactionStep.findFirst({
      where: {
        transactionId: id,
        stepNo: {
          gt: transaction.currentStep,
        },
      },
      orderBy: {
        stepNo: 'asc',
      },
    });

    if (nextStep) {
      await this.prisma.approvalTransaction.update({
        where: { id },
        data: {
          currentStep: nextStep.stepNo,
        },
      });

      return {
        message: 'Step approved. Moved to next approver.',
      };
    }

    await this.prisma.approvalTransaction.update({
      where: { id },
      data: {
        status: 'APPROVED',
      },
    });

    if (transaction.entityType === 'HR_REQUEST') {
      await this.prisma.hrRequest.update({
        where: {
          id: transaction.entityId,
        },
        data: {
          status: 'APPROVED',
        },
      });
    }

    return {
      message: 'Transaction fully approved',
    };
  }

  async reject(id: string, dto: RejectTransactionDto) {
    const transaction = await this.prisma.approvalTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Approval Transaction not found');
    }

    const currentStep = await this.prisma.approvalTransactionStep.findFirst({
      where: {
        transactionId: id,
        stepNo: transaction.currentStep,
      },
    });

    if (!currentStep) {
      throw new NotFoundException('Approval step not found');
    }

    if (currentStep.approverId !== dto.approverId) {
      throw new ForbiddenException(
        'You are not authorized to reject this step',
      );
    }

    await this.prisma.approvalTransactionStep.update({
      where: {
        id: currentStep.id,
      },
      data: {
        status: 'REJECTED',
        action: 'REJECTED',
        remarks: dto.remarks,
        actionDate: new Date(),
      },
    });

    await this.prisma.approvalTransaction.update({
      where: { id },
      data: {
        status: 'REJECTED',
      },
    });

    if (transaction.entityType === 'HR_REQUEST') {
      await this.prisma.hrRequest.update({
        where: {
          id: transaction.entityId,
        },
        data: {
          status: 'REJECTED',
        },
      });
    }

    return {
      message: 'Transaction rejected',
    };
  }
}
