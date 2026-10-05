import { Module } from '@nestjs/common';

import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],

  controllers: [CompanyController],

  providers: [CompanyService],
})
export class CompanyModule {}
