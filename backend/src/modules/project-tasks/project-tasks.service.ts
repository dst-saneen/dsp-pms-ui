import { Injectable } from '@nestjs/common';

import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';

@Injectable()
export class ProjectTasksService {
  create(): never {
    return rejectRetiredProjectsRoute();
  }
  findAll(): never {
    return rejectRetiredProjectsRoute();
  }
  findByProject(): never {
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
