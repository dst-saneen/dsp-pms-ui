import { UserStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export class UpdateUserStatusDto {
  @IsIn([UserStatus.ACTIVE, UserStatus.LOCKED, UserStatus.DISABLED])
  status: UserStatus;
}
