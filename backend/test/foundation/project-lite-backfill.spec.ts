import {
  inferProjectType,
  mapProjectStageStatusV2,
  mapProjectStatusV2,
  mapProjectTaskStatusV2,
  mapProjectTeamMemberStatusV2,
  mapTaskParticipantStatusV2,
  mapTaskReviewDecisionV2,
  mapTaskSubmissionStatusV2,
  mapWorkLogStatusV2,
  shouldCopyCurrencyCode,
  shouldCopyExpectedIncome,
} from '../../src/modules/projects/migration/project-lite-backfill.rules';
import path from 'node:path';

import { loadProjectLiteClientMapping } from '../../src/modules/projects/migration/project-lite-mapping.loader';
import { runProjectLiteBackfill } from '../../src/modules/projects/migration/project-lite-backfill.service';

describe('project-lite-backfill.rules', () => {
  it('maps project statuses per plan §9', () => {
    expect(mapProjectStatusV2('DRAFT')).toBe('DRAFT');
    expect(mapProjectStatusV2('PROPOSAL')).toBe('DRAFT');
    expect(mapProjectStatusV2('APPROVED')).toBe('DRAFT');
    expect(mapProjectStatusV2('ACTIVE')).toBe('ACTIVE');
    expect(mapProjectStatusV2('ON HOLD')).toBe('ON_HOLD');
    expect(mapProjectStatusV2('CLOSED')).toBe('COMPLETED');
    expect(mapProjectStatusV2('CANCELLED')).toBe('CANCELLED');
    expect(mapProjectStatusV2('WEIRD')).toBeNull();
  });

  it('maps stage and task statuses deterministically', () => {
    expect(mapProjectStageStatusV2('OPEN')).toBe('PLANNED');
    expect(mapProjectStageStatusV2('ACTIVE')).toBe('ACTIVE');
    expect(mapProjectTaskStatusV2('NOT_STARTED')).toBe('OPEN');
    expect(mapProjectTaskStatusV2('IN PROGRESS')).toBe('IN_PROGRESS');
    expect(mapProjectTaskStatusV2('IN_REVIEW')).toBe('WAITING_REVIEW');
    expect(mapProjectTaskStatusV2('mystery')).toBeNull();
  });

  it('maps team, participant, work-log, submission and review values', () => {
    expect(
      mapProjectTeamMemberStatusV2({
        isActive: true,
        allocationStatus: 'ACTIVE',
      }),
    ).toBe('ACTIVE');
    expect(
      mapProjectTeamMemberStatusV2({
        isActive: false,
        allocationStatus: 'ENDED',
      }),
    ).toBe('ENDED');
    expect(mapTaskParticipantStatusV2('PENDING')).toBe('ACTIVE');
    expect(mapTaskParticipantStatusV2('REMOVED')).toBe('ENDED');
    expect(mapWorkLogStatusV2('REJECTED')).toBe('RETURNED');
    expect(mapTaskSubmissionStatusV2('COMPLETED')).toBe('ACCEPTED');
    expect(mapTaskReviewDecisionV2('APPROVED')).toBe('COMPLETE');
    expect(mapTaskReviewDecisionV2('???')).toBeNull();
  });

  it('infers CLIENT only from legacy evidence and never invents income/currency', () => {
    expect(
      inferProjectType({
        clientName: 'Acme',
        clientContact: null,
        contractValue: null,
      }),
    ).toBe('CLIENT');
    expect(
      inferProjectType({
        clientName: null,
        clientContact: null,
        contractValue: null,
      }),
    ).toBe('INTERNAL');
    expect(
      shouldCopyExpectedIncome({
        expectedIncome: null,
        contractValue: '100.00',
      }),
    ).toBe(true);
    expect(
      shouldCopyExpectedIncome({
        expectedIncome: '50.00',
        contractValue: '100.00',
      }),
    ).toBe(false);
    expect(
      shouldCopyCurrencyCode({ currencyCode: null, currency: 'AED' }),
    ).toBe(true);
  });
});

describe('project-lite-mapping.loader', () => {
  it('rejects invalid mapping files', () => {
    const mappingPath = path.join(__dirname, 'fixtures-does-not-exist.json');
    expect(() => loadProjectLiteClientMapping(mappingPath)).toThrow();
  });

  it('returns an empty mapping when path is omitted', () => {
    expect(loadProjectLiteClientMapping(undefined)).toEqual({
      version: 1,
      businessPartyByProjectId: {},
    });
  });
});

describe('project-lite-backfill.service', () => {
  it('dry-runs deterministic updates without writing when apply=false', async () => {
    const execute = jest.fn();
    const prisma = {
      $queryRawUnsafe: jest.fn((sql: string) => {
        if (sql.includes('pg_catalog.pg_class')) {
          return Promise.resolve([]);
        }
        if (sql.includes('FROM projects') && sql.includes('clientName')) {
          return Promise.resolve([
            {
              id: 'p1',
              status: 'PROPOSAL',
              statusV2: null,
              projectType: null,
              clientName: 'Acme',
              clientContact: null,
              contractValue: '10.00',
              expectedIncome: null,
              currency: 'AED',
              currencyCode: null,
              businessPartyId: null,
              companyId: 'c1',
            },
          ]);
        }
        if (sql.includes('FROM project_stages')) {
          return Promise.resolve([
            { id: 's1', status: 'OPEN', statusV2: null },
          ]);
        }
        if (sql.includes('FROM project_tasks')) {
          return Promise.resolve([
            { id: 't1', status: 'NOT_STARTED', statusV2: null },
          ]);
        }
        if (sql.includes('FROM project_team_members')) {
          return Promise.resolve([
            {
              id: 'm1',
              isActive: true,
              allocationStatus: 'ACTIVE',
              statusV2: null,
            },
          ]);
        }
        if (sql.includes('FROM task_participants')) {
          return Promise.resolve([
            { id: 'tp1', status: 'PENDING', statusV2: null },
          ]);
        }
        if (sql.includes('FROM work_log_headers')) {
          return Promise.resolve([
            {
              id: 'h1',
              status: 'DRAFT',
              statusV2: null,
              periodStart: null,
              periodEnd: null,
            },
          ]);
        }
        if (sql.includes('FROM task_submissions')) {
          return Promise.resolve([
            { id: 'sub1', status: 'SUBMITTED', statusV2: null },
          ]);
        }
        if (sql.includes('FROM task_reviews')) {
          return Promise.resolve([
            { id: 'r1', decision: 'APPROVED', decisionV2: null },
          ]);
        }
        return Promise.resolve([]);
      }),
      $executeRawUnsafe: execute,
    };

    const report = await runProjectLiteBackfill(
      prisma,
      { databaseName: 'test', databaseSchema: 'public' },
      { apply: false },
    );

    expect(execute).not.toHaveBeenCalled();
    expect(report.dryRun).toBe(true);
    expect(report.updates.projectStatuses).toBe(1);
    expect(report.updates.projectTypes).toBe(1);
    expect(report.updates.expectedIncomeCopied).toBe(1);
    expect(report.updates.currencyCodeCopied).toBe(1);
    expect(report.updates.stageStatuses).toBe(1);
    expect(report.updates.taskStatuses).toBe(1);
    expect(report.notes.join(' ')).toContain('Dry-run only');
  });

  it('skips client mapping when business_parties is absent', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn((sql: string) => {
        if (sql.includes('pg_catalog.pg_class')) {
          return Promise.resolve([]);
        }
        if (sql.includes('FROM projects') && sql.includes('clientName')) {
          return Promise.resolve([
            {
              id: 'p1',
              status: 'ACTIVE',
              statusV2: 'ACTIVE',
              projectType: 'CLIENT',
              clientName: 'Acme',
              clientContact: null,
              contractValue: null,
              expectedIncome: null,
              currency: null,
              currencyCode: null,
              businessPartyId: null,
              companyId: 'c1',
            },
          ]);
        }
        return Promise.resolve([]);
      }),
      $executeRawUnsafe: jest.fn(),
    };

    const report = await runProjectLiteBackfill(
      prisma,
      { databaseName: 'test', databaseSchema: 'public' },
      {
        apply: true,
        mapping: {
          version: 1,
          businessPartyByProjectId: { p1: 'party-1' },
        },
      },
    );

    expect(report.updates.skippedClientMapping).toBe(1);
    expect(report.notes.join(' ')).toContain('business_parties');
  });
});
