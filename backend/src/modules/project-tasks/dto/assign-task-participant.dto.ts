import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignTaskParticipantDto {
  @ApiProperty({
    description: 'Task ID',
  })
  @IsUUID()
  taskId: string;

  @ApiProperty({
    description: 'Employee ID',
  })
  @IsUUID()
  employeeId: string;

  @ApiProperty({
    description: 'Participant Role',
    example: 'OWNER',
  })
  @IsString()
  role: string;

  @ApiPropertyOptional({
    description: 'Planned Hours',
  })
  @IsOptional()
  @IsDecimal()
  plannedHours?: string;

  @ApiPropertyOptional({
    description: 'Remarks',
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}
