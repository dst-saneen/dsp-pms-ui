import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

import { ResourceTypesController } from './resource-types.controller';
import { ResourceTypesService } from './resource-types.service';

@Module({
  imports: [PrismaModule],
  controllers: [ResourceTypesController],
  providers: [ResourceTypesService],
})
export class ResourceTypesModule {}
