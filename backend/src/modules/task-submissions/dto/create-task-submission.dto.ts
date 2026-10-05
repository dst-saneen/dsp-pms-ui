import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTaskSubmissionDto {
  @ApiProperty()
  @IsUUID()
  taskId: string;

  @ApiProperty()
  @IsInt()
  versionNo: number;

  @ApiProperty()
  @IsUUID()
  submittedById: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  submissionNotes?: string;

  @ApiProperty()
  @IsString()
  filePath: string;
}
