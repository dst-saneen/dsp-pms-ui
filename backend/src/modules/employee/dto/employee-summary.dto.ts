import { ApiProperty } from '@nestjs/swagger';

export class EmployeeSummaryDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  value: number;
}
