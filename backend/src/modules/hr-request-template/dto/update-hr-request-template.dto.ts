import { PartialType } from '@nestjs/swagger';
import { CreateHrRequestTemplateDto } from './create-hr-request-template.dto';

export class UpdateHrRequestTemplateDto extends PartialType(
  CreateHrRequestTemplateDto,
) {}
