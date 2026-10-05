import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';

@ApiTags('Task Reviews (retired)')
@Controller('task-reviews')
export class TaskReviewsController {
  create() {
    return rejectRetiredProjectsRoute();
  }
  findBySubmission() {
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
