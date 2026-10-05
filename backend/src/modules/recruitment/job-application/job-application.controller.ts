import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import {
  RecruitmentEnabledGuard,
  RecruitmentShortlistEnabledGuard,
} from '../guards/recruitment-feature.guard';

import { JobApplicationTransitionDto } from './dto/job-application-transition.dto';
import { SearchJobApplicationDto } from './dto/search-job-application.dto';
import { JobApplicationService } from './job-application.service';

@ApiTags('Recruitment - Applications')
@UseGuards(RecruitmentEnabledGuard)
@Controller('hr/recruitment/applications')
export class JobApplicationController {
  constructor(private readonly jobApplicationService: JobApplicationService) {}

  @Get()
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'List job applications' })
  findAll(@Query() query: SearchJobApplicationDto) {
    return this.jobApplicationService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'Get job application by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobApplicationService.findOne(id);
  }

  @Get(':id/timeline')
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'Get immutable application status timeline' })
  getTimeline(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobApplicationService.getTimeline(id);
  }

  @Post(':id/shortlist')
  @UseGuards(RecruitmentShortlistEnabledGuard)
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Shortlist an application' })
  shortlist(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JobApplicationTransitionDto,
  ) {
    return this.jobApplicationService.shortlist(id, dto);
  }

  @Post(':id/start-screening')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Start screening for application' })
  startScreening(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JobApplicationTransitionDto,
  ) {
    return this.jobApplicationService.startScreening(id, dto);
  }

  @Post(':id/advance-to-interview')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Advance application to interview stage' })
  advanceToInterview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JobApplicationTransitionDto,
  ) {
    return this.jobApplicationService.advanceToInterview(id, dto);
  }

  @Post(':id/advance-to-manager-review')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Advance application to hiring manager review' })
  advanceToManagerReview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JobApplicationTransitionDto,
  ) {
    return this.jobApplicationService.advanceToManagerReview(id, dto);
  }

  @Post(':id/reject')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Reject application' })
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JobApplicationTransitionDto,
  ) {
    return this.jobApplicationService.reject(id, dto);
  }

  @Post(':id/withdraw')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Record application withdrawal' })
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JobApplicationTransitionDto,
  ) {
    return this.jobApplicationService.withdraw(id, dto);
  }
}
