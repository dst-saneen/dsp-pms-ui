import { Module } from '@nestjs/common';

import { DesignationController } from './designation.controller';
import { DesignationService } from './designation.service';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';

@Module({
  imports: [PrismaModule, AuditModule, OnboardingRuntimeModule],

  controllers: [DesignationController],

  providers: [DesignationService],
})
export class DesignationModule {}
