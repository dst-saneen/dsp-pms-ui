import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';

import { ApprovalTransactionStepService } from './approval-transaction-step.service';

import { CreateApprovalTransactionStepDto } from './dto/create-approval-transaction-step.dto';
import { UpdateApprovalTransactionStepDto } from './dto/update-approval-transaction-step.dto';

@Controller('approval-transaction-steps')
export class ApprovalTransactionStepController {
  constructor(
    private readonly approvalTransactionStepService: ApprovalTransactionStepService,
  ) {}

  @Post()
  create(@Body() dto: CreateApprovalTransactionStepDto) {
    return this.approvalTransactionStepService.create(dto);
  }

  @Get()
  findAll() {
    return this.approvalTransactionStepService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.approvalTransactionStepService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateApprovalTransactionStepDto,
  ) {
    return this.approvalTransactionStepService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.approvalTransactionStepService.remove(id);
  }
}
