import { PartialType } from '@nestjs/swagger';
import { CreateHrRequestTypeDto } from './create-hr-request-type.dto';

export class UpdateHrRequestTypeDto extends PartialType(
  CreateHrRequestTypeDto,
) {}
