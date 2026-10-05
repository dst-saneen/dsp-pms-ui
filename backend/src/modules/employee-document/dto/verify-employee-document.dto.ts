import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyEmployeeDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}
