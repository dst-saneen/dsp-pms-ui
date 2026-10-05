import { IsOptional, IsString, MinLength } from 'class-validator';

export class ProcessLeaveRequestDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class RejectLeaveRequestDto {
  @IsString()
  @MinLength(1)
  remarks!: string;
}
