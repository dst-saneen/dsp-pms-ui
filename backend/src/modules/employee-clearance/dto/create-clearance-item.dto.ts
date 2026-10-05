import { IsString } from 'class-validator';

export class CreateClearanceItemDto {
  @IsString()
  clearanceType: string;

  @IsString()
  itemName: string;
}
