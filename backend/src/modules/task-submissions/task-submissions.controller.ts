import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';

@ApiTags('Task Submissions (retired)')
@Controller('task-submissions')
export class TaskSubmissionsController {
  create() {
    return rejectRetiredProjectsRoute();
  }
  findByTask() {
    return rejectRetiredProjectsRoute();
  }
  findOne() {
    return rejectRetiredProjectsRoute();
  }
  update() {
    return rejectRetiredProjectsRoute();
  }
  remove() {
    return rejectRetiredProjectsRoute();
  }
}
