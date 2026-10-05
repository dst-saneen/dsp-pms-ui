import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';

import { UserNotificationService } from './user-notification.service';

class NotificationQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

@ApiTags('Notifications')
@Controller('notifications')
export class UserNotificationController {
  constructor(
    private readonly userNotificationService: UserNotificationService,
  ) {}

  @Get()
  @RequirePermissions('hr.self.read')
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: NotificationQueryDto,
  ) {
    return this.userNotificationService.listForUser(request.user.id, {
      unreadOnly: query.unreadOnly,
      limit: query.limit,
    });
  }

  @Post('read-all')
  @RequirePermissions('hr.self.manage')
  markAllRead(@Req() request: AuthenticatedRequest) {
    return this.userNotificationService.markAllRead(request.user);
  }

  @Post(':id/read')
  @RequirePermissions('hr.self.manage')
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.userNotificationService.markRead(id, request.user);
  }
}
