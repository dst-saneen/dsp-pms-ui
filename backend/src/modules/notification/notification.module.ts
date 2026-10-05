import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { UserNotificationController } from './user-notification.controller';
import { UserNotificationService } from './user-notification.service';

@Module({
  imports: [PrismaModule],
  controllers: [UserNotificationController],
  providers: [UserNotificationService],
  exports: [UserNotificationService],
})
export class NotificationModule {}
