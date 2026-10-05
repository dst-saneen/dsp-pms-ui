import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { RecruitmentEnabledGuard } from '../guards/recruitment-feature.guard';

import { RecruitmentDashboardService } from './recruitment-dashboard.service';

@ApiTags('Recruitment - Dashboard')
@UseGuards(RecruitmentEnabledGuard)
@Controller('hr/recruitment/dashboard')
export class RecruitmentDashboardController {
  constructor(
    private readonly recruitmentDashboardService: RecruitmentDashboardService,
  ) {}

  @Get()
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'Recruitment KPI counts and action queues' })
  getSummary() {
    return this.recruitmentDashboardService.getSummary();
  }
}
