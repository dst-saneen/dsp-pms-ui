import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';

import { CompOffCreditFilterDto, RevokeCompOffCreditDto } from './dto';
import { CompOffCreditService } from './comp-off-credit.service';

@ApiTags('Comp-off Credits')
@Controller('comp-off-credits')
export class CompOffController {
  constructor(private readonly compOffCreditService: CompOffCreditService) {}

  @Get()
  @RequirePermissions('hr.comp-off.read')
  findAll(@Query() filters: CompOffCreditFilterDto) {
    return this.compOffCreditService.findAll(filters);
  }

  @Get(':id')
  @RequirePermissions('hr.comp-off.read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.compOffCreditService.findOne(id);
  }

  @Post(':id/revoke')
  @RequirePermissions('hr.comp-off.manage')
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeCompOffCreditDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.compOffCreditService.revoke(id, dto.reason, request.user);
  }
}
