import { IsUUID } from 'class-validator';

export class OwnerEmployeeSelectionDto {
  @IsUUID()
  companyId: string;

  @IsUUID()
  branchId: string;

  @IsUUID()
  departmentId: string;

  @IsUUID()
  designationId: string;
}
