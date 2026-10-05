import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { EmployeeProfileService } from './employee-profile.service';

@Controller('employees/:employeeId/profile')
export class EmployeeProfileController {
  constructor(private readonly profileService: EmployeeProfileService) {}

  @Get()
  getProfile(
    @Param('employeeId', ParseUUIDPipe)
    employeeId: string,
  ) {
    return this.profileService.getProfile(employeeId);
  }
}
