import { PartialType } from '@nestjs/swagger';
import { CreateHrRequestDto } from './create-hr-request.dto';

export class UpdateHrRequestDto extends PartialType(CreateHrRequestDto) {}
