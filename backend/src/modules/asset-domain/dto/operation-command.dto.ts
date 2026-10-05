import { IsOptional, IsUUID } from 'class-validator';

/** Client-generated command idempotency key (plan §6.5). */
export class OperationCommandDto {
  @IsOptional()
  @IsUUID('4')
  operationId?: string;
}
