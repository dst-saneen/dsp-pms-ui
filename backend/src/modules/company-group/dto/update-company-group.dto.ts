import { PartialType } from '@nestjs/mapped-types';

import { CreateCompanyGroupDto } from './create-company-group.dto';

export class UpdateCompanyGroupDto extends PartialType(CreateCompanyGroupDto) {}
