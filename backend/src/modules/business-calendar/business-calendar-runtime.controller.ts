import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { CalendarImpactStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';
import { BusinessCalendarConsumerService } from './business-calendar-consumer.service';
import { BusinessCalendarImpactService } from './business-calendar-impact.service';
import { BusinessCalendarMigrationService } from './business-calendar-migration.service';
import { BusinessCalendarRuntimeService } from './business-calendar-runtime.service';
import {
  MigrationBackfillDto,
  MigrationShadowCompareDto,
  RuntimeDayQueryDto,
  RuntimePreviewDto,
  RuntimeRangeQueryDto,
  RuntimeRebuildDto,
  SetOfficeRuntimeModeDto,
} from './dto/business-calendar-publish.dto';

class ListImpactsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: CalendarImpactStatus })
  @IsOptional()
  @IsEnum(CalendarImpactStatus)
  status?: CalendarImpactStatus;
}

class ResolveImpactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolutionReason?: string;
}

@ApiTags('Business Calendar Runtime')
@Controller('business-calendar')
export class BusinessCalendarRuntimeController {
  constructor(
    private readonly runtime: BusinessCalendarRuntimeService,
    private readonly migration: BusinessCalendarMigrationService,
    private readonly consumer: BusinessCalendarConsumerService,
    private readonly impacts: BusinessCalendarImpactService,
  ) {}

  @Get('impacts')
  @RequirePermissions('calendar.business.read')
  listImpacts(@Query() query: ListImpactsQueryDto) {
    return this.impacts.list(query);
  }

  @Post('impacts/:impactId/resolve')
  @RequirePermissions('calendar.business.review')
  resolveImpact(
    @Req() request: AuthenticatedRequest,
    @Param('impactId') impactId: string,
    @Body() dto: ResolveImpactDto,
  ) {
    return this.impacts.resolve(impactId, dto, request.user.id);
  }

  @Get('runtime/day')
  @RequirePermissions('calendar.business.runtime.preview')
  getDay(@Query() query: RuntimeDayQueryDto) {
    return this.runtime.getDay(query);
  }

  @Get('runtime/range')
  @RequirePermissions('calendar.business.runtime.preview')
  getRange(@Query() query: RuntimeRangeQueryDto) {
    return this.runtime.getRange(query);
  }

  @Post('runtime/preview')
  @RequirePermissions('calendar.business.runtime.preview')
  preview(@Body() dto: RuntimePreviewDto) {
    return this.runtime.previewDay(dto);
  }

  @Post('runtime/rebuild')
  @RequirePermissions('calendar.business.publish')
  rebuild(@Body() dto: RuntimeRebuildDto) {
    return this.runtime.rebuild(dto);
  }

  @Post('migration/backfill')
  @RequirePermissions('calendar.business.manage')
  backfill(
    @Req() request: AuthenticatedRequest,
    @Body() dto: MigrationBackfillDto,
  ) {
    return this.migration.backfill({
      apply: dto.apply === true,
      expected: dto.expected,
      effectiveYear: dto.effectiveYear,
      actorUserId: request.user.id,
      companyId: dto.companyId,
      allowProduction: dto.allowProduction === true,
    });
  }

  @Post('migration/shadow-compare')
  @RequirePermissions('calendar.business.runtime.preview')
  shadowCompare(
    @Req() request: AuthenticatedRequest,
    @Body() dto: MigrationShadowCompareDto,
  ) {
    return this.migration.shadowCompare({
      companyId: dto.companyId,
      branchId: dto.branchId,
      actorUserId: request.user.id,
      allowDraftVersions: dto.allowDraftVersions !== false,
      activateShadow: dto.activateShadow === true,
      allowProduction: dto.allowProduction === true,
    });
  }

  @Post('runtime/mode')
  @RequirePermissions('calendar.business.publish')
  setRuntimeMode(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SetOfficeRuntimeModeDto,
  ) {
    return this.consumer.setOfficeRuntimeMode({
      companyId: dto.companyId,
      branchId: dto.branchId,
      mode: dto.mode,
      actorUserId: request.user.id,
    });
  }
}
