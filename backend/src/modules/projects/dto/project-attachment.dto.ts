import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  IsInt,
  Min,
} from 'class-validator';

export class CreateProjectUploadSessionDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  declaredMimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256!: string;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;
}

export class LinkProjectAttachmentDto {
  @IsUUID()
  @IsNotEmpty()
  uploadSessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  documentPurpose?: string;

  @IsUUID()
  @IsNotEmpty()
  operationId!: string;
}
