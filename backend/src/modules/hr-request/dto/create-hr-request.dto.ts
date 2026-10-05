import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateHrRequestDto {
  @ApiProperty()
  @IsUUID()
  requestTypeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  remarks?: string;

  @ApiPropertyOptional({
    description: 'Finalized File Storage upload session id',
  })
  @IsOptional()
  @IsUUID()
  attachmentUploadSessionId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  operationId: string;
}
