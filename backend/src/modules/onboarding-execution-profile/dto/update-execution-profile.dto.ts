import { PartialType } from '@nestjs/swagger';

import { CreateExecutionProfileDto } from './create-execution-profile.dto';

export class UpdateExecutionProfileDto extends PartialType(
  CreateExecutionProfileDto,
) {}
