import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { ApprovalController } from './approval.controller';
import { ApprovalService } from './approval.service';

@Module({
  imports: [PrismaModule],
  controllers: [ApprovalController],
  providers: [ApprovalService],
})
export class ApprovalModule {}
