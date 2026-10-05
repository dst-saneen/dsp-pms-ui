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
import { SalaryComponentService } from './salary-component.service';
import { CreateSalaryComponentDto } from './dto/create-salary-component.dto';
import { UpdateSalaryComponentDto } from './dto/update-salary-component.dto';

@Controller('salary-component')
export class SalaryComponentController {
  constructor(
    private readonly salaryComponentService: SalaryComponentService,
  ) {}

  @Post()
  create(@Body() dto: CreateSalaryComponentDto) {
    return this.salaryComponentService.create(dto);
  }

  @Get()
  findAll() {
    return this.salaryComponentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryComponentService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalaryComponentDto,
  ) {
    return this.salaryComponentService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.salaryComponentService.remove(id);
  }
}
