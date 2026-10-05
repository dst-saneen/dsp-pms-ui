import { PartialType } from '@nestjs/swagger';
import { CreateResourceTypeDto } from './create-resource-type.dto';

export class UpdateResourceTypeDto extends PartialType(CreateResourceTypeDto) {}
