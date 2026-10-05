import { PartialType } from '@nestjs/swagger';
import { CreateTaskReviewDto } from './create-task-review.dto';

export class UpdateTaskReviewDto extends PartialType(CreateTaskReviewDto) {}
