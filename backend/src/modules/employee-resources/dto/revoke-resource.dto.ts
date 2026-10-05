import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class RevokeResourceDto {
  @ApiProperty({
    example: '2026-07-15',
  })
  @IsDateString()
  revokedDate: string;

  @ApiPropertyOptional({
    example: 'Employee resigned',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
