import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { WorkCategoryController } from './work-category.controller';
import { WorkCategoryService } from './work-category.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkCategoryController],
  providers: [WorkCategoryService],
  exports: [WorkCategoryService],
})
export class WorkCategoryModule {}
