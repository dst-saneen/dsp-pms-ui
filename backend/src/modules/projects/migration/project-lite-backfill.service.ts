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
} from './project-lite-backfill.rules';
import { loadProjectLiteClientMapping } from './project-lite-mapping.loader';
import type { ProjectLiteClientMappingFile } from './project-lite-mapping.types';
import {
  runProjectLitePreflight,
  type ProjectLitePreflightReport,
  type ProjectLiteQueryClient,
} from './project-lite-preflight.service';

export interface ProjectLiteBackfillOptions {
  apply: boolean;
  mapping?: ProjectLiteClientMappingFile;
  mappingPath?: string;
}

export interface ProjectLiteBackfillReport {
  generatedAt: string;
  dryRun: boolean;
  preflight: ProjectLitePreflightReport;
  updates: {
    projectStatuses: number;
    projectTypes: number;
    expectedIncomeCopied: number;
    currencyCodeCopied: number;
    stageStatuses: number;
    taskStatuses: number;
    teamMemberStatuses: number;
    participantStatuses: number;
    workLogStatuses: number;
    workLogPeriods: number;
    submissionStatuses: number;
    reviewDecisions: number;
    businessPartyMapped: number;
    skippedAmbiguous: number;
    skippedClientMapping: number;
  };
  blocked: boolean;
  notes: string[];
}

type ExecClient = ProjectLiteQueryClient & {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
};

type ProjectRow = {
  id: string;
  status: string;
  statusV2: string | null;
  projectType: string | null;
  clientName: string | null;
  clientContact: string | null;
  contractValue: string | number | null;
  expectedIncome: string | number | null;
  currency: string | null;
  currencyCode: string | null;
  businessPartyId: string | null;
  companyId: string;
};

function asRows<T>(rows: unknown): T[] {
  return Array.isArray(rows) ? (rows as T[]) : [];
}

async function tableExists(
  prisma: ProjectLiteQueryClient,
  tableName: string,
): Promise<boolean> {
  const rows = asRows<{ id: string }>(
    await prisma.$queryRawUnsafe(
      `
        SELECT c.oid::text AS id
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
          AND c.relname = '${tableName.replace(/'/g, "''")}'
          AND n.nspname = current_schema()
        LIMIT 1
      `,
    ),
  );
  return rows.length > 0;
}

export async function runProjectLiteBackfill(
  prisma: ExecClient,
  meta: { databaseName: string; databaseSchema: string },
  options: ProjectLiteBackfillOptions,
): Promise<ProjectLiteBackfillReport> {
  const preflight = await runProjectLitePreflight(prisma, meta);
  const mapping =
    options.mapping ?? loadProjectLiteClientMapping(options.mappingPath);
  const notes: string[] = [];
  const updates = {
    projectStatuses: 0,
    projectTypes: 0,
    expectedIncomeCopied: 0,
    currencyCodeCopied: 0,
    stageStatuses: 0,
    taskStatuses: 0,
    teamMemberStatuses: 0,
    participantStatuses: 0,
    workLogStatuses: 0,
    workLogPeriods: 0,
    submissionStatuses: 0,
    reviewDecisions: 0,
    businessPartyMapped: 0,
    skippedAmbiguous: 0,
    skippedClientMapping: 0,
  };

  const blocked = preflight.blockingExceptionCount > 0;
  if (blocked) {
    notes.push(
      'Blocking preflight findings present. Deterministic status/type backfill still runs for known rows; contract migration remains prohibited.',
    );
  }

  const projects = asRows<ProjectRow>(
    await prisma.$queryRawUnsafe(`
      SELECT
        id, status, "statusV2", "projectType",
        "clientName", "clientContact", "contractValue", "expectedIncome",
        currency, "currencyCode", "businessPartyId", "companyId"
      FROM projects
      ORDER BY id
    `),
  );

  for (const project of projects) {
    const statusV2 = mapProjectStatusV2(project.status);
    if (!statusV2) {
      if (!project.statusV2) {
        updates.skippedAmbiguous += 1;
      }
    } else if (!project.statusV2 && options.apply) {
      await prisma.$executeRawUnsafe(
        `UPDATE projects SET "statusV2" = $1::"ProjectStatus" WHERE id = $2 AND "statusV2" IS NULL`,
        statusV2,
        project.id,
      );
      updates.projectStatuses += 1;
    } else if (!project.statusV2) {
      updates.projectStatuses += 1;
    }

    if (!project.projectType) {
      const projectType = inferProjectType(project);
      if (options.apply) {
        await prisma.$executeRawUnsafe(
          `UPDATE projects SET "projectType" = $1::"ProjectType" WHERE id = $2 AND "projectType" IS NULL`,
          projectType,
          project.id,
        );
      }
      updates.projectTypes += 1;
    }

    if (shouldCopyExpectedIncome(project)) {
      if (options.apply) {
        await prisma.$executeRawUnsafe(
          `UPDATE projects SET "expectedIncome" = "contractValue" WHERE id = $1 AND "expectedIncome" IS NULL AND "contractValue" IS NOT NULL`,
          project.id,
        );
      }
      updates.expectedIncomeCopied += 1;
    }

    if (shouldCopyCurrencyCode(project)) {
      if (options.apply) {
        await prisma.$executeRawUnsafe(
          `UPDATE projects SET "currencyCode" = currency WHERE id = $1 AND ("currencyCode" IS NULL OR trim("currencyCode") = '') AND currency IS NOT NULL`,
          project.id,
        );
      }
      updates.currencyCodeCopied += 1;
    }
  }

  const stages = asRows<{
    id: string;
    status: string;
    statusV2: string | null;
  }>(
    await prisma.$queryRawUnsafe(
      `SELECT id, status, "statusV2" FROM project_stages ORDER BY id`,
    ),
  );
  for (const stage of stages) {
    const statusV2 = mapProjectStageStatusV2(stage.status);
    if (!statusV2) {
      updates.skippedAmbiguous += 1;
      continue;
    }
    if (!stage.statusV2) {
      if (options.apply) {
        await prisma.$executeRawUnsafe(
          `UPDATE project_stages SET "statusV2" = $1::"ProjectStageStatus" WHERE id = $2 AND "statusV2" IS NULL`,
          statusV2,
          stage.id,
        );
      }
      updates.stageStatuses += 1;
    }
  }

  const tasks = asRows<{ id: string; status: string; statusV2: string | null }>(
    await prisma.$queryRawUnsafe(
      `SELECT id, status, "statusV2" FROM project_tasks ORDER BY id`,
    ),
  );
  for (const task of tasks) {
    const statusV2 = mapProjectTaskStatusV2(task.status);
    if (!statusV2) {
      updates.skippedAmbiguous += 1;
      continue;
    }
    if (!task.statusV2) {
      if (options.apply) {
        await prisma.$executeRawUnsafe(
          `UPDATE project_tasks SET "statusV2" = $1::"ProjectTaskStatus" WHERE id = $2 AND "statusV2" IS NULL`,
          statusV2,
          task.id,
        );
      }
      updates.taskStatuses += 1;
    }
  }

  const members = asRows<{
    id: string;
    isActive: boolean;
    allocationStatus: string;
    statusV2: string | null;
  }>(
    await prisma.$queryRawUnsafe(
      `SELECT id, "isActive", "allocationStatus", "statusV2" FROM project_team_members ORDER BY id`,
    ),
  );
  for (const member of members) {
    const statusV2 = mapProjectTeamMemberStatusV2(member);
    if (!statusV2) {
      updates.skippedAmbiguous += 1;
      continue;
    }
    if (!member.statusV2) {
      if (options.apply) {
        await prisma.$executeRawUnsafe(
          `UPDATE project_team_members SET "statusV2" = $1::"ProjectTeamMemberStatus" WHERE id = $2 AND "statusV2" IS NULL`,
          statusV2,
          member.id,
        );
      }
      updates.teamMemberStatuses += 1;
    }
  }

  const participants = asRows<{
    id: string;
    status: string;
    statusV2: string | null;
  }>(
    await prisma.$queryRawUnsafe(
      `SELECT id, status, "statusV2" FROM task_participants ORDER BY id`,
    ),
  );
  for (const participant of participants) {
    const statusV2 = mapTaskParticipantStatusV2(participant.status);
    if (!statusV2) {
      updates.skippedAmbiguous += 1;
      continue;
    }
    if (!participant.statusV2) {
      if (options.apply) {
        await prisma.$executeRawUnsafe(
          `UPDATE task_participants SET "statusV2" = $1::"ProjectTaskParticipantStatus" WHERE id = $2 AND "statusV2" IS NULL`,
          statusV2,
          participant.id,
        );
      }
      updates.participantStatuses += 1;
    }
  }

  const headers = asRows<{
    id: string;
    status: string;
    statusV2: string | null;
    periodStart: string | null;
    periodEnd: string | null;
  }>(
    await prisma.$queryRawUnsafe(
      `SELECT id, status, "statusV2", "periodStart"::text, "periodEnd"::text FROM work_log_headers ORDER BY id`,
    ),
  );
  for (const header of headers) {
    const statusV2 = mapWorkLogStatusV2(header.status);
    if (!statusV2) {
      updates.skippedAmbiguous += 1;
    } else if (!header.statusV2) {
      if (options.apply) {
        await prisma.$executeRawUnsafe(
          `UPDATE work_log_headers SET "statusV2" = $1::"WorkLogStatus" WHERE id = $2 AND "statusV2" IS NULL`,
          statusV2,
          header.id,
        );
      }
      updates.workLogStatuses += 1;
    }

    if (!header.periodStart || !header.periodEnd) {
      if (options.apply) {
        await prisma.$executeRawUnsafe(
          `
            UPDATE work_log_headers
            SET
              "periodStart" = COALESCE("periodStart", "startDate"::date),
              "periodEnd" = COALESCE("periodEnd", "endDate"::date)
            WHERE id = $1
              AND ("periodStart" IS NULL OR "periodEnd" IS NULL)
          `,
          header.id,
        );
      }
      updates.workLogPeriods += 1;
    }
  }

  const submissions = asRows<{
    id: string;
    status: string;
    statusV2: string | null;
  }>(
    await prisma.$queryRawUnsafe(
      `SELECT id, status, "statusV2" FROM task_submissions ORDER BY id`,
    ),
  );
  for (const submission of submissions) {
    const statusV2 = mapTaskSubmissionStatusV2(submission.status);
    if (!statusV2) {
      updates.skippedAmbiguous += 1;
      continue;
    }
    if (!submission.statusV2) {
      if (options.apply) {
        await prisma.$executeRawUnsafe(
          `UPDATE task_submissions SET "statusV2" = $1::"TaskSubmissionStatus" WHERE id = $2 AND "statusV2" IS NULL`,
          statusV2,
          submission.id,
        );
      }
      updates.submissionStatuses += 1;
    }
  }

  const reviews = asRows<{
    id: string;
    decision: string;
    decisionV2: string | null;
  }>(
    await prisma.$queryRawUnsafe(
      `SELECT id, decision, "decisionV2" FROM task_reviews ORDER BY id`,
    ),
  );
  for (const review of reviews) {
    const decisionV2 = mapTaskReviewDecisionV2(review.decision);
    if (!decisionV2) {
      updates.skippedAmbiguous += 1;
      continue;
    }
    if (!review.decisionV2) {
      if (options.apply) {
        await prisma.$executeRawUnsafe(
          `UPDATE task_reviews SET "decisionV2" = $1::"TaskReviewDecision" WHERE id = $2 AND "decisionV2" IS NULL`,
          decisionV2,
          review.id,
        );
      }
      updates.reviewDecisions += 1;
    }
  }

  const mappingEntries = Object.entries(mapping.businessPartyByProjectId);
  if (mappingEntries.length > 0) {
    const businessPartyAvailable = await tableExists(
      prisma,
      'business_parties',
    );
    if (!businessPartyAvailable) {
      updates.skippedClientMapping = mappingEntries.length;
      notes.push(
        'business_parties table is not present. Operator client mapping was skipped; Office Finance must land BusinessParty before CLIENT projects can be linked.',
      );
    } else {
      for (const [projectId, businessPartyId] of mappingEntries) {
        const project = projects.find((row) => row.id === projectId);
        if (!project) {
          updates.skippedClientMapping += 1;
          notes.push(`Mapping skipped: unknown project ${projectId}`);
          continue;
        }
        if (project.businessPartyId) {
          continue;
        }

        const parties = asRows<{
          id: string;
          companyId: string;
          partyType: string;
        }>(
          await prisma.$queryRawUnsafe(
            `
              SELECT id, "companyId", "partyType"::text AS "partyType"
              FROM business_parties
              WHERE id = $1
              LIMIT 1
            `,
            businessPartyId,
          ),
        );
        const party = parties[0];
        if (!party || party.companyId !== project.companyId) {
          updates.skippedClientMapping += 1;
          notes.push(
            `Mapping skipped for project ${projectId}: BusinessParty missing or cross-company`,
          );
          continue;
        }
        if (!['CUSTOMER', 'BOTH'].includes(party.partyType.toUpperCase())) {
          updates.skippedClientMapping += 1;
          notes.push(
            `Mapping skipped for project ${projectId}: BusinessParty type must be CUSTOMER or BOTH`,
          );
          continue;
        }

        if (options.apply) {
          await prisma.$executeRawUnsafe(
            `
              UPDATE projects
              SET
                "businessPartyId" = $1,
                "projectType" = COALESCE("projectType", 'CLIENT'::"ProjectType")
              WHERE id = $2
                AND "businessPartyId" IS NULL
            `,
            businessPartyId,
            projectId,
          );
        }
        updates.businessPartyMapped += 1;
      }
    }
  }

  if (!options.apply) {
    notes.push(
      'Dry-run only. Re-run with --apply to write statusV2 and snapshots.',
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    dryRun: !options.apply,
    preflight,
    updates,
    blocked,
    notes,
  };
}
