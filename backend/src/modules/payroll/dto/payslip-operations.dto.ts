import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const PAYSLIP_OPERATION_STATES = [
  'PENDING',
  'ACTIVE_GENERATION',
  'STALE_GENERATION',
  'FAILED',
  'DEAD_LETTER',
] as const;

export type PayslipOperationState = (typeof PAYSLIP_OPERATION_STATES)[number];

export class ListPayslipOperationsDto {
  @IsOptional()
  @IsIn(PAYSLIP_OPERATION_STATES)
  state?: PayslipOperationState;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 25;
}
