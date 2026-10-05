import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';

import {
  TeamCalendarFilterDto,
  WorkforceCalendarEmployeeOptionsQueryDto,
  WorkforceCalendarFilterDto,
} from './dto';
import { WorkforceCalendarService } from './workforce-calendar.service';

@ApiTags('Workforce Calendar')
@Controller()
export class WorkforceCalendarController {
  constructor(
    private readonly workforceCalendarService: WorkforceCalendarService,
  ) {}

  @Get('workforce-calendar/employee-options')
  @RequireAnyPermissions('hr.calendar.read', 'hr.team.read')
  listEmployeeOptions(
    @Query() query: WorkforceCalendarEmployeeOptionsQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.workforceCalendarService.listEmployeeOptions(
      request.user,
      query,
    );
  }

  @Get('workforce-calendar')
  @RequireAnyPermissions('hr.calendar.read', 'hr.team.read')
  getCalendar(
    @Query() filters: WorkforceCalendarFilterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.workforceCalendarService.getCalendar(request.user, filters);
  }

  @Get('team/workforce-calendar')
  @RequirePermissions('hr.team.read')
  getTeamCalendar(
    @Query() filters: TeamCalendarFilterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.workforceCalendarService.getTeamCalendar(request.user, filters);
  }
}
