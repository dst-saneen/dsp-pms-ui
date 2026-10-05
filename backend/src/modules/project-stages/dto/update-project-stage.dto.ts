import { PartialType } from '@nestjs/swagger';
import { CreateProjectStageDto } from './create-project-stage.dto';

export class UpdateProjectStageDto extends PartialType(CreateProjectStageDto) {}
