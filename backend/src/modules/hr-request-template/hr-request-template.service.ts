import { Injectable } from '@nestjs/common';
import { CreateHrRequestTemplateDto } from './dto/create-hr-request-template.dto';
import { UpdateHrRequestTemplateDto } from './dto/update-hr-request-template.dto';

@Injectable()
export class HrRequestTemplateService {
  create(createHrRequestTemplateDto: CreateHrRequestTemplateDto) {
    return 'This action adds a new hrRequestTemplate';
  }

  findAll() {
    return `This action returns all hrRequestTemplate`;
  }

  findOne(id: number) {
    return `This action returns a #${id} hrRequestTemplate`;
  }

  update(id: number, updateHrRequestTemplateDto: UpdateHrRequestTemplateDto) {
    return `This action updates a #${id} hrRequestTemplate`;
  }

  remove(id: number) {
    return `This action removes a #${id} hrRequestTemplate`;
  }
}
