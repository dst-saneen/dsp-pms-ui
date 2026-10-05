import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { COMPANY_SETTING_KEYS } from '../company-setting-contract';

export class CreateCompanySettingDto {
  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty()
  @IsString()
  @IsIn(COMPANY_SETTING_KEYS)
  settingKey: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  settingValue: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
