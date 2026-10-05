import { PartialType } from '@nestjs/swagger';
import { CreateWorkLogLineDto } from './create-work-log-line.dto';

export class UpdateWorkLogLineDto extends PartialType(CreateWorkLogLineDto) {}
