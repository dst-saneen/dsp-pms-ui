import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EmployeeTaxProfileService } from './employee-tax-profile.service';
import { CreateEmployeeTaxProfileDto } from './dto/create-employee-tax-profile.dto';
import { UpdateEmployeeTaxProfileDto } from './dto/update-employee-tax-profile.dto';

@Controller('employee-tax-profile')
export class EmployeeTaxProfileController {
  constructor(
    private readonly employeeTaxProfileService: EmployeeTaxProfileService,
  ) {}

  @Post()
  create(@Body() createEmployeeTaxProfileDto: CreateEmployeeTaxProfileDto) {
    return this.employeeTaxProfileService.create(createEmployeeTaxProfileDto);
  }

  @Get()
  findAll() {
    return this.employeeTaxProfileService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeTaxProfileService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEmployeeTaxProfileDto: UpdateEmployeeTaxProfileDto,
  ) {
    return this.employeeTaxProfileService.update(
      id,
      updateEmployeeTaxProfileDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.employeeTaxProfileService.remove(id);
  }
}
