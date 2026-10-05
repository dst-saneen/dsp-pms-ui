import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  token: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @IsOptional()
  @IsUUID()
  companyGroupId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
