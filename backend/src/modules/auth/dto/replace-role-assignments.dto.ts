import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';

import { UserRoleAssignmentDto } from './user-role-assignment.dto';

export class ReplaceRoleAssignmentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UserRoleAssignmentDto)
  roleAssignments: UserRoleAssignmentDto[];
}
