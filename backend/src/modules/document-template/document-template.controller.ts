import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { DocumentTemplateService } from './document-template.service';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';

@Controller('document-template')
export class DocumentTemplateController {
  constructor(
    private readonly documentTemplateService: DocumentTemplateService,
  ) {}

  @Post()
  create(@Body() createDocumentTemplateDto: CreateDocumentTemplateDto) {
    return this.documentTemplateService.create(createDocumentTemplateDto);
  }

  @Get()
  findAll() {
    return this.documentTemplateService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentTemplateService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDocumentTemplateDto: UpdateDocumentTemplateDto,
  ) {
    return this.documentTemplateService.update(id, updateDocumentTemplateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentTemplateService.remove(id);
  }
}
