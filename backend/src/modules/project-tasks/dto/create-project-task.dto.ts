import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectTaskDto {
  @ApiProperty()
  @IsUUID()
  projectId: string;

  @ApiProperty()
  @IsUUID()
  stageId: string;

  @ApiProperty()
  @IsString()
  taskCode: string;

  @ApiProperty()
  @IsString()
  taskName: string;

  @ApiPropertyOptional({
    description: 'Task Type',
  })
  @IsOptional()
  @IsUUID()
  taskTypeId?: string;

  @ApiPropertyOptional({
    description: 'Parent Task',
  })
  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  plannedHours?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  estimatedReviewHours?: number;
}
