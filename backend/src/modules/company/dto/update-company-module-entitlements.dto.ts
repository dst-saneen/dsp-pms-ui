import { ApiProperty } from '@nestjs/swagger';
import { CompanyModuleCode } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  ValidateNested,
} from 'class-validator';

export class CompanyModuleEntitlementDto {
  @ApiProperty({ enum: CompanyModuleCode })
  @IsEnum(CompanyModuleCode)
  module: CompanyModuleCode;

  @ApiProperty()
  @IsBoolean()
  isEnabled: boolean;
}

export class UpdateCompanyModuleEntitlementsDto {
  @ApiProperty({ type: [CompanyModuleEntitlementDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: CompanyModuleEntitlementDto | undefined) => item?.module)
  @ValidateNested({ each: true })
  @Type(() => CompanyModuleEntitlementDto)
  entitlements: CompanyModuleEntitlementDto[];
}
