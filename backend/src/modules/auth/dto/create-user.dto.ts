import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { UserRoleAssignmentDto } from './user-role-assignment.dto';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message:
      'username may contain only letters, numbers, periods, underscores, and hyphens',
  })
  username?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  defaultCompanyGroupId?: string;

  @IsOptional()
  @IsUUID()
  defaultCompanyId?: string;

  @IsOptional()
  @IsUUID()
  defaultBranchId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => UserRoleAssignmentDto)
  roleAssignments: UserRoleAssignmentDto[];
}
