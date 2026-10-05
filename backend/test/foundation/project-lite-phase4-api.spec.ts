import {
  canTransitionProject,
  canTransitionStage,
  canTransitionTask,
} from '../../src/modules/projects/policies/project-transitions';
import { computeProjectAllowedActions } from '../../src/modules/projects/policies/project-allowed-actions';
import { computeProjectTaskAllowedActions } from '../../src/modules/projects/policies/project-task-allowed-actions';
import { PROJECTS_PERMISSIONS } from '../../src/modules/projects/constants/projects-permissions';

describe('Project Lite Phase 4 transitions', () => {
  it('allows the locked project lifecycle graph', () => {
    expect(canTransitionProject('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransitionProject('ACTIVE', 'ON_HOLD')).toBe(true);
    expect(canTransitionProject('ON_HOLD', 'ACTIVE')).toBe(true);
    expect(canTransitionProject('ACTIVE', 'COMPLETED')).toBe(true);
    expect(canTransitionProject('DRAFT', 'CANCELLED')).toBe(true);
    expect(canTransitionProject('COMPLETED', 'ACTIVE')).toBe(false);
  });

  it('allows the locked stage and task graphs', () => {
    expect(canTransitionStage('PLANNED', 'ACTIVE')).toBe(true);
    expect(canTransitionStage('ACTIVE', 'COMPLETED')).toBe(true);
    expect(canTransitionTask('OPEN', 'ASSIGNED')).toBe(true);
    expect(canTransitionTask('ASSIGNED', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionTask('WAITING_REVIEW', 'IN_PROGRESS')).toBe(true);
    expect(canTransitionTask('WAITING_REVIEW', 'COMPLETED')).toBe(true);
    expect(canTransitionTask('COMPLETED', 'OPEN')).toBe(false);
  });
});

describe('Project Lite Phase 4 allowedActions', () => {
  const manager = {
    userId: 'u1',
    employeeId: 'e-pm',
    permissions: [PROJECTS_PERMISSIONS.MANAGE],
  };

  const worker = {
    userId: 'u2',
    employeeId: 'e-worker',
    permissions: [PROJECTS_PERMISSIONS.TASKS_WORK],
  };

  it('returns draft manager actions', () => {
    expect(
      computeProjectAllowedActions({
        status: 'DRAFT',
        archivedAt: null,
        projectManagerId: 'e-pm',
        actor: manager,
      }),
    ).toEqual(
      expect.arrayContaining(['EDIT', 'ACTIVATE', 'CANCEL', 'ARCHIVE']),
    );
  });

  it('returns empty actions for archived projects', () => {
    expect(
      computeProjectAllowedActions({
        status: 'ACTIVE',
        archivedAt: new Date(),
        projectManagerId: 'e-pm',
        actor: manager,
      }),
    ).toEqual([]);
  });

  it('returns assignee start/submit actions', () => {
    const actions = computeProjectTaskAllowedActions({
      projectStatus: 'ACTIVE',
      taskStatus: 'ASSIGNED',
      projectManagerId: 'e-pm',
      activeParticipantEmployeeIds: ['e-worker'],
      actor: worker,
    });
    expect(actions).toEqual(expect.arrayContaining(['START', 'LOG_TIME']));
  });

  it('returns PM review actions while waiting review', () => {
    const actions = computeProjectTaskAllowedActions({
      projectStatus: 'ACTIVE',
      taskStatus: 'WAITING_REVIEW',
      projectManagerId: 'e-pm',
      activeParticipantEmployeeIds: ['e-worker'],
      actor: manager,
    });
    expect(actions).toEqual(
      expect.arrayContaining(['RETURN', 'COMPLETE', 'CANCEL']),
    );
  });
});
