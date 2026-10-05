import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import { CreateApprovalTransactionStepDto } from './dto/create-approval-transaction-step.dto';

import { UpdateApprovalTransactionStepDto } from './dto/update-approval-transaction-step.dto';

@Injectable()
export class ApprovalTransactionStepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateApprovalTransactionStepDto) {
    const step = await this.prisma.approvalTransactionStep.create({
      data: dto,
    });

    await this.auditService.log(
      'ApprovalTransactionStep',
      step.id,
      'CREATE',
      null,
      step,
    );

    return step;
  }

  async findAll() {
    return this.prisma.approvalTransactionStep.findMany({
      include: {
        approver: true,
        transaction: true,
      },
      orderBy: [
        {
          transactionId: 'asc',
        },
        {
          stepNo: 'asc',
        },
      ],
    });
  }

  async findOne(id: string) {
    const step = await this.prisma.approvalTransactionStep.findUnique({
      where: { id },
      include: {
        approver: true,
        transaction: true,
      },
    });

    if (!step) {
      throw new NotFoundException('Approval Transaction Step not found');
    }

    return step;
  }

  async update(id: string, dto: UpdateApprovalTransactionStepDto) {
    await this.findOne(id);

    const updated = await this.prisma.approvalTransactionStep.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log(
      'ApprovalTransactionStep',
      id,
      'UPDATE',
      null,
      updated,
    );

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.approvalTransactionStep.delete({
      where: { id },
    });
  }
}
