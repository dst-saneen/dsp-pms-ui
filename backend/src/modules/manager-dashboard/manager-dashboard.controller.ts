import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';

import { ManagerDashboardService } from './manager-dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
export class ManagerDashboardController {
  constructor(
    private readonly managerDashboardService: ManagerDashboardService,
  ) {}

  @Get('manager')
  @RequirePermissions('dashboard.read')
  getManagerDashboard(@Req() request: AuthenticatedRequest) {
    return this.managerDashboardService.getDashboard(request.user);
  }
}
