import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectEmployeeDocumentDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  remarks!: string;
}
