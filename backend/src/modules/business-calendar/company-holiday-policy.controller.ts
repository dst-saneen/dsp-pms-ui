import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CompanyHolidayPolicyService } from './company-holiday-policy.service';
import {
  CompanyHolidayPolicyQueryDto,
  UpsertCompanyHolidayPolicyDto,
} from './dto/company-holiday-policy.dto';
import { OptionalHolidayCatalogService } from './optional-holiday-catalog.service';

@ApiTags('Company Holiday Policies')
@Controller('company-holiday-policies')
export class CompanyHolidayPolicyController {
  constructor(
    private readonly policies: CompanyHolidayPolicyService,
    private readonly catalog: OptionalHolidayCatalogService,
  ) {}

  @Get()
  @RequirePermissions('calendar.business.manage')
  find(@Query() query: CompanyHolidayPolicyQueryDto) {
    return this.policies.find(query.companyId, query.year);
  }

  @Get(':companyId/:year/setup-status')
  @RequirePermissions('calendar.business.manage')
  setupStatus(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.catalog.getSetupStatus(companyId, year);
  }

  @Put(':companyId/:year')
  @RequirePermissions('calendar.business.manage')
  upsert(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('year', ParseIntPipe) year: number,
    @Body() dto: UpsertCompanyHolidayPolicyDto,
  ) {
    return this.policies.upsert(companyId, year, dto);
  }
}
