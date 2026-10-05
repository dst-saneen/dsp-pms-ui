import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';
import {
  OptionalHolidayYearQueryDto,
  UpdateOptionalHolidaySelectionsDto,
} from './dto/update-optional-holiday-selections.dto';
import { OptionalHolidaySelectionService } from './optional-holiday-selection.service';

@ApiTags('Optional Holidays (Me)')
@Controller('me')
export class OptionalHolidayController {
  constructor(private readonly selections: OptionalHolidaySelectionService) {}

  @Get('optional-holidays')
  @RequirePermissions('hr.self.read')
  getCatalog(
    @Req() request: AuthenticatedRequest,
    @Query() query: OptionalHolidayYearQueryDto,
  ) {
    return this.selections.getCatalog(request.user, query.year);
  }

  @Put('optional-holiday-selections/:year')
  @RequirePermissions('hr.self.manage')
  updateSelections(
    @Req() request: AuthenticatedRequest,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: UpdateOptionalHolidaySelectionsDto,
  ) {
    return this.selections.updateSelections(request.user, year, dto.eventIds);
  }
}
