import { PartialType } from '@nestjs/swagger';
import { CreateTaskParticipantDto } from './create-task-participant.dto';

export class UpdateTaskParticipantDto extends PartialType(
  CreateTaskParticipantDto,
) {}
