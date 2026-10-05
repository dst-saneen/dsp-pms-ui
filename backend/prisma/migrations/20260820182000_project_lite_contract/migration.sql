-- Project Lite Phase 3 contract (plan §9 step 3).
-- Apply only after blocking preflight exceptions are zero and reconcile has run.
-- Fails closed if typed columns / company snapshots / duplicates / cycles are dirty.
-- businessPartyId FK deferred until Office Finance creates business_parties.

-- ---------------------------------------------------------------------------
-- Fail-closed preflight gates
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  n integer;
BEGIN
  SELECT COUNT(*) INTO n FROM (
    SELECT 1
    FROM projects p
    WHERE EXISTS (
      SELECT 1
      FROM projects d
      WHERE d."companyId" = p."companyId"
        AND d."projectCode" = p."projectCode"
        AND d.id <> p.id
    )
  ) dups;
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % duplicate (companyId, projectCode) rows. Run preflight/reconcile first.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM projects WHERE "statusV2" IS NULL OR "projectType" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % projects missing statusV2/projectType.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM project_stages WHERE "statusV2" IS NULL OR "companyId" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % stages missing statusV2/companyId.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM project_tasks WHERE "statusV2" IS NULL OR "companyId" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % tasks missing statusV2/companyId.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM project_team_members WHERE "statusV2" IS NULL OR "companyId" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % team members missing statusV2/companyId.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM task_participants WHERE "statusV2" IS NULL OR "companyId" IS NULL OR "projectId" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % task participants missing statusV2/companyId/projectId.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM work_log_headers
  WHERE "statusV2" IS NULL OR "companyId" IS NULL OR "branchId" IS NULL
     OR "periodStart" IS NULL OR "periodEnd" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % work log headers missing typed/period/company snapshots.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM work_log_lines
  WHERE "companyId" IS NULL OR "branchId" IS NULL OR "employeeId" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % work log lines missing company/branch/employee snapshots.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM project_stages s
  WHERE EXISTS (
    SELECT 1 FROM project_stages d
    WHERE d."projectId" = s."projectId" AND d."stageCode" = s."stageCode" AND d.id <> s.id
  );
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % duplicate stage codes within a project.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM project_stages s
  WHERE EXISTS (
    SELECT 1 FROM project_stages d
    WHERE d."projectId" = s."projectId" AND d."sequenceNo" = s."sequenceNo" AND d.id <> s.id
  );
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % duplicate stage sequence numbers within a project.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM project_tasks WHERE "parentTaskId" IS NOT NULL AND "parentTaskId" = id;
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % tasks parent themselves.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM project_team_members
  WHERE "allocationPercentage" IS NULL
     OR "allocationPercentage" <= 0
     OR "allocationPercentage" > 100;
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % team members have invalid allocationPercentage.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM work_log_lines
  WHERE hours IS NULL OR hours <= 0 OR hours > 24
     OR (
       ("taskId" IS NULL AND "workCategoryId" IS NULL)
       OR ("taskId" IS NOT NULL AND "workCategoryId" IS NOT NULL)
     );
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % work log lines have invalid hours or task/category shape.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM (
    SELECT 1
    FROM work_log_lines l
    JOIN work_log_headers h ON h.id = l."workLogHeaderId"
    GROUP BY COALESCE(l."employeeId", h."employeeId"), l."workDate"::date
    HAVING SUM(l.hours) > 24
  ) overages;
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % employee/day groups exceed 24 hours.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM projects p
  JOIN branches b ON b.id = p."branchId"
  WHERE p."branchId" IS NOT NULL AND b."companyId" <> p."companyId";
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % projects have cross-company branch.', n;
  END IF;

  SELECT COUNT(*) INTO n FROM projects p
  JOIN employees e ON e.id = p."projectmanagerId"
  WHERE p."projectmanagerId" IS NOT NULL AND e."companyId" <> p."companyId";
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % projects have cross-company manager.', n;
  END IF;

  -- INTERNAL projects must not carry a businessPartyId
  SELECT COUNT(*) INTO n FROM projects
  WHERE "projectType" = 'INTERNAL' AND "businessPartyId" IS NOT NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Project Lite contract blocked: % INTERNAL projects still have businessPartyId.', n;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- NOT NULL
-- ---------------------------------------------------------------------------

ALTER TABLE "projects"
  ALTER COLUMN "statusV2" SET NOT NULL,
  ALTER COLUMN "statusV2" SET DEFAULT 'DRAFT'::"ProjectStatus",
  ALTER COLUMN "projectType" SET NOT NULL,
  ALTER COLUMN "projectType" SET DEFAULT 'INTERNAL'::"ProjectType";

ALTER TABLE "project_stages"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "statusV2" SET NOT NULL,
  ALTER COLUMN "statusV2" SET DEFAULT 'PLANNED'::"ProjectStageStatus";

ALTER TABLE "project_tasks"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "statusV2" SET NOT NULL,
  ALTER COLUMN "statusV2" SET DEFAULT 'OPEN'::"ProjectTaskStatus";

ALTER TABLE "project_team_members"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "statusV2" SET NOT NULL,
  ALTER COLUMN "statusV2" SET DEFAULT 'ACTIVE'::"ProjectTeamMemberStatus";

ALTER TABLE "task_participants"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "projectId" SET NOT NULL,
  ALTER COLUMN "statusV2" SET NOT NULL,
  ALTER COLUMN "statusV2" SET DEFAULT 'ACTIVE'::"ProjectTaskParticipantStatus";

ALTER TABLE "task_submissions"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "projectId" SET NOT NULL;

ALTER TABLE "work_log_headers"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "branchId" SET NOT NULL,
  ALTER COLUMN "statusV2" SET NOT NULL,
  ALTER COLUMN "statusV2" SET DEFAULT 'DRAFT'::"WorkLogStatus",
  ALTER COLUMN "periodStart" SET NOT NULL,
  ALTER COLUMN "periodEnd" SET NOT NULL;

ALTER TABLE "work_log_lines"
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "branchId" SET NOT NULL,
  ALTER COLUMN "employeeId" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Uniques: company-scoped project code; stage code/sequence; active membership
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "projects_companyId_projectCode_key"
  ON "projects"("companyId", "projectCode");

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_projectCode_key";
DROP INDEX IF EXISTS "projects_projectCode_key";

CREATE UNIQUE INDEX IF NOT EXISTS "project_stages_projectId_stageCode_key"
  ON "project_stages"("projectId", "stageCode");

CREATE UNIQUE INDEX IF NOT EXISTS "project_stages_projectId_sequenceNo_key"
  ON "project_stages"("projectId", "sequenceNo");

CREATE UNIQUE INDEX IF NOT EXISTS "project_stages_companyId_id_key"
  ON "project_stages"("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "project_tasks_companyId_id_key"
  ON "project_tasks"("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "work_log_headers_companyId_employeeId_periodStart_key"
  ON "work_log_headers"("companyId", "employeeId", "periodStart");

-- Replace full participant unique with ACTIVE-only partial unique
ALTER TABLE "task_participants" DROP CONSTRAINT IF EXISTS "task_participants_taskId_employeeId_role_key";
DROP INDEX IF EXISTS "task_participants_taskId_employeeId_role_key";

CREATE UNIQUE INDEX IF NOT EXISTS "task_participants_one_active_assignment_idx"
  ON "task_participants"("taskId", "employeeId", "role")
  WHERE "statusV2" = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "project_team_members_one_active_membership_idx"
  ON "project_team_members"("projectId", "employeeId")
  WHERE "statusV2" = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- Composite Restrict FKs (company-qualified)
-- ---------------------------------------------------------------------------

ALTER TABLE "project_stages" DROP CONSTRAINT IF EXISTS "project_stages_company_project_fkey";
ALTER TABLE "project_stages"
  ADD CONSTRAINT "project_stages_company_project_fkey"
  FOREIGN KEY ("companyId", "projectId")
  REFERENCES "projects"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "project_tasks" DROP CONSTRAINT IF EXISTS "project_tasks_company_project_fkey";
ALTER TABLE "project_tasks"
  ADD CONSTRAINT "project_tasks_company_project_fkey"
  FOREIGN KEY ("companyId", "projectId")
  REFERENCES "projects"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "project_team_members" DROP CONSTRAINT IF EXISTS "project_team_members_company_project_fkey";
ALTER TABLE "project_team_members"
  ADD CONSTRAINT "project_team_members_company_project_fkey"
  FOREIGN KEY ("companyId", "projectId")
  REFERENCES "projects"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "project_team_members" DROP CONSTRAINT IF EXISTS "project_team_members_company_employee_fkey";
ALTER TABLE "project_team_members"
  ADD CONSTRAINT "project_team_members_company_employee_fkey"
  FOREIGN KEY ("companyId", "employeeId")
  REFERENCES "employees"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "task_participants" DROP CONSTRAINT IF EXISTS "task_participants_company_project_fkey";
ALTER TABLE "task_participants"
  ADD CONSTRAINT "task_participants_company_project_fkey"
  FOREIGN KEY ("companyId", "projectId")
  REFERENCES "projects"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "task_participants" DROP CONSTRAINT IF EXISTS "task_participants_company_employee_fkey";
ALTER TABLE "task_participants"
  ADD CONSTRAINT "task_participants_company_employee_fkey"
  FOREIGN KEY ("companyId", "employeeId")
  REFERENCES "employees"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "task_submissions" DROP CONSTRAINT IF EXISTS "task_submissions_company_project_fkey";
ALTER TABLE "task_submissions"
  ADD CONSTRAINT "task_submissions_company_project_fkey"
  FOREIGN KEY ("companyId", "projectId")
  REFERENCES "projects"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "work_log_headers" DROP CONSTRAINT IF EXISTS "work_log_headers_company_employee_fkey";
ALTER TABLE "work_log_headers"
  ADD CONSTRAINT "work_log_headers_company_employee_fkey"
  FOREIGN KEY ("companyId", "employeeId")
  REFERENCES "employees"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "work_log_lines" DROP CONSTRAINT IF EXISTS "work_log_lines_company_employee_fkey";
ALTER TABLE "work_log_lines"
  ADD CONSTRAINT "work_log_lines_company_employee_fkey"
  FOREIGN KEY ("companyId", "employeeId")
  REFERENCES "employees"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "project_documents" DROP CONSTRAINT IF EXISTS "project_documents_company_project_fkey";
ALTER TABLE "project_documents"
  ADD CONSTRAINT "project_documents_company_project_fkey"
  FOREIGN KEY ("companyId", "projectId")
  REFERENCES "projects"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ---------------------------------------------------------------------------
-- CHECKs
-- ---------------------------------------------------------------------------

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_date_range_check";
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_date_range_check"
  CHECK ("endDate" IS NULL OR "startDate" IS NULL OR "endDate" >= "startDate") NOT VALID;
ALTER TABLE "projects" VALIDATE CONSTRAINT "projects_date_range_check";

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_budget_nonneg_check";
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_budget_nonneg_check"
  CHECK (
    ("expectedIncome" IS NULL OR "expectedIncome" >= 0)
    AND ("expenseBudget" IS NULL OR "expenseBudget" >= 0)
  ) NOT VALID;
ALTER TABLE "projects" VALIDATE CONSTRAINT "projects_budget_nonneg_check";

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_internal_party_null_check";
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_internal_party_null_check"
  CHECK ("projectType" <> 'INTERNAL' OR "businessPartyId" IS NULL) NOT VALID;
ALTER TABLE "projects" VALIDATE CONSTRAINT "projects_internal_party_null_check";

ALTER TABLE "project_team_members" DROP CONSTRAINT IF EXISTS "project_team_members_allocation_check";
ALTER TABLE "project_team_members"
  ADD CONSTRAINT "project_team_members_allocation_check"
  CHECK ("allocationPercentage" > 0 AND "allocationPercentage" <= 100) NOT VALID;
ALTER TABLE "project_team_members" VALIDATE CONSTRAINT "project_team_members_allocation_check";

ALTER TABLE "work_log_headers" DROP CONSTRAINT IF EXISTS "work_log_headers_period_check";
ALTER TABLE "work_log_headers"
  ADD CONSTRAINT "work_log_headers_period_check"
  CHECK ("periodEnd" >= "periodStart") NOT VALID;
ALTER TABLE "work_log_headers" VALIDATE CONSTRAINT "work_log_headers_period_check";

ALTER TABLE "work_log_lines" DROP CONSTRAINT IF EXISTS "work_log_lines_hours_range_check";
ALTER TABLE "work_log_lines"
  ADD CONSTRAINT "work_log_lines_hours_range_check"
  CHECK (hours > 0 AND hours <= 24) NOT VALID;
ALTER TABLE "work_log_lines" VALIDATE CONSTRAINT "work_log_lines_hours_range_check";

ALTER TABLE "work_log_lines" DROP CONSTRAINT IF EXISTS "work_log_lines_task_xor_category_check";
ALTER TABLE "work_log_lines"
  ADD CONSTRAINT "work_log_lines_task_xor_category_check"
  CHECK (
    ("taskId" IS NOT NULL AND "workCategoryId" IS NULL)
    OR ("taskId" IS NULL AND "workCategoryId" IS NOT NULL)
  ) NOT VALID;
ALTER TABLE "work_log_lines" VALIDATE CONSTRAINT "work_log_lines_task_xor_category_check";

ALTER TABLE "project_tasks" DROP CONSTRAINT IF EXISTS "project_tasks_progress_check";
ALTER TABLE "project_tasks"
  ADD CONSTRAINT "project_tasks_progress_check"
  CHECK (
    "completionPercentage" IS NULL
    OR ("completionPercentage" >= 0 AND "completionPercentage" <= 100)
  ) NOT VALID;
ALTER TABLE "project_tasks" VALIDATE CONSTRAINT "project_tasks_progress_check";

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION project_lite_raise(code text)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '%', code USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION project_task_parent_cycle_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  has_cycle boolean;
BEGIN
  IF NEW."parentTaskId" IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW."parentTaskId" = NEW.id THEN
    PERFORM project_lite_raise('PROJECT_TASK_PARENT_SELF_LINK');
  END IF;

  WITH RECURSIVE walk AS (
    SELECT t.id, t."parentTaskId", t."projectId", ARRAY[t.id]::text[] AS path
    FROM project_tasks t
    WHERE t.id = NEW."parentTaskId"
    UNION ALL
    SELECT p.id, p."parentTaskId", p."projectId", w.path || p.id
    FROM project_tasks p
    JOIN walk w ON p.id = w."parentTaskId"
    WHERE NOT (p.id = ANY (w.path))
  )
  SELECT EXISTS (
    SELECT 1
    FROM walk w
    LEFT JOIN project_tasks parent ON parent.id = w."parentTaskId"
    WHERE NEW.id = ANY (w.path)
       OR (parent.id IS NOT NULL AND parent."projectId" IS DISTINCT FROM NEW."projectId")
       OR w."projectId" IS DISTINCT FROM NEW."projectId"
  ) INTO has_cycle;

  IF has_cycle THEN
    PERFORM project_lite_raise('PROJECT_TASK_PARENT_CYCLE');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_task_parent_cycle_guard ON project_tasks;
CREATE TRIGGER trg_project_task_parent_cycle_guard
  BEFORE INSERT OR UPDATE OF "parentTaskId", "projectId"
  ON project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION project_task_parent_cycle_guard();

CREATE OR REPLACE FUNCTION work_log_daily_hours_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  employee_id text;
  day_total numeric;
BEGIN
  employee_id := COALESCE(NEW."employeeId", (
    SELECT h."employeeId" FROM work_log_headers h WHERE h.id = NEW."workLogHeaderId"
  ));

  SELECT COALESCE(SUM(l.hours), 0) INTO day_total
  FROM work_log_lines l
  JOIN work_log_headers h ON h.id = l."workLogHeaderId"
  WHERE COALESCE(l."employeeId", h."employeeId") = employee_id
    AND l."workDate"::date = NEW."workDate"::date
    AND l.id IS DISTINCT FROM NEW.id;

  day_total := day_total + NEW.hours;

  IF day_total > 24 THEN
    PERFORM project_lite_raise('TIMESHEET_DAILY_HOURS_EXCEEDED');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_log_daily_hours_guard ON work_log_lines;
CREATE TRIGGER trg_work_log_daily_hours_guard
  BEFORE INSERT OR UPDATE OF hours, "workDate", "employeeId", "workLogHeaderId"
  ON work_log_lines
  FOR EACH ROW
  EXECUTE FUNCTION work_log_daily_hours_guard();

CREATE OR REPLACE FUNCTION project_task_participant_membership_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."statusV2" = 'ACTIVE' AND NOT EXISTS (
    SELECT 1
    FROM project_team_members m
    WHERE m."projectId" = NEW."projectId"
      AND m."employeeId" = NEW."employeeId"
      AND m."statusV2" = 'ACTIVE'
  ) THEN
    PERFORM project_lite_raise('PROJECT_MEMBER_REQUIRED');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_task_participant_membership_guard ON task_participants;
CREATE TRIGGER trg_project_task_participant_membership_guard
  BEFORE INSERT OR UPDATE OF "statusV2", "projectId", "employeeId"
  ON task_participants
  FOR EACH ROW
  EXECUTE FUNCTION project_task_participant_membership_guard();

CREATE OR REPLACE FUNCTION project_history_immutable_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM project_lite_raise('PROJECT_HISTORY_IMMUTABLE');
  RETURN NULL;
END;
$$;

-- Receipts are CLAIMED then COMPLETED exactly once (see project_command_receipt_guard).
CREATE OR REPLACE FUNCTION project_command_receipt_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM project_lite_raise('PROJECT_HISTORY_IMMUTABLE');
  END IF;

  IF OLD."safeResultSnapshot" IS NULL
     AND OLD."resultEntityType" IS NULL
     AND OLD."resultEntityId" IS NULL
     AND OLD."completedAt" IS NULL
     AND NEW."safeResultSnapshot" IS NOT NULL
     AND NEW."resultEntityType" IS NOT NULL
     AND NEW."resultEntityId" IS NOT NULL
     AND NEW."completedAt" IS NOT NULL
     AND NEW.id = OLD.id
     AND NEW."companyId" = OLD."companyId"
     AND NEW."operationId" = OLD."operationId"
     AND NEW."commandType" = OLD."commandType"
     AND NEW."actorUserId" = OLD."actorUserId"
     AND NEW."requestHash" = OLD."requestHash"
     AND NEW."requestHashKeyVersion" = OLD."requestHashKeyVersion"
     AND NEW."requestHashFormatVersion" = OLD."requestHashFormatVersion"
     AND NEW."createdAt" = OLD."createdAt"
  THEN
    RETURN NEW;
  END IF;

  PERFORM project_lite_raise('PROJECT_HISTORY_IMMUTABLE');
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_action_events_immutable ON project_action_events;
CREATE TRIGGER trg_project_action_events_immutable
  BEFORE UPDATE OR DELETE ON project_action_events
  FOR EACH ROW
  EXECUTE FUNCTION project_history_immutable_guard();

DROP TRIGGER IF EXISTS trg_project_command_receipts_immutable ON project_command_receipts;
CREATE TRIGGER trg_project_command_receipts_immutable
  BEFORE UPDATE OR DELETE ON project_command_receipts
  FOR EACH ROW
  EXECUTE FUNCTION project_command_receipt_guard();

DROP TRIGGER IF EXISTS trg_project_team_member_history_immutable ON project_team_member_history;
CREATE TRIGGER trg_project_team_member_history_immutable
  BEFORE UPDATE OR DELETE ON project_team_member_history
  FOR EACH ROW
  EXECUTE FUNCTION project_history_immutable_guard();

DROP TRIGGER IF EXISTS trg_task_assignment_history_immutable ON task_assignment_history;
CREATE TRIGGER trg_task_assignment_history_immutable
  BEFORE UPDATE OR DELETE ON task_assignment_history
  FOR EACH ROW
  EXECUTE FUNCTION project_history_immutable_guard();

CREATE OR REPLACE FUNCTION project_historical_delete_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'projects' THEN
    IF EXISTS (SELECT 1 FROM project_stages WHERE "projectId" = OLD.id)
       OR EXISTS (SELECT 1 FROM project_tasks WHERE "projectId" = OLD.id)
       OR EXISTS (SELECT 1 FROM project_team_members WHERE "projectId" = OLD.id)
       OR EXISTS (SELECT 1 FROM project_action_events WHERE "projectId" = OLD.id)
       OR EXISTS (SELECT 1 FROM project_documents WHERE "projectId" = OLD.id)
    THEN
      PERFORM project_lite_raise('PROJECT_HAS_HISTORY_NO_HARD_DELETE');
    END IF;
  ELSIF TG_TABLE_NAME = 'project_stages' THEN
    IF EXISTS (SELECT 1 FROM project_tasks WHERE "stageId" = OLD.id) THEN
      PERFORM project_lite_raise('PROJECT_STAGE_HAS_TASKS_NO_HARD_DELETE');
    END IF;
  ELSIF TG_TABLE_NAME = 'project_tasks' THEN
    IF EXISTS (SELECT 1 FROM task_participants WHERE "taskId" = OLD.id)
       OR EXISTS (SELECT 1 FROM task_submissions WHERE "taskId" = OLD.id)
       OR EXISTS (SELECT 1 FROM task_assignment_history WHERE "taskId" = OLD.id)
       OR EXISTS (SELECT 1 FROM work_log_lines WHERE "taskId" = OLD.id)
       OR EXISTS (SELECT 1 FROM project_documents WHERE "taskId" = OLD.id)
    THEN
      PERFORM project_lite_raise('PROJECT_TASK_HAS_HISTORY_NO_HARD_DELETE');
    END IF;
  ELSIF TG_TABLE_NAME = 'work_log_headers' THEN
    IF OLD."statusV2" IN ('SUBMITTED', 'APPROVED', 'RETURNED', 'CANCELLED') THEN
      PERFORM project_lite_raise('TIMESHEET_TERMINAL_NO_HARD_DELETE');
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_historical_delete_guard ON projects;
CREATE TRIGGER trg_projects_historical_delete_guard
  BEFORE DELETE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION project_historical_delete_guard();

DROP TRIGGER IF EXISTS trg_project_stages_historical_delete_guard ON project_stages;
CREATE TRIGGER trg_project_stages_historical_delete_guard
  BEFORE DELETE ON project_stages
  FOR EACH ROW
  EXECUTE FUNCTION project_historical_delete_guard();

DROP TRIGGER IF EXISTS trg_project_tasks_historical_delete_guard ON project_tasks;
CREATE TRIGGER trg_project_tasks_historical_delete_guard
  BEFORE DELETE ON project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION project_historical_delete_guard();

DROP TRIGGER IF EXISTS trg_work_log_headers_historical_delete_guard ON work_log_headers;
CREATE TRIGGER trg_work_log_headers_historical_delete_guard
  BEFORE DELETE ON work_log_headers
  FOR EACH ROW
  EXECUTE FUNCTION project_historical_delete_guard();

-- ---------------------------------------------------------------------------
-- Final list/query indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "projects_companyId_branchId_statusV2_idx"
  ON "projects"("companyId", "branchId", "statusV2");

CREATE INDEX IF NOT EXISTS "project_team_members_employeeId_statusV2_idx"
  ON "project_team_members"("employeeId", "statusV2");

CREATE INDEX IF NOT EXISTS "task_participants_employeeId_statusV2_idx"
  ON "task_participants"("employeeId", "statusV2");

CREATE INDEX IF NOT EXISTS "work_log_headers_companyId_statusV2_periodStart_idx"
  ON "work_log_headers"("companyId", "statusV2", "periodStart");

CREATE INDEX IF NOT EXISTS "work_log_lines_companyId_taskId_workDate_idx"
  ON "work_log_lines"("companyId", "taskId", "workDate");
