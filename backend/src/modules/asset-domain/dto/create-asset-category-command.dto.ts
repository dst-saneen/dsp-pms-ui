import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { OperationCommandDto } from './operation-command.dto';

export class CreateAssetCategoryCommandDto extends OperationCommandDto {
  @IsUUID()
  companyId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  assetCategoryName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
