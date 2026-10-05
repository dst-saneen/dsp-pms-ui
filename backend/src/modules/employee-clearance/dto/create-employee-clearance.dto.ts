import { IsString } from 'class-validator';

export class CreateEmployeeClearanceDto {
  @IsString()
  separationId: string;
}
