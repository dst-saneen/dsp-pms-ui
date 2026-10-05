import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InspectOfferResponseDto {
  @ApiProperty()
  @IsString()
  token: string;
}

export class RespondToOfferDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  legalName: string;

  @ApiProperty()
  @IsBoolean()
  acknowledgementAccepted: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  comment?: string;
}

export class OfferDocumentDownloadDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsString()
  downloadToken: string;
}
