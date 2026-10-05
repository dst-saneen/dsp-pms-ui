import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';
import { BusinessCalendarAdminService } from './business-calendar-admin.service';
import { BusinessCalendarEventService } from './business-calendar-event.service';
import { BusinessCalendarPublishService } from './business-calendar-publish.service';
import { BusinessCalendarVersionService } from './business-calendar-version.service';
import {
  EnsureOfficeCalendarsDto,
  ListBusinessCalendarsQueryDto,
  ProvisionBranchCalendarDto,
  ProvisionCompanyCalendarDto,
  UpdateBusinessCalendarDto,
} from './dto/business-calendar-admin.dto';
import {
  PreviewImpactDto,
  PublishCalendarVersionDto,
  StartAmendmentDto,
} from './dto/business-calendar-publish.dto';
import {
  CreateBusinessCalendarEventDto,
  CreateCalendarVersionDto,
  ListEventsQueryDto,
  ReplaceWorkingWeekDto,
  UpdateBusinessCalendarEventDto,
  UpdateCalendarVersionDto,
  VersionTransitionDto,
} from './dto/business-calendar-version.dto';

@ApiTags('Business Calendar')
@Controller('business-calendars')
export class BusinessCalendarController {
  constructor(
    private readonly admin: BusinessCalendarAdminService,
    private readonly versions: BusinessCalendarVersionService,
    private readonly events: BusinessCalendarEventService,
  ) {}

  @Get()
  @RequirePermissions('calendar.business.read')
  list(@Query() query: ListBusinessCalendarsQueryDto) {
    return this.admin.list(query);
  }

  @Get(':id/versions')
  @RequirePermissions('calendar.business.read')
  listVersions(@Param('id', ParseUUIDPipe) id: string) {
    return this.versions.listVersions(id);
  }

  @Post(':id/versions')
  @RequirePermissions('calendar.business.manage')
  createVersion(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCalendarVersionDto,
  ) {
    return this.versions.createVersion(id, dto, request.user.id);
  }

  @Get(':id')
  @RequirePermissions('calendar.business.read')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getOne(id);
  }

  @Post('company')
  @RequirePermissions('calendar.business.manage')
  provisionCompany(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ProvisionCompanyCalendarDto,
  ) {
    return this.admin.provisionCompanyCalendar(dto, request.user.id);
  }

  @Post('branch')
  @RequirePermissions('calendar.business.manage')
  provisionBranch(
    @Req() request: AuthenticatedRequest,
    @Body() dto: ProvisionBranchCalendarDto,
  ) {
    return this.admin.provisionBranchCalendar(dto, request.user.id);
  }

  @Post('ensure')
  @RequirePermissions('calendar.business.manage')
  ensure(
    @Req() request: AuthenticatedRequest,
    @Body() dto: EnsureOfficeCalendarsDto,
  ) {
    return this.admin.ensureOfficeCalendars(dto, request.user.id);
  }

  @Patch(':id')
  @RequirePermissions('calendar.business.manage')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBusinessCalendarDto,
  ) {
    return this.admin.update(id, dto, request.user.id);
  }
}

@ApiTags('Business Calendar Versions')
@Controller('business-calendar-versions')
export class BusinessCalendarVersionController {
  constructor(
    private readonly versions: BusinessCalendarVersionService,
    private readonly events: BusinessCalendarEventService,
    private readonly publish: BusinessCalendarPublishService,
  ) {}

  @Get(':versionId')
  @RequirePermissions('calendar.business.read')
  getOne(@Param('versionId', ParseUUIDPipe) versionId: string) {
    return this.versions.getVersion(versionId);
  }

  @Patch(':versionId')
  @RequirePermissions('calendar.business.manage')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: UpdateCalendarVersionDto,
  ) {
    return this.versions.updateVersion(versionId, dto, request.user.id);
  }

  @Put(':versionId/working-week')
  @RequirePermissions('calendar.business.manage')
  replaceWorkingWeek(
    @Req() request: AuthenticatedRequest,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: ReplaceWorkingWeekDto,
  ) {
    return this.versions.replaceWorkingWeek(versionId, dto, request.user.id);
  }

  @Post(':versionId/submit-review')
  @RequirePermissions('calendar.business.manage')
  submitReview(
    @Req() request: AuthenticatedRequest,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: VersionTransitionDto,
  ) {
    return this.versions.submitReview(versionId, dto, request.user.id);
  }

  @Post(':versionId/return-draft')
  @RequirePermissions('calendar.business.manage')
  returnDraft(
    @Req() request: AuthenticatedRequest,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: VersionTransitionDto,
  ) {
    return this.versions.returnDraft(versionId, dto, request.user.id);
  }

  @Post(':versionId/publish')
  @RequirePermissions('calendar.business.publish')
  publishVersion(
    @Req() request: AuthenticatedRequest,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: PublishCalendarVersionDto,
  ) {
    return this.publish.publish(versionId, dto, request.user.id);
  }

  @Post(':versionId/start-amendment')
  @RequirePermissions('calendar.business.amend')
  startAmendment(
    @Req() request: AuthenticatedRequest,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: StartAmendmentDto,
  ) {
    return this.publish.startAmendment(versionId, dto, request.user.id);
  }

  @Post(':versionId/preview-impact')
  @RequirePermissions('calendar.business.publish')
  previewImpact(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: PreviewImpactDto,
  ) {
    return this.publish.previewImpact(versionId, dto);
  }

  @Get(':versionId/events')
  @RequirePermissions('calendar.business.read')
  listEvents(
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Query() query: ListEventsQueryDto,
  ) {
    return this.events.listEvents(versionId, query);
  }

  @Post(':versionId/events')
  @RequirePermissions('calendar.business.manage')
  createEvent(
    @Req() request: AuthenticatedRequest,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: CreateBusinessCalendarEventDto,
  ) {
    return this.events.createEvent(versionId, dto, request.user.id);
  }
}

@ApiTags('Business Calendar Events')
@Controller('business-calendar-events')
export class BusinessCalendarEventController {
  constructor(private readonly events: BusinessCalendarEventService) {}

  @Get(':eventId')
  @RequirePermissions('calendar.business.read')
  getOne(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.events.getEvent(eventId);
  }

  @Patch(':eventId')
  @RequirePermissions('calendar.business.manage')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: UpdateBusinessCalendarEventDto,
  ) {
    return this.events.updateEvent(eventId, dto, request.user.id);
  }

  @Delete(':eventId')
  @RequirePermissions('calendar.business.manage')
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.events.deleteEvent(eventId, request.user.id);
  }
}
