import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { HrRequestTemplateService } from './hr-request-template.service';
import { CreateHrRequestTemplateDto } from './dto/create-hr-request-template.dto';
import { UpdateHrRequestTemplateDto } from './dto/update-hr-request-template.dto';

@Controller('hr-request-template')
export class HrRequestTemplateController {
  constructor(
    private readonly hrRequestTemplateService: HrRequestTemplateService,
  ) {}

  @Post()
  create(@Body() createHrRequestTemplateDto: CreateHrRequestTemplateDto) {
    return this.hrRequestTemplateService.create(createHrRequestTemplateDto);
  }

  @Get()
  findAll() {
    return this.hrRequestTemplateService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.hrRequestTemplateService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateHrRequestTemplateDto: UpdateHrRequestTemplateDto,
  ) {
    return this.hrRequestTemplateService.update(
      +id,
      updateHrRequestTemplateDto,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.hrRequestTemplateService.remove(+id);
  }
}
