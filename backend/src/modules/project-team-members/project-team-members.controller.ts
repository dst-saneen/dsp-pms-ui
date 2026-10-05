import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';

@ApiTags('Project Team Members (retired)')
@Controller('project-team-members')
export class ProjectTeamMembersController {
  create() {
    return rejectRetiredProjectsRoute();
  }
  findByProject() {
    return rejectRetiredProjectsRoute();
  }
  update() {
    return rejectRetiredProjectsRoute();
  }
  remove() {
    return rejectRetiredProjectsRoute();
  }
}
