import { Injectable } from '@nestjs/common';

import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';

@Injectable()
export class TaskReviewsService {
  create(): never {
    return rejectRetiredProjectsRoute();
  }
  findBySubmission(): never {
    return rejectRetiredProjectsRoute();
  }
  findOne(): never {
    return rejectRetiredProjectsRoute();
  }
  update(): never {
    return rejectRetiredProjectsRoute();
  }
  remove(): never {
    return rejectRetiredProjectsRoute();
  }
}
