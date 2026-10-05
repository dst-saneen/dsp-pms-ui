import { Module } from '@nestjs/common';
import { HrRequestTemplateService } from './hr-request-template.service';
import { HrRequestTemplateController } from './hr-request-template.controller';

@Module({
  controllers: [HrRequestTemplateController],
  providers: [HrRequestTemplateService],
})
export class HrRequestTemplateModule {}
