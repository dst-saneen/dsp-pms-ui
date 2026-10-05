import { Controller, Get, Post, Body, Param } from '@nestjs/common';

import { ApprovalTransactionService } from './approval-transaction.service';

import { CreateApprovalTransactionDto } from './dto/create-approval-transaction.dto';

import { ApproveTransactionDto } from './dto/approve-transaction.dto';

import { RejectTransactionDto } from './dto/reject-transaction.dto';

@Controller('approval-transactions')
export class ApprovalTransactionController {
  constructor(
    private readonly approvalTransactionService: ApprovalTransactionService,
  ) {}

  @Post()
  create(@Body() dto: CreateApprovalTransactionDto) {
    return this.approvalTransactionService.create(dto);
  }

  @Get()
  findAll() {
    return this.approvalTransactionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.approvalTransactionService.findOne(id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveTransactionDto) {
    return this.approvalTransactionService.approve(id, dto);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectTransactionDto) {
    return this.approvalTransactionService.reject(id, dto);
  }
}
