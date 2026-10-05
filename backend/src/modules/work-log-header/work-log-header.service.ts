import { Injectable } from '@nestjs/common';

import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';

@Injectable()
export class WorkLogHeaderService {
  create(): never {
    return rejectRetiredProjectsRoute();
  }
  findAllByEmployee(): never {
    return rejectRetiredProjectsRoute();
  }
  findById(): never {
    return rejectRetiredProjectsRoute();
  }
  update(): never {
    return rejectRetiredProjectsRoute();
  }
  submit(): never {
    return rejectRetiredProjectsRoute();
  }
  remove(): never {
    return rejectRetiredProjectsRoute();
  }
}
