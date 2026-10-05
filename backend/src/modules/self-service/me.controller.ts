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
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RequireAnyPermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';
import { AssetCustodyRequestService } from '../asset-domain/asset-custody-request.service';
import { AssetCustodyService } from '../asset-domain/asset-custody.service';
import { AssetsEnabledGuard } from '../asset-domain/guards/assets-enabled.guard';
import { LicenseAllocationService } from '../asset-domain/license-allocation.service';
import { createAssetAccessContext } from '../asset-domain/asset-access.types';
import { AcknowledgeCustodyCommandDto } from '../asset-domain/dto/assign-employee-asset-command.dto';
import {
  CancelMyCustodyRequestDto,
  CreateMyAssetRequestDto,
} from '../asset-domain/dto/transfer-request-command.dto';
import { ASSET_INVENTORY_READ_PERMISSIONS } from '../asset-domain/policies/asset-permissions';
import { CancelLeaveRequestDto } from '../leave-request/dto/cancel-leave-request.dto';
import {
  CancelOvertimeRequestDto,
  SubmitOvertimeRequestDto,
} from '../overtime-request/dto';
import { CreateAttendanceRegularizationDto } from '../attendance/dto/attendance-workforce.dto';

import {
  CreateMyLeaveRequestDto,
  UpdateMyLeaveRequestDto,
} from './dto/my-leave-request.dto';
import { SelfServiceService } from './self-service.service';
import { ModuleCapabilitiesService } from '../module-capabilities';
import { OnboardingEnabledGuard } from '../onboarding-runtime/guards/onboarding-enabled.guard';

class LeaveYearQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

class MeDateRangeQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

class MeCalendarQueryDto {
  @IsDateString()
  fromDate!: string;

  @IsDateString()
  toDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  state?: string;
}

@ApiTags('Self Service')
@Controller('me')
export class MeController {
  constructor(
    private readonly selfService: SelfServiceService,
    private readonly assetCustody: AssetCustodyService,
    private readonly licenseAllocations: LicenseAllocationService,
    private readonly assetRequests: AssetCustodyRequestService,
    private readonly moduleCapabilities: ModuleCapabilitiesService,
  ) {}

  @Get('module-capabilities')
  // This read-only endpoint resolves the caller's permitted Company modules
  // for the shared navigation shell. It must remain available to every
  // authenticated role; requiring HR self-service here hides entitled
  // Finance, Payroll, Asset, and Project workspaces from specialist roles.
  @RequirePermissions()
  getModuleCapabilities(@Req() request: AuthenticatedRequest) {
    return this.moduleCapabilities.getForUser(request.user);
  }

  @Get('workspace')
  @RequirePermissions('hr.self.read')
  getWorkspace(@Req() request: AuthenticatedRequest) {
    return this.selfService.getWorkspace(request.user);
  }

  @Get('onboarding')
  @UseGuards(OnboardingEnabledGuard)
  @RequirePermissions('hr.self.read')
  getOnboarding(@Req() request: AuthenticatedRequest) {
    return this.selfService.getOnboarding(request.user);
  }

  @Get('documents')
  @RequirePermissions('hr.self.read')
  getDocuments(@Req() request: AuthenticatedRequest) {
    return this.selfService.getDocuments(request.user);
  }

  @Get('assets')
  @UseGuards(AssetsEnabledGuard)
  @RequirePermissions('hr.self.read')
  getAssets(@Req() request: AuthenticatedRequest) {
    return this.selfService.getAssets(request.user);
  }

  @Post('assets/assignments/:id/acknowledge')
  @UseGuards(AssetsEnabledGuard)
  @RequirePermissions('hr.self.manage')
  acknowledgeAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcknowledgeCustodyCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assetCustody.acknowledge(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post('assets/allocations/:id/acknowledge')
  @UseGuards(AssetsEnabledGuard)
  @RequirePermissions('hr.self.manage')
  acknowledgeAllocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcknowledgeCustodyCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.licenseAllocations.acknowledge(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Get('assets/requests')
  @UseGuards(AssetsEnabledGuard)
  @RequirePermissions('hr.self.read')
  getAssetRequests(@Req() request: AuthenticatedRequest) {
    return this.assetRequests.findMine(createAssetAccessContext(request.user));
  }

  @Post('assets/requests')
  @UseGuards(AssetsEnabledGuard)
  @RequirePermissions('hr.self.manage')
  createAssetRequest(
    @Body() dto: CreateMyAssetRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assetRequests.createMine(
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post('assets/requests/:id/cancel')
  @UseGuards(AssetsEnabledGuard)
  @RequirePermissions('hr.self.manage')
  cancelAssetRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelMyCustodyRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assetRequests.cancelMine(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Get('asset-departments')
  @UseGuards(AssetsEnabledGuard)
  @RequireAnyPermissions(...ASSET_INVENTORY_READ_PERMISSIONS)
  getAssetDepartments(@Req() request: AuthenticatedRequest) {
    return this.selfService.getAssetDepartments(request.user);
  }

  @Get('leave')
  @RequirePermissions('hr.self.read')
  getLeave(
    @Req() request: AuthenticatedRequest,
    @Query() query: LeaveYearQueryDto,
  ) {
    return this.selfService.getLeave(request.user, query.year);
  }

  @Get('leave-types')
  @RequirePermissions('hr.self.read')
  getLeaveTypes(@Req() request: AuthenticatedRequest) {
    return this.selfService.getLeaveTypes(request.user);
  }

  @Post('leave-previews')
  @RequirePermissions('hr.self.manage')
  previewLeaveRequest(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateMyLeaveRequestDto,
  ) {
    return this.selfService.previewLeaveRequest(request.user, dto);
  }

  @Post('leave-requests')
  @RequirePermissions('hr.self.manage')
  createLeaveRequest(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateMyLeaveRequestDto,
  ) {
    return this.selfService.createLeaveRequest(request.user, dto);
  }

  @Patch('leave-requests/:id')
  @RequirePermissions('hr.self.manage')
  updateLeaveRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMyLeaveRequestDto,
  ) {
    return this.selfService.updateLeaveRequest(request.user, id, dto);
  }

  @Post('leave-requests/:id/submit')
  @RequirePermissions('hr.self.manage')
  submitLeaveRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.selfService.submitLeaveRequest(request.user, id);
  }

  @Post('leave-requests/:id/cancel')
  @RequirePermissions('hr.self.manage')
  cancelLeaveRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelLeaveRequestDto,
  ) {
    return this.selfService.cancelLeaveRequest(request.user, id, dto);
  }

  @Get('attendance')
  @RequirePermissions('hr.self.read')
  getAttendance(@Req() request: AuthenticatedRequest) {
    return this.selfService.getAttendance(request.user);
  }

  @Post('attendance/check-in')
  @RequirePermissions('hr.self.manage')
  checkIn(@Req() request: AuthenticatedRequest) {
    return this.selfService.checkIn(request.user);
  }

  @Post('attendance/check-out')
  @RequirePermissions('hr.self.manage')
  checkOut(@Req() request: AuthenticatedRequest) {
    return this.selfService.checkOut(request.user);
  }

  @Get('overtime')
  @RequirePermissions('hr.self.read')
  getOvertime(@Req() request: AuthenticatedRequest) {
    return this.selfService.getOvertime(request.user);
  }

  @Post('overtime/:id/submit')
  @RequirePermissions('hr.self.manage')
  submitOvertime(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitOvertimeRequestDto,
  ) {
    return this.selfService.submitOvertime(request.user, id, dto);
  }

  @Post('overtime/:id/cancel')
  @RequirePermissions('hr.self.manage')
  cancelOvertime(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOvertimeRequestDto,
  ) {
    return this.selfService.cancelOvertime(request.user, id, dto);
  }

  @Get('comp-off')
  @RequirePermissions('hr.self.read')
  getCompOff(@Req() request: AuthenticatedRequest) {
    return this.selfService.getCompOff(request.user);
  }

  @Get('shift-roster')
  @RequirePermissions('hr.self.read')
  getShiftRoster(
    @Req() request: AuthenticatedRequest,
    @Query() query: MeDateRangeQueryDto,
  ) {
    return this.selfService.getShiftRoster(request.user, query);
  }

  @Get('workforce-calendar')
  @RequirePermissions('hr.self.read')
  getWorkforceCalendar(
    @Req() request: AuthenticatedRequest,
    @Query() query: MeCalendarQueryDto,
  ) {
    return this.selfService.getWorkforceCalendar(request.user, query);
  }

  @Get('attendance/exceptions')
  @RequirePermissions('hr.self.read')
  getAttendanceExceptions(@Req() request: AuthenticatedRequest) {
    return this.selfService.getAttendanceExceptions(request.user);
  }

  @Get('attendance/regularizations')
  @RequirePermissions('hr.self.read')
  getAttendanceRegularizations(@Req() request: AuthenticatedRequest) {
    return this.selfService.getAttendanceRegularizations(request.user);
  }

  @Post('attendance/regularizations')
  @RequirePermissions('hr.self.manage')
  submitAttendanceRegularization(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateAttendanceRegularizationDto,
  ) {
    return this.selfService.submitAttendanceRegularization(request.user, dto);
  }
}
