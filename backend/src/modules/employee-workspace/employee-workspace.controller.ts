import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { EmployeeWorkspaceService } from './employee-workspace.service';
import { EmployeeWorkspaceResponseDto } from './dto/employee-workspace-response.dto';

@ApiTags('Employee Workspace')
@Controller('employee-workspace')
export class EmployeeWorkspaceController {
  constructor(private readonly workspaceService: EmployeeWorkspaceService) {}

  @Get(':employeeId')
  @ApiOperation({
    summary: 'Get Employee Workspace',
    description:
      'Returns the aggregated workspace information for an employee.',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee workspace loaded successfully.',
    type: EmployeeWorkspaceResponseDto,
  })
  async findWorkspace(
    @Param('employeeId', ParseUUIDPipe)
    employeeId: string,
  ): Promise<EmployeeWorkspaceResponseDto> {
    return this.workspaceService.getWorkspace(employeeId);
  }
}
