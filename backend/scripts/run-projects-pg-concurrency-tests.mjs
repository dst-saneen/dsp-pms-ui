/**
 * Opt-in real PostgreSQL evidence for Project Lite command concurrency.
 *
 * The runner uses independent sessions so PostgreSQL, rather than an in-memory
 * mock, evaluates the Project parent-row lock, version checks, participant
 * partial unique index and the daily-hours aggregate trigger. It accepts only
 * the isolated local database and removes every fixture row in finally.
 *
 * Example:
 *   $env:PROJECTS_PG_CONCURRENCY_TESTS='1'
 *   $env:DATABASE_URL='postgresql://postgres@127.0.0.1:55439/erp_lite_from_zero'
 *   $env:DATABASE_SCHEMA='dsp_pms'
 *   & 'C:\Program Files\nodejs\node.exe' scripts/run-projects-pg-concurrency-tests.mjs
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA;
const fixture = `pg_project_lite_${randomUUID().replaceAll('-', '')}`;
const workDate = '2026-09-01T00:00:00.000Z';
const ids = Object.fromEntries(
  [
    'company', 'branch', 'department', 'employeeA', 'employeeB', 'project',
    'stage', 'completionTask', 'assignmentTask', 'reassignmentTask',
    'indexGuardTask', 'workLogHeader',
  ].map((name) => [name, randomUUID()]),
);

function assertSafeTarget() {
  assert.equal(process.env.PROJECTS_PG_CONCURRENCY_TESTS, '1', 'Set PROJECTS_PG_CONCURRENCY_TESTS=1 to opt in.');
  assert.ok(databaseUrl, 'DATABASE_URL is required.');
  assert.equal(schema, 'dsp_pms', 'DATABASE_SCHEMA must be dsp_pms.');
  const target = new URL(databaseUrl);
  assert.equal(target.hostname, '127.0.0.1', 'Only the isolated local host is allowed.');
  assert.equal(target.port, '55439', 'Only the isolated Project Lite port is allowed.');
  assert.equal(target.pathname, '/erp_lite_from_zero', 'Only the isolated Project Lite database is allowed.');
}

async function openClient() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query('SET search_path TO dsp_pms, public');
  return client;
}

async function transaction(name, work) {
  const client = await openClient();
  try {
    await client.query('BEGIN');
    const value = await work(client);
    await client.query('COMMIT');
    return { name, ok: true, value };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve command error */ }
    return {
      name,
      ok: false,
      error: {
        code: typeof error?.code === 'string' ? error.code : undefined,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  } finally {
    await client.end();
  }
}

function reject(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function deferred() {
  let resolve;
  const promise = new Promise((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

function assertResult(result, expectedOk, expectedCode) {
  assert.equal(result.ok, expectedOk, `${result.name}: ${JSON.stringify(result)}`);
  if (!expectedOk) assert.equal(result.error.code, expectedCode, `${result.name}: ${JSON.stringify(result)}`);
}

async function seed(client) {
  await client.query(
    `INSERT INTO companies (id, "companyCode", "companyName", "isActive", "createdAt", "updatedAt")
     VALUES ($1, $2, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [ids.company, fixture],
  );
  await client.query(
    `INSERT INTO branches (id, "companyId", "branchCode", "branchName", timezone, "isActive", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $3, 'Asia/Kolkata', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [ids.branch, ids.company, fixture],
  );
  await client.query(
    `INSERT INTO departments (id, "companyId", "branchId", "departmentCode", "departmentName", "isActive", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [ids.department, ids.company, ids.branch, fixture],
  );
  for (const [employeeId, suffix] of [[ids.employeeA, 'a'], [ids.employeeB, 'b']]) {
    await client.query(
      `INSERT INTO employees (id, "employeeCode", "companyId", "branchId", "departmentId", "firstName", "employmentStatus", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [employeeId, `${fixture}_${suffix}`, ids.company, ids.branch, ids.department, `Project ${suffix.toUpperCase()}`],
    );
  }
  await client.query(
    `INSERT INTO projects (id, "companyId", "branchId", "projectCode", "projectName", status, "statusV2", "projectType", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $4, 'ACTIVE', 'ACTIVE', 'INTERNAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [ids.project, ids.company, ids.branch, fixture],
  );
  await client.query(
    `INSERT INTO project_stages (id, "companyId", "projectId", "stageCode", "stageName", "sequenceNo", status, "statusV2", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $4, 1, 'COMPLETED', 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [ids.stage, ids.company, ids.project, fixture],
  );
  for (const [taskId, suffix, status] of [
    [ids.completionTask, 'completion', 'COMPLETED'],
    [ids.assignmentTask, 'assignment', 'OPEN'],
    [ids.reassignmentTask, 'reassignment', 'ASSIGNED'],
    [ids.indexGuardTask, 'index', 'OPEN'],
  ]) {
    const taskCode = `${fixture}_${suffix}`;
    await client.query(
      `INSERT INTO project_tasks (id, "companyId", "projectId", "stageId", "taskCode", "taskName", status, "statusV2", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7::"ProjectTaskStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [taskId, ids.company, ids.project, ids.stage, taskCode, status, status],
    );
  }
  for (const employeeId of [ids.employeeA, ids.employeeB]) {
    await client.query(
      `INSERT INTO project_team_members (id, "companyId", "projectId", "employeeId", role, "allocationPercentage", "isActive", "allocationStatus", "statusV2", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'MEMBER', 100, true, 'ACTIVE', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [randomUUID(), ids.company, ids.project, employeeId],
    );
  }
  await participantInsert(client, ids.reassignmentTask, ids.employeeA);
  await client.query(
    `INSERT INTO work_log_headers (id, "companyId", "branchId", "employeeId", "startDate", "endDate", "periodStart", "periodEnd", "totalHours", status, "statusV2", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5::timestamp, $5::timestamp, $6::date, $6::date, 0, 'DRAFT', 'DRAFT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [ids.workLogHeader, ids.company, ids.branch, ids.employeeA, workDate, workDate],
  );
}

async function participantInsert(client, taskId, employeeId) {
  await client.query(
    `INSERT INTO task_participants (id, "companyId", "projectId", "taskId", "employeeId", role, status, "statusV2", "assignedAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'ASSIGNEE', 'ACTIVE', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [randomUUID(), ids.company, ids.project, taskId, employeeId],
  );
}

async function lockActiveProject(client) {
  const project = await client.query(
    `SELECT "statusV2" FROM projects WHERE id = $1 AND "companyId" = $2 FOR UPDATE`,
    [ids.project, ids.company],
  );
  assert.equal(project.rowCount, 1, 'fixture project not found');
  if (project.rows[0].statusV2 !== 'ACTIVE') reject('PROJECT_STATE_CHANGED');
}

async function taskVersion(client, taskId, expectedVersion) {
  const task = await client.query(
    `SELECT version, "statusV2" FROM project_tasks WHERE id = $1 AND "companyId" = $2 AND "projectId" = $3`,
    [taskId, ids.company, ids.project],
  );
  assert.equal(task.rowCount, 1, 'fixture task not found');
  if (task.rows[0].version !== expectedVersion) reject('TASK_STATE_CHANGED');
  return task.rows[0];
}

async function activeTeamMember(client, employeeId) {
  const member = await client.query(
    `SELECT 1 FROM project_team_members WHERE "companyId" = $1 AND "projectId" = $2 AND "employeeId" = $3 AND "statusV2" = 'ACTIVE'`,
    [ids.company, ids.project, employeeId],
  );
  if (member.rowCount !== 1) reject('PROJECT_MEMBER_REQUIRED');
}

async function completionVsChildMutation() {
  const completionLock = deferred();
  const completion = transaction('project completion', async (client) => {
    await lockActiveProject(client);
    completionLock.resolve();
    await client.query('SELECT pg_sleep(0.15)');
    await client.query(
      `UPDATE projects SET status = 'COMPLETED', "statusV2" = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP, version = version + 1
       WHERE id = $1 AND "companyId" = $2`,
      [ids.project, ids.company],
    );
  });
  await completionLock.promise;
  const child = transaction('child mutation stale retry', async (client) => {
    await lockActiveProject(client);
    await client.query(`UPDATE project_tasks SET "taskName" = 'must not persist' WHERE id = $1`, [ids.assignmentTask]);
  });
  const [completed, rejected] = await Promise.all([completion, child]);
  assertResult(completed, true);
  assertResult(rejected, false, 'PROJECT_STATE_CHANGED');

  const client = await openClient();
  try {
    const state = await client.query(
      `SELECT p."statusV2", t."taskName" FROM projects p CROSS JOIN project_tasks t WHERE p.id = $1 AND t.id = $2`,
      [ids.project, ids.assignmentTask],
    );
    assert.equal(state.rows[0].statusV2, 'COMPLETED');
    assert.notEqual(state.rows[0].taskName, 'must not persist');
    await client.query(
      `UPDATE projects SET status = 'ACTIVE', "statusV2" = 'ACTIVE', "completedAt" = NULL, version = version + 1 WHERE id = $1`,
      [ids.project],
    );
  } finally { await client.end(); }
}

async function assignmentRace() {
  const firstLock = deferred();
  const assign = (name, wait) => transaction(name, async (client) => {
    await lockActiveProject(client);
    if (wait) { firstLock.resolve(); await client.query('SELECT pg_sleep(0.15)'); }
    const task = await taskVersion(client, ids.assignmentTask, 1);
    if (!['OPEN', 'ASSIGNED'].includes(task.statusV2)) reject('TASK_STATE_CHANGED');
    await activeTeamMember(client, ids.employeeA);
    const duplicate = await client.query(
      `SELECT 1 FROM task_participants WHERE "taskId" = $1 AND "employeeId" = $2 AND role = 'ASSIGNEE' AND "statusV2" = 'ACTIVE'`,
      [ids.assignmentTask, ids.employeeA],
    );
    if (duplicate.rowCount) reject('TASK_STATE_CHANGED');
    await participantInsert(client, ids.assignmentTask, ids.employeeA);
    const updated = await client.query(
      `UPDATE project_tasks SET status = 'ASSIGNED', "statusV2" = 'ASSIGNED', version = version + 1 WHERE id = $1 AND version = 1`,
      [ids.assignmentTask],
    );
    if (updated.rowCount !== 1) reject('TASK_STATE_CHANGED');
  });
  const first = assign('task assignment', true);
  await firstLock.promise;
  const stale = assign('task assignment stale retry', false);
  const [assigned, rejected] = await Promise.all([first, stale]);
  assertResult(assigned, true);
  assertResult(rejected, false, 'TASK_STATE_CHANGED');
}

async function reassignVsUnassignRace() {
  const reassignLock = deferred();
  const reassign = transaction('task reassign', async (client) => {
    await lockActiveProject(client);
    reassignLock.resolve();
    await client.query('SELECT pg_sleep(0.15)');
    const task = await taskVersion(client, ids.reassignmentTask, 1);
    if (!['ASSIGNED', 'IN_PROGRESS'].includes(task.statusV2)) reject('TASK_STATE_CHANGED');
    await activeTeamMember(client, ids.employeeB);
    await client.query(
      `UPDATE task_participants SET status = 'ENDED', "statusV2" = 'ENDED', "endedAt" = CURRENT_TIMESTAMP, version = version + 1
       WHERE "taskId" = $1 AND "statusV2" = 'ACTIVE'`,
      [ids.reassignmentTask],
    );
    await participantInsert(client, ids.reassignmentTask, ids.employeeB);
    const updated = await client.query(`UPDATE project_tasks SET version = version + 1 WHERE id = $1 AND version = 1`, [ids.reassignmentTask]);
    if (updated.rowCount !== 1) reject('TASK_STATE_CHANGED');
  });
  await reassignLock.promise;
  const unassign = transaction('task unassign stale retry', async (client) => {
    await lockActiveProject(client);
    await taskVersion(client, ids.reassignmentTask, 1);
    await client.query(
      `UPDATE task_participants SET status = 'ENDED', "statusV2" = 'ENDED', "endedAt" = CURRENT_TIMESTAMP WHERE "taskId" = $1 AND "statusV2" = 'ACTIVE'`,
      [ids.reassignmentTask],
    );
  });
  const [reassigned, rejected] = await Promise.all([reassign, unassign]);
  assertResult(reassigned, true);
  assertResult(rejected, false, 'TASK_STATE_CHANGED');

  const client = await openClient();
  try {
    const active = await client.query(`SELECT "employeeId" FROM task_participants WHERE "taskId" = $1 AND "statusV2" = 'ACTIVE'`, [ids.reassignmentTask]);
    assert.deepEqual(active.rows.map((row) => row.employeeId), [ids.employeeB]);
  } finally { await client.end(); }
}

async function participantUniqueIndexRace() {
  const insert = (name) => transaction(name, (client) => participantInsert(client, ids.indexGuardTask, ids.employeeA));
  const [first, second] = await Promise.all([insert('participant index one'), insert('participant index two')]);
  assert.equal([first.ok, second.ok].filter(Boolean).length, 1, JSON.stringify([first, second]));
  const rejected = first.ok ? second : first;
  assert.equal(rejected.error.code, '23505', JSON.stringify(rejected));
}

async function dailyHoursRace() {
  const write = (name) => transaction(name, (client) => client.query(
    `INSERT INTO work_log_lines (id, "companyId", "branchId", "employeeId", "workLogHeaderId", "taskId", "workDate", hours, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, 13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [randomUUID(), ids.company, ids.branch, ids.employeeA, ids.workLogHeader, ids.assignmentTask, workDate],
  ));
  const [first, second] = await Promise.all([write('daily hours one'), write('daily hours two')]);
  assert.equal([first.ok, second.ok].filter(Boolean).length, 1, JSON.stringify([first, second]));
  const rejected = first.ok ? second : first;
  assert.equal(rejected.error.code, 'P0001', JSON.stringify(rejected));
  assert.match(rejected.error.message, /TIMESHEET_DAILY_HOURS_EXCEEDED/);

  const client = await openClient();
  try {
    const total = await client.query(
      `SELECT "totalHours" FROM project_daily_time_totals WHERE "companyId" = $1 AND "employeeId" = $2 AND "workDate" = $3::date`,
      [ids.company, ids.employeeA, workDate],
    );
    assert.equal(total.rowCount, 1);
    assert.equal(String(total.rows[0].totalHours), '13.00');
  } finally { await client.end(); }
}

async function cleanup() {
  const client = await openClient();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM work_log_lines WHERE "companyId" = $1', [ids.company]);
    await client.query('DELETE FROM work_log_headers WHERE "companyId" = $1', [ids.company]);
    await client.query('DELETE FROM project_daily_time_totals WHERE "companyId" = $1', [ids.company]);
    await client.query('DELETE FROM task_participants WHERE "companyId" = $1', [ids.company]);
    await client.query('DELETE FROM project_team_members WHERE "companyId" = $1', [ids.company]);
    await client.query('DELETE FROM project_tasks WHERE "companyId" = $1', [ids.company]);
    await client.query('DELETE FROM project_stages WHERE "companyId" = $1', [ids.company]);
    await client.query('DELETE FROM projects WHERE "companyId" = $1', [ids.company]);
    await client.query('DELETE FROM employees WHERE "companyId" = $1', [ids.company]);
    await client.query('DELETE FROM departments WHERE "companyId" = $1', [ids.company]);
    await client.query('DELETE FROM branches WHERE "companyId" = $1', [ids.company]);
    await client.query('DELETE FROM companies WHERE id = $1', [ids.company]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}

async function main() {
  assertSafeTarget();
  const setup = await openClient();
  try {
    await seed(setup);
  } catch (error) {
    await setup.end();
    await cleanup();
    throw error;
  }
  await setup.end();
  try {
    await completionVsChildMutation();
    await assignmentRace();
    await reassignVsUnassignRace();
    await participantUniqueIndexRace();
    await dailyHoursRace();
    console.log('Project Lite PostgreSQL concurrency evidence passed.');
  } finally {
    await cleanup();
    console.log('Project Lite PostgreSQL concurrency fixture cleaned up.');
  }
}

await main();
