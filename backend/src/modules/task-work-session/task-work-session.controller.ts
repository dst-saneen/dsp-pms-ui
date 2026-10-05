import { Controller } from '@nestjs/common';

import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';

@Controller('task-work-session')
export class TaskWorkSessionController {
  startSession() {
    return rejectRetiredProjectsRoute();
  }
  endSession() {
    return rejectRetiredProjectsRoute();
  }
}
