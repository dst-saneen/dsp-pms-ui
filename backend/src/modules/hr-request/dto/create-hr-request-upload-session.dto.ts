import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateHrRequestUploadSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  declaredMimeType: string;

  @IsInt()
  @Min(1)
  sizeBytes: number;

  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  operationId: string;
}
