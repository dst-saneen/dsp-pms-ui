import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

import { EmployeeResourcesController } from './employee-resources.controller';
import { EmployeeResourcesService } from './employee-resources.service';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeResourcesController],
  providers: [EmployeeResourcesService],
})
export class EmployeeResourcesModule {}
