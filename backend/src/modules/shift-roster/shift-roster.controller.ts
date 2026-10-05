import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';

import {
  CreateShiftRosterDto,
  CreateShiftRosterOverrideDto,
  GenerateShiftRosterDto,
  ShiftRosterFilterDto,
  ShiftRosterTransitionDto,
  UpdateShiftRosterDto,
} from './dto';
import { ShiftRosterService } from './shift-roster.service';

@ApiTags('Shift Roster')
@Controller('shift-rosters')
export class ShiftRosterController {
  constructor(private readonly shiftRosterService: ShiftRosterService) {}

  @Post()
  create(
    @Body() dto: CreateShiftRosterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.shiftRosterService.create(dto, request.user);
  }

  @Get()
  findAll(@Query() filters: ShiftRosterFilterDto) {
    return this.shiftRosterService.findAll(filters);
  }

  @Post('generate')
  generate(
    @Body() dto: GenerateShiftRosterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.shiftRosterService.generate(dto, request.user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.shiftRosterService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftRosterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.shiftRosterService.update(id, dto, request.user);
  }

  @Post(':id/publish')
  @RequirePermissions('hr.schedule.publish')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShiftRosterTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.shiftRosterService.publish(id, dto, request.user);
  }

  @Post(':id/lock')
  @RequirePermissions('hr.schedule.publish')
  lock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShiftRosterTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.shiftRosterService.lock(id, dto, request.user);
  }

  @Post(':id/archive')
  @RequirePermissions('hr.schedule.publish')
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShiftRosterTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.shiftRosterService.archive(id, dto, request.user);
  }

  @Post(':id/overrides')
  createOverride(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateShiftRosterOverrideDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.shiftRosterService.override(id, dto, request.user);
  }
}
