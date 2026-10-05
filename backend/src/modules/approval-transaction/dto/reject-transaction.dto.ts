import { IsUUID, IsOptional, IsString } from 'class-validator';

export class RejectTransactionDto {
  @IsUUID()
  approverId: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
