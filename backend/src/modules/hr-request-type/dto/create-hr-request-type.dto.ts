import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateHrRequestTypeDto {
  /** Optional — server allocates HRT-00001 when omitted. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  requestCode?: string;

  @IsString()
  @MaxLength(160)
  requestName: string;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsUUID()
  workflowId?: string;
}
