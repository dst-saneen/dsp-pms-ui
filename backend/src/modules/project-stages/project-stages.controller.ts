import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { rejectRetiredProjectsRoute } from '../projects/retired/reject-retired-route';

/**
 * @deprecated Unregistered from AppModule (PRJ-P0-03). Kept so accidental
 * re-imports still fail closed.
 */
@ApiTags('Project Stages (retired)')
@Controller('project-stages')
export class ProjectStagesController {
  create() {
    return rejectRetiredProjectsRoute();
  }
  findAll() {
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
