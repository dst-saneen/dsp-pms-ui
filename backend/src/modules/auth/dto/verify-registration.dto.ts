import { IsString, IsUUID, Matches } from 'class-validator';

export class VerifyRegistrationDto {
  @IsUUID()
  registrationId: string;

  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'code must contain exactly six digits',
  })
  code: string;
}
