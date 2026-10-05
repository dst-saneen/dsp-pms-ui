import { Module, forwardRef } from '@nestjs/common';

import { FileStorageModule } from '../file-storage/file-storage.module';
import { MailModule } from '../mail/mail.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [forwardRef(() => FileStorageModule), MailModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
