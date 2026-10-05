import { Injectable } from '@nestjs/common';

import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';

@Injectable()
export class WorkLogLineService {
  create(): never {
    return rejectRetiredProjectsRoute();
  }
  findByHeader(): never {
    return rejectRetiredProjectsRoute();
  }
  findById(): never {
    return rejectRetiredProjectsRoute();
  }
  update(): never {
    return rejectRetiredProjectsRoute();
  }
  remove(): never {
    return rejectRetiredProjectsRoute();
  }
}
