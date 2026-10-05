import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { BusinessCalendarAdminService } from './business-calendar-admin.service';
import { BusinessCalendarEventService } from './business-calendar-event.service';
import { BusinessCalendarImportController } from './business-calendar-import.controller';
import { BusinessCalendarImportService } from './business-calendar-import.service';
import { BusinessCalendarImpactService } from './business-calendar-impact.service';
import { BusinessCalendarMetadataController } from './business-calendar-metadata.controller';
import { BusinessCalendarMetadataService } from './business-calendar-metadata.service';
import { BusinessCalendarMigrationService } from './business-calendar-migration.service';
import { BusinessCalendarConsumerService } from './business-calendar-consumer.service';
import { BusinessCalendarPublishService } from './business-calendar-publish.service';
import { BusinessCalendarRuntimeController } from './business-calendar-runtime.controller';
import { BusinessCalendarRuntimeService } from './business-calendar-runtime.service';
import { BusinessCalendarVersionService } from './business-calendar-version.service';
import {
  BusinessCalendarController,
  BusinessCalendarEventController,
  BusinessCalendarVersionController,
} from './business-calendar.controller';
import { CompanyHolidayPolicyController } from './company-holiday-policy.controller';
import { CompanyHolidayPolicyService } from './company-holiday-policy.service';
import { OptionalHolidayCatalogService } from './optional-holiday-catalog.service';
import { FixtureGovernmentHolidayProvider } from './providers/fixture-government-holiday.provider';

@Module({
  imports: [PrismaModule, AuditModule, OutboxModule],
  controllers: [
    BusinessCalendarController,
    BusinessCalendarVersionController,
    BusinessCalendarEventController,
    BusinessCalendarMetadataController,
    BusinessCalendarRuntimeController,
    BusinessCalendarImportController,
    CompanyHolidayPolicyController,
  ],
  providers: [
    BusinessCalendarAdminService,
    BusinessCalendarVersionService,
    BusinessCalendarEventService,
    BusinessCalendarMetadataService,
    BusinessCalendarRuntimeService,
    BusinessCalendarPublishService,
    BusinessCalendarMigrationService,
    BusinessCalendarConsumerService,
    BusinessCalendarImportService,
    BusinessCalendarImpactService,
    CompanyHolidayPolicyService,
    OptionalHolidayCatalogService,
    FixtureGovernmentHolidayProvider,
  ],
  exports: [
    BusinessCalendarAdminService,
    BusinessCalendarVersionService,
    BusinessCalendarEventService,
    BusinessCalendarMetadataService,
    BusinessCalendarRuntimeService,
    BusinessCalendarPublishService,
    BusinessCalendarMigrationService,
    BusinessCalendarConsumerService,
    BusinessCalendarImportService,
    BusinessCalendarImpactService,
    CompanyHolidayPolicyService,
    OptionalHolidayCatalogService,
  ],
})
export class BusinessCalendarModule {}
