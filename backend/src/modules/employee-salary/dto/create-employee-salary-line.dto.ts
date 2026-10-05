import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class CreateEmployeeSalaryLineDto {
  @ApiProperty({
    example: 'salary-component-uuid',
  })
  @IsUUID()
  salaryComponentId: string;

  @ApiProperty({
    example: 80000,
  })
  @IsNumber()
  @Min(0)
  amount: number;
}
