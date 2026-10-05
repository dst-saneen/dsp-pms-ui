import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateDocumentTemplateDto {
  @IsString()
  templateCode: string;

  @IsString()
  templateName: string;

  @IsString()
  templateContent: string;

  @IsString()
  companyId: string;

  @IsString()
  fileFormat: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
