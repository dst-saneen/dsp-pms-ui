import { IsUUID, IsOptional, IsString } from 'class-validator';

export class ApproveTransactionDto {
  @IsUUID()
  approverId: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
