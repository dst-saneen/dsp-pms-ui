import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../../common';
import type { AuthenticatedRequest } from '../../auth';
import { RecruitmentEnabledGuard } from '../guards/recruitment-feature.guard';
import { EmployeeCareerService } from './employee-career.service';
import {
  ManagerChangeDto,
  PromotionDto,
  TransferDto,
} from './dto/career-action.dto';

@ApiTags('Employee Career')
@ApiBearerAuth()
@UseGuards(RecruitmentEnabledGuard)
@Controller('hr/employees')
export class HrEmployeeCareerController {
  constructor(private readonly careerService: EmployeeCareerService) {}

  @Get(':employeeId/career')
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'Get authorized HR career timeline' })
  getEmployeeCareer(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return this.careerService.getHrCareerTimeline(employeeId);
  }

  @Post(':employeeId/career/promotion')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Record employee promotion' })
  recordPromotion(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: PromotionDto,
  ) {
    return this.careerService.recordPromotion(employeeId, dto);
  }

  @Post(':employeeId/career/transfer')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Record employee transfer' })
  recordTransfer(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: TransferDto,
  ) {
    return this.careerService.recordTransfer(employeeId, dto);
  }

  @Post(':employeeId/career/manager-change')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Record reporting manager change' })
  recordManagerChange(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: ManagerChangeDto,
  ) {
    return this.careerService.recordManagerChange(employeeId, dto);
  }
}

@ApiTags('My Career')
@ApiBearerAuth()
@Controller('me')
export class MeCareerController {
  constructor(private readonly careerService: EmployeeCareerService) {}

  @Get('career')
  @ApiOperation({ summary: 'Get sanitized self-service career timeline' })
  getMyCareer(@Req() request: AuthenticatedRequest) {
    if (!request.user.employeeId) {
      throw new UnauthorizedException('Employee profile is not linked.');
    }

    return this.careerService.getSanitizedSelfCareerTimeline(
      request.user.employeeId,
    );
  }
}
