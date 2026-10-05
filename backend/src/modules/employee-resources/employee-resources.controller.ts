import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { EmployeeResourcesService } from './employee-resources.service';

import { AssignResourceDto } from './dto/assign-resource.dto';
import { RevokeResourceDto } from './dto/revoke-resource.dto';

@Controller('employee-resources')
export class EmployeeResourcesController {
  constructor(
    private readonly employeeResourcesService: EmployeeResourcesService,
  ) {}

  @Post('assign')
  assign(@Body() dto: AssignResourceDto) {
    return this.employeeResourcesService.assign(dto);
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string, @Body() dto: RevokeResourceDto) {
    return this.employeeResourcesService.revoke(id, dto);
  }

  @Get('employee/:employeeId')
  getEmployeeResources(@Param('employeeId') employeeId: string) {
    return this.employeeResourcesService.getEmployeeResources(employeeId);
  }

  @Get('active')
  getActiveAssignments() {
    return this.employeeResourcesService.getActiveAssignments();
  }
}
