import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { Public, SkipResponseEnvelope } from '../../common';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@SkipResponseEnvelope()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Check application liveness' })
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Check application and database readiness' })
  async getReadiness(@Res({ passthrough: true }) response: Response) {
    const readiness = await this.healthService.getReadiness();

    if (readiness.status === 'error') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return readiness;
  }

  @Get('delivery-mode')
  @RequirePermissions('hr.recruitment.delivery.read')
  @ApiOperation({
    summary: 'Resolve Delivery capability mode for the authenticated caller',
  })
  async getDeliveryMode() {
    return this.healthService.getDeliveryMode();
  }
}
