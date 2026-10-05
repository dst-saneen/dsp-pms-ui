import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

import { WorkforceJobsScheduler } from './workforce-jobs.scheduler';

@ApiTags('Workforce Jobs')
@Controller('workforce-jobs')
export class WorkforceJobsController {
  constructor(
    private readonly workforceJobsScheduler: WorkforceJobsScheduler,
  ) {}

  @Get('health')
  @RequirePermissions('hr.attendance.lock')
  health() {
    return this.workforceJobsScheduler.getHealth();
  }
}
