import { IsOptional, IsUUID } from 'class-validator';

export class ChangeContextDto {
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
