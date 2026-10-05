import { IsUUID } from 'class-validator';

export class SubmitLeaveRequestDto {
  @IsUUID()
  leaveRequestId: string;
}
