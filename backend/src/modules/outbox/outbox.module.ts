import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { MailModule } from '../mail/mail.module';
import { RecruitmentDocumentModule } from '../recruitment/document/recruitment-document.module';
import { RecruitmentDeliveryProcessor } from '../recruitment/services/recruitment-delivery.processor';
import { DeliveryModule } from '../delivery/delivery.module';
import { PayrollModule } from '../payroll/payroll.module';

import { OutboxProcessorService } from './outbox-processor.service';
import { OutboxWriterService } from './outbox-writer.service';

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    MailModule,
    RecruitmentDocumentModule,
    DeliveryModule,
    forwardRef(() => PayrollModule),
  ],
  providers: [
    OutboxWriterService,
    OutboxProcessorService,
    RecruitmentDeliveryProcessor,
  ],
  exports: [OutboxWriterService, OutboxProcessorService],
})
export class OutboxModule {}
