import { PartialType } from '@nestjs/mapped-types';

import { CreateEmployeeDocumentCategoryDto } from './create-employee-document-category.dto';

export class UpdateEmployeeDocumentCategoryDto extends PartialType(
  CreateEmployeeDocumentCategoryDto,
) {}
