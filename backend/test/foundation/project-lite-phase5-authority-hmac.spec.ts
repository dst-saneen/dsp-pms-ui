import {
  buildProjectRequestCanonical,
  hmacProjectRequestHash,
  stableStringifyProjectPayload,
} from '../../src/modules/projects/policies/project-request-hash';
import { computeProjectAllowedActions } from '../../src/modules/projects/policies/project-allowed-actions';

describe('Project Lite Phase 5 request hash + PM authority', () => {
  it('canonicalizes payloads with sorted keys and lowercased UUIDs', () => {
    const a = stableStringifyProjectPayload({
      b: 1,
      a: 'AAAAAAAA-BBBB-1CCC-8DDD-EEEEEEEEEEEE',
    });
    const b = stableStringifyProjectPayload({
      a: 'aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee',
      b: 1,
    });
    expect(a).toBe(b);
  });

  it('HMAC differs when payload differs', () => {
    const key = Buffer.from('0123456789abcdef0123456789abcdef');
    const base = {
      formatVersion: 1,
      companyId: 'c1',
      actorUserId: 'u1',
      commandType: 'PROJECT_CREATE',
      operationId: 'op-1',
      payload: { projectName: 'A' },
    };
    const h1 = hmacProjectRequestHash(key, buildProjectRequestCanonical(base));
    const h2 = hmacProjectRequestHash(
      key,
      buildProjectRequestCanonical({
        ...base,
        payload: { projectName: 'B' },
      }),
    );
    expect(h1).not.toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('ACTIVE nested manage actions require record-level PM', () => {
    const manager = computeProjectAllowedActions({
      status: 'ACTIVE',
      archivedAt: null,
      projectManagerId: 'emp-pm',
      actor: {
        userId: 'u1',
        employeeId: 'emp-pm',
        permissions: ['projects.projects.manage'],
      },
    });
    expect(manager).toEqual(
      expect.arrayContaining(['MANAGE_TASKS', 'MANAGE_TEAM', 'MANAGE_STAGES']),
    );

    const orgOwnerOnly = computeProjectAllowedActions({
      status: 'ACTIVE',
      archivedAt: null,
      projectManagerId: 'emp-pm',
      actor: {
        userId: 'u2',
        employeeId: 'emp-other',
        permissions: ['projects.projects.manage'],
      },
    });
    expect(orgOwnerOnly).toContain('EDIT');
    expect(orgOwnerOnly).not.toContain('MANAGE_TASKS');
  });
});
