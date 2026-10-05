import { PartialType } from '@nestjs/swagger';
import { AssignResourceDto } from './assign-resource.dto';

export class UpdateEmployeeResourceDto extends PartialType(AssignResourceDto) {}
