import { IsUUID, IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateEmployeeAssetDto {
  @IsUUID()
  employeeId: string;

  @IsUUID()
  assetId: string;

  @IsDateString()
  assignedDate: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
