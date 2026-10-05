import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { ApprovalService } from './approval.service';

@Controller('approval')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Post('approve/:transactionStepId')
  approve(
    @Param('transactionStepId')
    transactionStepId: string,
  ) {
    return this.approvalService.approve(transactionStepId);
  }

  @Post('reject/:transactionStepId')
  reject(
    @Param('transactionStepId')
    transactionStepId: string,
    @Body('remarks') remarks: string,
  ) {
    return this.approvalService.reject(transactionStepId, remarks);
  }

  @Get('pending/:approverId')
  getPendingApprovals(
    @Param('approverId')
    approverId: string,
  ) {
    return this.approvalService.getPendingApprovals(approverId);
  }

  @Get('details/:transactionId')
  getApprovalDetails(
    @Param('transactionId')
    transactionId: string,
  ) {
    return this.approvalService.getApprovalDetails(transactionId);
  }

  @Get('history/:entityType/:entityId')
  getApprovalHistory(
    @Param('entityType')
    entityType: string,

    @Param('entityId')
    entityId: string,
  ) {
    return this.approvalService.getApprovalHistory(entityType, entityId);
  }
}
