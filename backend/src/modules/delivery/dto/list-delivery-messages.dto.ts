import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DeliveryChannel, DeliveryMessageStatus } from '@prisma/client';

export class ListDeliveryMessagesDto {
  @IsOptional()
  @IsEnum(DeliveryMessageStatus)
  status?: DeliveryMessageStatus;

  @IsOptional()
  @IsEnum(DeliveryChannel)
  channel?: DeliveryChannel;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  eventType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  keyword?: string;

  @IsOptional()
  @IsUUID()
  recipientId?: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsISO8601()
  fromDate?: string;

  @IsOptional()
  @IsISO8601()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsEnum(['createdAt', 'nextAttemptAt', 'deliveredAt', 'status'] as const)
  sortBy?: 'createdAt' | 'nextAttemptAt' | 'deliveredAt' | 'status';

  @IsOptional()
  @IsEnum(['asc', 'desc'] as const)
  sortOrder?: 'asc' | 'desc';
}

export class RetryDeliveryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  operationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class CancelDeliveryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  operationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class ReleaseSuppressionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsUUID()
  operationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
