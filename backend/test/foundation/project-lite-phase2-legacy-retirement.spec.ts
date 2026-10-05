import { GoneException } from '@nestjs/common';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PROJECTS_ERROR_CODES } from '../../src/modules/projects/constants/projects-error-codes';
import { rejectRetiredProjectsRoute } from '../../src/modules/projects/retired/reject-retired-route';
import { ProjectStagesService } from '../../src/modules/project-stages/project-stages.service';
import { ProjectTasksService } from '../../src/modules/project-tasks/project-tasks.service';
import { ProjectTeamMembersService } from '../../src/modules/project-team-members/project-team-members.service';
import { TaskParticipantsService } from '../../src/modules/task-participants/task-participants.service';
import { TaskReviewsService } from '../../src/modules/task-reviews/task-reviews.service';
import { TaskSubmissionsService } from '../../src/modules/task-submissions/task-submissions.service';
import { TaskWorkSessionService } from '../../src/modules/task-work-session/task-work-session.service';
import { WorkLogHeaderService } from '../../src/modules/work-log-header/work-log-header.service';
import { WorkLogLineService } from '../../src/modules/work-log-line/work-log-line.service';

describe('Project Lite Phase 2 legacy surface retirement (PRJ-P0-03)', () => {
  it('rejects legacy routes with PROJECTS_LEGACY_ROUTE_DISABLED (410)', () => {
    expect(() => rejectRetiredProjectsRoute()).toThrow(GoneException);
    try {
      rejectRetiredProjectsRoute();
    } catch (error) {
      expect((error as GoneException).getResponse()).toEqual(
        expect.objectContaining({
          code: PROJECTS_ERROR_CODES.PROJECTS_LEGACY_ROUTE_DISABLED,
        }),
      );
    }
  });

  it('stubs legacy write/read services so they cannot mutate via scaffolding', () => {
    const stages = new ProjectStagesService();
    const tasks = new ProjectTasksService();
    const team = new ProjectTeamMembersService();
    const participants = new TaskParticipantsService();
    const submissions = new TaskSubmissionsService();
    const reviews = new TaskReviewsService();
    const headers = new WorkLogHeaderService();
    const lines = new WorkLogLineService();
    const sessions = new TaskWorkSessionService({} as never, {} as never);

    expect(() => stages.findAll()).toThrow(GoneException);
    expect(() => tasks.create()).toThrow(GoneException);
    expect(() => team.create()).toThrow(GoneException);
    expect(() => participants.create()).toThrow(GoneException);
    expect(() => submissions.create()).toThrow(GoneException);
    expect(() => reviews.create()).toThrow(GoneException);
    expect(() => headers.create()).toThrow(GoneException);
    expect(() => lines.create()).toThrow(GoneException);
    expect(() => sessions.startSession()).toThrow(GoneException);
    expect(() => sessions.endSession()).toThrow(GoneException);
  });

  it('does not register legacy Project modules in AppModule', () => {
    const appModulePath = join(__dirname, '../../src/app.module.ts');
    const source = readFileSync(appModulePath, 'utf8');
    const banned = [
      'ProjectTeamMembersModule',
      'ProjectStagesModule',
      'ProjectTasksModule',
      'TaskParticipantsModule',
      'TaskSubmissionsModule',
      'TaskReviewsModule',
      'TaskWorkSessionModule',
      'WorkLogHeaderModule',
      'WorkLogLineModule',
    ];
    for (const name of banned) {
      expect(source).not.toContain(name);
    }
    expect(source).toContain('ProjectsModule');
  });
});
