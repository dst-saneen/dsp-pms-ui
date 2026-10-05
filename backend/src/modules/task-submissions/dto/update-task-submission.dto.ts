import { PartialType } from '@nestjs/swagger';
import { CreateTaskSubmissionDto } from './create-task-submission.dto';

export class UpdateTaskSubmissionDto extends PartialType(
  CreateTaskSubmissionDto,
) {}
