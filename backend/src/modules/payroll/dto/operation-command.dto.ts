import { IsUUID } from 'class-validator';

export class OperationCommandDto {
  @IsUUID('4')
  operationId!: string;
}
