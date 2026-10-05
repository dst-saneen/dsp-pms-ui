import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import { VersionedCommandDto } from './versioned-command.dto';

export class UpdateAssetCategoryCommandDto extends VersionedCommandDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  assetCategoryName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
