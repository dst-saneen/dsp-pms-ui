import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateProjectTeamMemberDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiProperty()
  @IsString()
  role: string;

  @ApiProperty({
    required: false,
    default: 100,
  })
  @IsOptional()
  @IsNumber()
  allocationPercentage?: number;
}
