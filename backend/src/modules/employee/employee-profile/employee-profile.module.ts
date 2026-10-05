import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../prisma/prisma.module';
import { EmployeeModule } from '../employee.module';

import { EmployeeProfileController } from './employee-profile.controller';
import { EmployeeProfileService } from './employee-profile.service';

@Module({
  imports: [PrismaModule, EmployeeModule],

  controllers: [EmployeeProfileController],

  providers: [EmployeeProfileService],

  exports: [EmployeeProfileService],
})
export class EmployeeProfileModule {}
