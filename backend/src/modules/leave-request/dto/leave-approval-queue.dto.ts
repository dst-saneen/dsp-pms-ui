import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const LEAVE_APPROVAL_QUEUES = [
  'manager',
  'hr',
  'completed',
  'actionable',
] as const;

export type LeaveApprovalQueue = (typeof LEAVE_APPROVAL_QUEUES)[number];

export class LeaveApprovalQueueQueryDto {
  @ApiPropertyOptional({ enum: LEAVE_APPROVAL_QUEUES })
  @IsOptional()
  @IsIn([...LEAVE_APPROVAL_QUEUES])
  queue?: LeaveApprovalQueue;
}
