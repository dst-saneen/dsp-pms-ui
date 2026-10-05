import { PartialType } from '@nestjs/swagger';
import { CreateWorkCategoryDto } from './create-work-category.dto';

export class UpdateWorkCategoryDto extends PartialType(CreateWorkCategoryDto) {}
