import { Injectable } from '@nestjs/common';

import { rejectRetiredProjectsRoute } from '../../projects/retired/reject-retired-route';

@Injectable()
export class TaskParticipantService {
  create(): never {
    return rejectRetiredProjectsRoute();
  }
  findByTask(): never {
    return rejectRetiredProjectsRoute();
  }
  update(): never {
    return rejectRetiredProjectsRoute();
  }
  remove(): never {
    return rejectRetiredProjectsRoute();
  }
}
