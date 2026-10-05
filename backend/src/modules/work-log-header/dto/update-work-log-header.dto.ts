import { PartialType } from '@nestjs/swagger';
import { CreateWorkLogHeaderDto } from './create-work-log-header.dto';

export class UpdateWorkLogHeaderDto extends PartialType(
  CreateWorkLogHeaderDto,
) {}
