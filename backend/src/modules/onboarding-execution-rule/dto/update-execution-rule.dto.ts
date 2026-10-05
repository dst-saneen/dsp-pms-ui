import { PartialType } from '@nestjs/swagger';

import { CreateExecutionRuleDto } from './create-execution-rule.dto';

export class UpdateExecutionRuleDto extends PartialType(
  CreateExecutionRuleDto,
) {}
