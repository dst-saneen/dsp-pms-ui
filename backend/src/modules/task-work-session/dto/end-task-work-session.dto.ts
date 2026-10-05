import { IsOptional, IsString } from 'class-validator';

export class EndTaskWorkSessionDto {
  @IsOptional()
  @IsString()
  adjustmentRemarks?: string;
}
