import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { CompOffCreditStatus } from '@prisma/client';

export class CompOffCreditFilterDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  status?: CompOffCreditStatus;
}

export class RevokeCompOffCreditDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
