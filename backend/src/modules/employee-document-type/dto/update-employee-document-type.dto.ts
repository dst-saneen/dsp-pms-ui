import { PartialType } from '@nestjs/mapped-types';

import { CreateEmployeeDocumentTypeDto } from './create-employee-document-type.dto';

export class UpdateEmployeeDocumentTypeDto extends PartialType(
  CreateEmployeeDocumentTypeDto,
) {}
