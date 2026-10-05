import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  organizationName: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: 'legalCountryCode must be a two-letter ISO country code.',
  })
  legalCountryCode: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  displayName: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;
}
