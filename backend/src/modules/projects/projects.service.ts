import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RetiredCreateProjectDto } from './dto/retired-create-project.dto';
import { RetiredUpdateProjectDto } from './dto/retired-update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: RetiredCreateProjectDto) {
    return this.prisma.project.create({
      data: dto,
    });
  }

  async findAll() {
    return this.prisma.project.findMany({
      include: {
        company: true,
        branch: true,
        projectManager: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        company: true,
        branch: true,
        projectManager: true,
        teamMembers: {
          include: {
            employee: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(id: string, dto: RetiredUpdateProjectDto) {
    return this.prisma.project.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    return this.prisma.project.delete({
      where: { id },
    });
  }
}
