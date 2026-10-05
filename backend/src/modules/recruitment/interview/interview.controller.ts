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
import { RecruitmentEnabledGuard } from '../guards/recruitment-feature.guard';

import { SearchInterviewDto } from './dto/search-interview.dto';
import {
  CancelInterviewDto,
  RescheduleInterviewDto,
  ScheduleInterviewDto,
} from './dto/schedule-interview.dto';
import { InterviewService } from './interview.service';

@ApiTags('Recruitment - Interviews')
@UseGuards(RecruitmentEnabledGuard)
@Controller('hr/recruitment/interviews')
export class InterviewListController {
  constructor(private readonly interviewService: InterviewService) {}

  @Get()
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'List interview sessions in scope' })
  listAll(@Query() query: SearchInterviewDto) {
    return this.interviewService.listAll(query);
  }
}

@ApiTags('Recruitment - Interviews')
@UseGuards(RecruitmentEnabledGuard)
@Controller('hr/recruitment/applications/:applicationId/interviews')
export class InterviewController {
  constructor(private readonly interviewService: InterviewService) {}

  @Get()
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'List interview sessions for an application' })
  list(@Param('applicationId', ParseUUIDPipe) applicationId: string) {
    return this.interviewService.listForApplication(applicationId);
  }

  @Post()
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Schedule an interview session' })
  schedule(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: ScheduleInterviewDto,
  ) {
    return this.interviewService.schedule(applicationId, dto);
  }

  @Post(':sessionId/reschedule')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Reschedule an interview session' })
  reschedule(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: RescheduleInterviewDto,
  ) {
    return this.interviewService.reschedule(applicationId, sessionId, dto);
  }

  @Post(':sessionId/cancel')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Cancel an interview session' })
  cancel(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: CancelInterviewDto,
  ) {
    return this.interviewService.cancel(applicationId, sessionId, dto);
  }

  @Post(':sessionId/complete')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Mark an interview session as completed' })
  complete(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.interviewService.complete(applicationId, sessionId);
  }
}
