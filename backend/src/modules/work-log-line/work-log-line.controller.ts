import { Controller } from '@nestjs/common';

import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';

@Controller('work-log-line')
export class WorkLogLineController {
  create() {
    return rejectRetiredProjectsRoute();
  }
  findByHeader() {
    return rejectRetiredProjectsRoute();
  }
  findById() {
    return rejectRetiredProjectsRoute();
  }
  update() {
    return rejectRetiredProjectsRoute();
  }
  remove() {
    return rejectRetiredProjectsRoute();
  }
}
