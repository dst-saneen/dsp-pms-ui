import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOnboardingTemplateDto {
  @ApiProperty({
    example: 'company-uuid',
  })
  @IsUUID()
  companyId: string;

  @ApiPropertyOptional({
    example: 'ARCH-ONB',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  templateCode?: string;

  @ApiProperty({
    example: 'Architect Onboarding',
  })
  @IsString()
  @MaxLength(200)
  templateName: string;

  @ApiPropertyOptional({
    example: 'Standard onboarding template for architects',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
