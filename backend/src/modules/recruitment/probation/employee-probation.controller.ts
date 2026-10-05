import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { RequirePermissions } from '../../../common';
import type { AuthenticatedRequest } from '../../auth';
import { RecruitmentEnabledGuard } from '../guards/recruitment-feature.guard';
import { EmployeeProbationService } from './employee-probation.service';

class ConfirmActiveDto {
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  note?: string;

  @IsOptional()
  @IsBoolean()
  override?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(12)
  @MaxLength(1_000)
  overrideReason?: string;
}

@ApiTags('Recruitment Probation')
@ApiBearerAuth()
@UseGuards(RecruitmentEnabledGuard)
@Controller('hr')
export class EmployeeProbationController {
  constructor(private readonly probationService: EmployeeProbationService) {}

  @Get('recruitment/probation-due')
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'List employees due for probation confirmation' })
  listProbationDue(
    @Query('asOf') asOf?: string,
    @Query('includeUpcoming') includeUpcoming?: string,
    @Req() request?: AuthenticatedRequest,
  ) {
    return this.probationService.listProbationDue(
      asOf ? new Date(asOf) : new Date(),
      {
        includeUpcoming: includeUpcoming === 'true',
        permissions: request?.user.authorization.permissions ?? [],
      },
    );
  }

  @Post('employees/:employeeId/confirm-active')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Confirm employee as active after probation' })
  confirmActive(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: ConfirmActiveDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.probationService.confirmActive(employeeId, request.user.id, {
      note: dto.note,
      override: dto.override ?? false,
      overrideReason: dto.overrideReason,
      permissions: request.user.authorization.permissions,
    });
  }
}
