import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  IsIn,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreatePublicUploadSessionDto {
  @IsString()
  @IsNotEmpty()
  applicationOperationId: string;

  @IsIn(['CV', 'SUPPORTING'])
  purpose: 'CV' | 'SUPPORTING';

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  declaredMimeType: string;

  @IsInt()
  @Min(1)
  sizeBytes: number;

  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256: string;

  @IsString()
  @IsNotEmpty()
  antiAbuseToken: string;
}

export class CreateDomainUploadSessionDto {
  @IsString()
  @IsNotEmpty()
  domainRecordId: string;

  @IsString()
  @IsNotEmpty()
  purpose: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  declaredMimeType: string;

  @IsInt()
  @Min(1)
  sizeBytes: number;

  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256: string;

  @IsString()
  @IsNotEmpty()
  operationId: string;
}

export class CreateOfferUploadSessionDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsIn(['application/pdf'])
  declaredMimeType: string;

  @IsInt()
  @Min(1)
  sizeBytes: number;

  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256: string;

  @IsString()
  @IsNotEmpty()
  operationId: string;
}

export class AcceptOfferWithSignedDocumentDto {
  @IsString()
  @IsNotEmpty()
  legalName: string;

  @IsIn([true])
  declarationAccepted: true;

  @IsString()
  @IsNotEmpty()
  uploadSessionId: string;

  @IsInt()
  @Min(0)
  expectedOfferVersion: number;

  @IsString()
  @IsNotEmpty()
  operationId: string;
}

export class DecideOfferSignatureDto {
  @IsInt()
  @Min(0)
  expectedOfferVersion: number;

  @IsInt()
  @Min(0)
  expectedSubmissionVersion: number;

  @IsString()
  @IsNotEmpty()
  operationId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
