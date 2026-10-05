import { IsOptional, IsString, MinLength } from 'class-validator';

export class CancelLeaveRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}
