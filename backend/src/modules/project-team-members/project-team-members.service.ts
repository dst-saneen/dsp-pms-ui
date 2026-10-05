import { Injectable } from '@nestjs/common';

import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';

@Injectable()
export class ProjectTeamMembersService {
  create(): never {
    return rejectRetiredProjectsRoute();
  }
  findByProject(): never {
    return rejectRetiredProjectsRoute();
  }
  update(): never {
    return rejectRetiredProjectsRoute();
  }
  remove(): never {
    return rejectRetiredProjectsRoute();
  }
}
