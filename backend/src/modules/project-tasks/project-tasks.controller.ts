import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';

@ApiTags('Project Tasks (retired)')
@Controller('project-tasks')
export class ProjectTasksController {
  create() {
    return rejectRetiredProjectsRoute();
  }
  findAll() {
    return rejectRetiredProjectsRoute();
  }
  findByProject() {
    return rejectRetiredProjectsRoute();
  }
  findByStage() {
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
