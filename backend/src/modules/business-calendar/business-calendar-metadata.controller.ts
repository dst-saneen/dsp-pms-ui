import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';
import { BusinessCalendarMetadataService } from './business-calendar-metadata.service';
import {
  CreateEventCategoryDto,
  CreateEventSourceDto,
  CreateEventTypeDto,
  UpdateEventCategoryDto,
  UpdateEventSourceDto,
  UpdateEventTypeDto,
} from './dto/business-calendar-version.dto';

@ApiTags('Business Calendar Metadata')
@Controller('business-calendar-metadata')
export class BusinessCalendarMetadataController {
  constructor(private readonly metadata: BusinessCalendarMetadataService) {}

  @Get('event-types')
  @RequirePermissions('calendar.business.read')
  listTypes(@Query('companyId') companyId?: string) {
    return this.metadata.listEventTypes(companyId);
  }

  @Post('event-types')
  @RequirePermissions('calendar.business.manage')
  createType(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateEventTypeDto,
  ) {
    return this.metadata.createEventType(dto, request.user.id);
  }

  @Patch('event-types/:id')
  @RequirePermissions('calendar.business.manage')
  updateType(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateEventTypeDto,
  ) {
    return this.metadata.updateEventType(id, dto, request.user.id);
  }

  @Get('categories')
  @RequirePermissions('calendar.business.read')
  listCategories(@Query('companyId') companyId?: string) {
    return this.metadata.listCategories(companyId);
  }

  @Post('categories')
  @RequirePermissions('calendar.business.manage')
  createCategory(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateEventCategoryDto,
  ) {
    return this.metadata.createCategory(dto, request.user.id);
  }

  @Patch('categories/:id')
  @RequirePermissions('calendar.business.manage')
  updateCategory(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateEventCategoryDto,
  ) {
    return this.metadata.updateCategory(id, dto, request.user.id);
  }

  @Get('sources')
  @RequirePermissions('calendar.business.read')
  listSources(@Query('companyId') companyId?: string) {
    return this.metadata.listSources(companyId);
  }

  @Post('sources')
  @RequirePermissions('calendar.business.manage')
  createSource(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateEventSourceDto,
  ) {
    return this.metadata.createSource(dto, request.user.id);
  }

  @Patch('sources/:id')
  @RequirePermissions('calendar.business.manage')
  updateSource(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateEventSourceDto,
  ) {
    return this.metadata.updateSource(id, dto, request.user.id);
  }
}
