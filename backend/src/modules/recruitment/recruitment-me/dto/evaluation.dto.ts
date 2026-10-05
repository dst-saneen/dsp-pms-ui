import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class EvaluationScoreDto {
  @IsUUID()
  criterionId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;
}

export class SaveEvaluationDraftDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  version?: number;

  @IsOptional()
  @IsString()
  recommendation?: string;

  @IsOptional()
  @IsString()
  strengths?: string;

  @IsOptional()
  @IsString()
  concerns?: string;

  @IsOptional()
  @IsString()
  confidentialNotes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EvaluationScoreDto)
  scores?: EvaluationScoreDto[];
}

export class SubmitEvaluationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  version?: number;

  @IsString()
  recommendation!: string;

  @IsOptional()
  @IsString()
  strengths?: string;

  @IsOptional()
  @IsString()
  concerns?: string;

  @IsOptional()
  @IsString()
  confidentialNotes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EvaluationScoreDto)
  scores!: EvaluationScoreDto[];
}
