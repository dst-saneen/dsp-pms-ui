import { Injectable } from '@nestjs/common';

import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';

/** Retired service — HTTP module unregistered (PRJ-P0-03/04). */
@Injectable()
export class ProjectStagesService {
  create(): never {
    return rejectRetiredProjectsRoute();
  }
  findAll(): never {
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
