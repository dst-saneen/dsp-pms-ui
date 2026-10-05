import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../../common';
import type { AuthenticatedRequest, RequestSecurityMetadata } from '../../auth';
import { RecruitmentEnabledGuard } from '../guards/recruitment-feature.guard';
import { ConversionService } from './conversion.service';

@ApiTags('Recruitment Conversion')
@ApiBearerAuth()
@UseGuards(RecruitmentEnabledGuard)
@Controller('hr/recruitment/applications/:applicationId/conversion')
export class ConversionController {
  constructor(private readonly conversionService: ConversionService) {}

  @Get('preflight')
  @RequirePermissions('hr.recruitment.convert')
  @ApiOperation({ summary: 'Run conversion preflight checklist' })
  preflight(@Param('applicationId', ParseUUIDPipe) applicationId: string) {
    return this.conversionService.preflight(applicationId);
  }

  @Post('convert')
  @RequirePermissions('hr.recruitment.convert')
  @ApiOperation({ summary: 'Convert accepted application to employee' })
  convert(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.conversionService.convert(
      applicationId,
      this.toSecurityMetadata(request),
      request.user.id,
    );
  }

  private toSecurityMetadata(
    request: AuthenticatedRequest,
  ): RequestSecurityMetadata {
    return {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }
}
