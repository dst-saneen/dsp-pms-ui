import { PartialType } from '@nestjs/swagger';
import { RetiredCreateProjectDto } from './retired-create-project.dto';

export class RetiredUpdateProjectDto extends PartialType(
  RetiredCreateProjectDto,
) {}
