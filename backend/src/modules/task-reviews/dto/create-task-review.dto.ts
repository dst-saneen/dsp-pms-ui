import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTaskReviewDto {
  @ApiProperty()
  @IsUUID()
  submissionId: string;

  @ApiProperty()
  @IsUUID()
  reviewerId: string;

  @ApiProperty({
    example: 'REJECTED',
  })
  @IsString()
  decision: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiProperty({
    required: false,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  reviewHours?: number;
}
