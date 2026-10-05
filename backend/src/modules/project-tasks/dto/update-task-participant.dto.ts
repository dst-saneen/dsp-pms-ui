import { PartialType } from '@nestjs/swagger';
import { AssignTaskParticipantDto } from './assign-task-participant.dto';

export class UpdateTaskParticipantDto extends PartialType(
  AssignTaskParticipantDto,
) {}
