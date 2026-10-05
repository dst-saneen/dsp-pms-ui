import { RoleScope } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class UserRoleAssignmentDto {
  @IsUUID()
  roleId: string;

  @IsEnum(RoleScope)
  scope: RoleScope;

  @IsOptional()
  @IsUUID()
  companyGroupId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
