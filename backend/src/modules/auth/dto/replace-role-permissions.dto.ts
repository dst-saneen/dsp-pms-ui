import { ArrayMaxSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class ReplaceRolePermissionsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsString({ each: true })
  permissionIds: string[];
}
