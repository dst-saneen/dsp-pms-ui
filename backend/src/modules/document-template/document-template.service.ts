import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

import { AuditService } from '../audit/audit.service';

@Injectable()
export class DocumentTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateDocumentTemplateDto) {
    const template = await this.prisma.documentTemplate.create({
      data: dto,
    });

    await this.auditService.log(
      'DocumentTemplate',
      template.id,
      'CREATE',
      null,
      template,
    );

    return template;
  }

  async findAll() {
    return this.prisma.documentTemplate.findMany({
      orderBy: {
        templateName: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Document Template not found');
    }

    return template;
  }

  async update(id: string, dto: UpdateDocumentTemplateDto) {
    const existing = await this.prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Document Template not found');
    }

    const updated = await this.prisma.documentTemplate.update({
      where: { id },
      data: dto,
    });

    return updated;
  }

  async remove(id: string) {
    const existing = await this.prisma.documentTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Document Template not found');
    }

    await this.prisma.documentTemplate.delete({
      where: { id },
    });

    return {
      message: 'Document Template deleted successfully',
    };
  }
}
