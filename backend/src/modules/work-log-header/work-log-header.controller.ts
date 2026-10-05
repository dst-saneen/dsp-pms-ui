import { Controller } from '@nestjs/common';

import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';

@Controller('work-log-header')
export class WorkLogHeaderController {
  create() {
    return rejectRetiredProjectsRoute();
  }
  findAllByEmployee() {
    return rejectRetiredProjectsRoute();
  }
  findById() {
    return rejectRetiredProjectsRoute();
  }
  update() {
    return rejectRetiredProjectsRoute();
  }
  submit() {
    return rejectRetiredProjectsRoute();
  }
  remove() {
    return rejectRetiredProjectsRoute();
  }
}
