import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { OrganizationOnboardingController } from './organization-onboarding.controller';
import { OrganizationOnboardingService } from './organization-onboarding.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [OrganizationOnboardingController],
  providers: [OrganizationOnboardingService],
})
export class OrganizationOnboardingModule {}
