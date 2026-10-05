import { IsUUID } from 'class-validator';

export class ResendRegistrationDto {
  @IsUUID()
  registrationId: string;
}
