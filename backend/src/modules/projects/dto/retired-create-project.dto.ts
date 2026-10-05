import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RetiredCreateProjectDto {
  @ApiProperty()
  @IsString()
  projectCode: string;

  @ApiProperty()
  @IsString()
  projectName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  clientContact?: string;

  @ApiProperty()
  @IsUUID()
  companyId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  projectManagerId?: string;
}
