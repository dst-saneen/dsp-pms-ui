import { Injectable } from '@nestjs/common';

import { UserNotificationService } from '../../notification/user-notification.service';

@Injectable()
export class EmployeeWorkspaceNotificationService {
  constructor(
    private readonly userNotificationService: UserNotificationService,
  ) {}

  async getNotifications(employeeId: string) {
    const rows = await this.userNotificationService.listForEmployee(
      employeeId,
      { limit: 20 },
    );
    return this.userNotificationService.toWorkspaceDto(rows);
  }
}
