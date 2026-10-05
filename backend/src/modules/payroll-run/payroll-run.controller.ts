import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { PayrollRunService } from './payroll-run.service';
import { CreatePayrollRunDto } from './dto/create-payroll-run.dto';
import { UpdatePayrollRunDto } from './dto/update-payroll-run.dto';

@Controller('payroll-run')
export class PayrollRunController {
  constructor(private readonly payrollRunService: PayrollRunService) {}

  @Post()
  create(@Body() createPayrollRunDto: CreatePayrollRunDto) {
    return this.payrollRunService.create(createPayrollRunDto);
  }

  @Get()
  findAll() {
    return this.payrollRunService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollRunService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePayrollRunDto,
  ) {
    return this.payrollRunService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.payrollRunService.remove(id);
  }
}
