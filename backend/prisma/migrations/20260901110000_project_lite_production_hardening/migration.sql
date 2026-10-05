-- Project Lite production hardening. Additive migration after HR Operations.
-- Rehearse on disposable PostgreSQL before shared-environment approval.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM projects p
    JOIN branches b ON b.id = p."branchId"
    WHERE p."branchId" IS NOT NULL AND b."companyId" <> p."companyId"
  ) OR EXISTS (
    SELECT 1 FROM projects p
    JOIN employees e ON e.id = p."projectmanagerId"
    WHERE p."projectmanagerId" IS NOT NULL AND e."companyId" <> p."companyId"
  ) OR EXISTS (
    SELECT 1 FROM project_stages s JOIN projects p ON p.id = s."projectId"
    WHERE s."companyId" <> p."companyId"
  ) OR EXISTS (
    SELECT 1 FROM project_tasks t JOIN projects p ON p.id = t."projectId"
    WHERE t."companyId" <> p."companyId"
  ) OR EXISTS (
    SELECT 1 FROM project_tasks t JOIN project_stages s ON s.id = t."stageId"
    WHERE t."companyId" <> s."companyId" OR t."projectId" <> s."projectId"
  ) OR EXISTS (
    SELECT 1 FROM project_team_members m
    JOIN projects p ON p.id = m."projectId"
    JOIN employees e ON e.id = m."employeeId"
    WHERE m."companyId" <> p."companyId" OR m."companyId" <> e."companyId"
  ) OR EXISTS (
    SELECT 1 FROM task_participants a
    JOIN project_tasks t ON t.id = a."taskId"
    JOIN employees e ON e.id = a."employeeId"
    WHERE a."companyId" <> t."companyId"
       OR a."projectId" <> t."projectId"
       OR a."companyId" <> e."companyId"
  ) OR EXISTS (
    SELECT 1 FROM task_submissions s
    JOIN project_tasks t ON t.id = s."taskId"
    JOIN employees e ON e.id = s."submittedById"
    WHERE s."companyId" <> t."companyId"
       OR s."projectId" <> t."projectId"
       OR s."companyId" <> e."companyId"
  ) OR EXISTS (
    SELECT 1 FROM task_reviews r
    JOIN task_submissions s ON s.id = r."submissionId"
    JOIN employees e ON e.id = r."reviewerId"
    WHERE r."companyId" IS NULL OR r."projectId" IS NULL OR r."taskId" IS NULL
       OR r."companyId" <> s."companyId"
       OR r."projectId" <> s."projectId"
       OR r."taskId" <> s."taskId"
       OR r."companyId" <> e."companyId"
  ) OR EXISTS (
    SELECT 1 FROM project_documents d
    JOIN projects p ON p.id = d."projectId"
    JOIN file_objects f ON f.id = d."fileObjectId"
    LEFT JOIN project_tasks t ON t.id = d."taskId"
    LEFT JOIN task_submissions s ON s.id = d."taskSubmissionId"
    WHERE d."companyId" <> p."companyId"
       OR d."companyId" <> f."companyId"
       OR (d."taskId" IS NOT NULL AND (
         t.id IS NULL OR d."companyId" <> t."companyId" OR d."projectId" <> t."projectId"
       ))
       OR (d."taskSubmissionId" IS NOT NULL AND (
         s.id IS NULL OR d."taskId" IS NULL
         OR d."companyId" <> s."companyId"
         OR d."projectId" <> s."projectId"
         OR d."taskId" <> s."taskId"
       ))
  ) OR EXISTS (
    SELECT 1 FROM work_log_headers h
    JOIN branches b ON b.id = h."branchId"
    JOIN employees e ON e.id = h."employeeId"
    WHERE h."companyId" <> b."companyId"
       OR h."companyId" <> e."companyId"
       OR h."branchId" <> e."branchId"
  ) OR EXISTS (
    SELECT 1 FROM work_log_lines l
    JOIN work_log_headers h ON h.id = l."workLogHeaderId"
    LEFT JOIN project_tasks t ON t.id = l."taskId"
    WHERE l."companyId" <> h."companyId"
       OR l."branchId" <> h."branchId"
       OR l."employeeId" <> h."employeeId"
       OR (l."taskId" IS NOT NULL AND (
         t.id IS NULL OR l."companyId" <> t."companyId"
       ))
  ) THEN
    RAISE EXCEPTION 'PROJECT_LITE_SCOPE_RECONCILIATION_REQUIRED';
  END IF;
END $$;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS "projects_branchId_fkey";
ALTER TABLE projects DROP CONSTRAINT IF EXISTS "projects_projectmanagerId_fkey";
ALTER TABLE projects
  ADD CONSTRAINT "projects_company_branch_fkey"
  FOREIGN KEY ("companyId", "branchId") REFERENCES branches("companyId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE projects
  ADD CONSTRAINT "projects_company_manager_fkey"
  FOREIGN KEY ("companyId", "projectmanagerId") REFERENCES employees("companyId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE project_stages DROP CONSTRAINT IF EXISTS "project_stages_projectId_fkey";
ALTER TABLE project_stages DROP CONSTRAINT IF EXISTS "project_stages_company_project_fkey";
CREATE UNIQUE INDEX IF NOT EXISTS "project_stages_companyId_projectId_id_key"
  ON project_stages("companyId", "projectId", id);
ALTER TABLE project_stages
  ADD CONSTRAINT "project_stages_company_project_fkey"
  FOREIGN KEY ("companyId", "projectId") REFERENCES projects("companyId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS "project_tasks_projectId_fkey";
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS "project_tasks_stageId_fkey";
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS "project_tasks_parentTaskId_fkey";
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS "project_tasks_company_project_fkey";
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS "project_tasks_company_stage_fkey";
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS "project_tasks_company_parent_fkey";
CREATE UNIQUE INDEX IF NOT EXISTS "project_tasks_companyId_projectId_id_key"
  ON project_tasks("companyId", "projectId", id);
ALTER TABLE project_tasks
  ADD CONSTRAINT "project_tasks_company_project_fkey"
  FOREIGN KEY ("companyId", "projectId") REFERENCES projects("companyId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE project_tasks
  ADD CONSTRAINT "project_tasks_company_stage_fkey"
  FOREIGN KEY ("companyId", "projectId", "stageId")
  REFERENCES project_stages("companyId", "projectId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE project_tasks
  ADD CONSTRAINT "project_tasks_company_parent_fkey"
  FOREIGN KEY ("companyId", "projectId", "parentTaskId")
  REFERENCES project_tasks("companyId", "projectId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE project_team_members DROP CONSTRAINT IF EXISTS "project_team_members_projectId_fkey";
ALTER TABLE project_team_members DROP CONSTRAINT IF EXISTS "project_team_members_employeeId_fkey";
ALTER TABLE project_team_members DROP CONSTRAINT IF EXISTS "project_team_members_company_project_fkey";
ALTER TABLE project_team_members DROP CONSTRAINT IF EXISTS "project_team_members_company_employee_fkey";
ALTER TABLE project_team_members
  ADD CONSTRAINT "project_team_members_company_project_fkey"
  FOREIGN KEY ("companyId", "projectId") REFERENCES projects("companyId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE project_team_members
  ADD CONSTRAINT "project_team_members_company_employee_fkey"
  FOREIGN KEY ("companyId", "employeeId") REFERENCES employees("companyId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE task_participants DROP CONSTRAINT IF EXISTS "task_participants_taskId_fkey";
ALTER TABLE task_participants DROP CONSTRAINT IF EXISTS "task_participants_employeeId_fkey";
ALTER TABLE task_participants DROP CONSTRAINT IF EXISTS "task_participants_company_project_fkey";
ALTER TABLE task_participants DROP CONSTRAINT IF EXISTS "task_participants_company_task_fkey";
ALTER TABLE task_participants DROP CONSTRAINT IF EXISTS "task_participants_company_employee_fkey";
ALTER TABLE task_participants
  ADD CONSTRAINT "task_participants_company_task_fkey"
  FOREIGN KEY ("companyId", "projectId", "taskId")
  REFERENCES project_tasks("companyId", "projectId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE task_participants
  ADD CONSTRAINT "task_participants_company_employee_fkey"
  FOREIGN KEY ("companyId", "employeeId") REFERENCES employees("companyId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS "task_submissions_companyId_projectId_taskId_id_key"
  ON task_submissions("companyId", "projectId", "taskId", id);
CREATE UNIQUE INDEX IF NOT EXISTS "task_submissions_companyId_id_key"
  ON task_submissions("companyId", id);
ALTER TABLE task_submissions DROP CONSTRAINT IF EXISTS "task_submissions_taskId_fkey";
ALTER TABLE task_submissions DROP CONSTRAINT IF EXISTS "task_submissions_submittedById_fkey";
ALTER TABLE task_submissions DROP CONSTRAINT IF EXISTS "task_submissions_company_project_fkey";
ALTER TABLE task_submissions DROP CONSTRAINT IF EXISTS "task_submissions_company_task_fkey";
ALTER TABLE task_submissions DROP CONSTRAINT IF EXISTS "task_submissions_company_submitter_fkey";
ALTER TABLE task_submissions
  ADD CONSTRAINT "task_submissions_company_task_fkey"
  FOREIGN KEY ("companyId", "projectId", "taskId")
  REFERENCES project_tasks("companyId", "projectId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE task_submissions
  ADD CONSTRAINT "task_submissions_company_submitter_fkey"
  FOREIGN KEY ("companyId", "submittedById") REFERENCES employees("companyId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE task_reviews
  ALTER COLUMN "companyId" SET NOT NULL,
  ALTER COLUMN "projectId" SET NOT NULL,
  ALTER COLUMN "taskId" SET NOT NULL;
ALTER TABLE task_reviews DROP CONSTRAINT IF EXISTS "task_reviews_submissionId_fkey";
ALTER TABLE task_reviews DROP CONSTRAINT IF EXISTS "task_reviews_reviewerId_fkey";
ALTER TABLE task_reviews DROP CONSTRAINT IF EXISTS "task_reviews_company_submission_fkey";
ALTER TABLE task_reviews DROP CONSTRAINT IF EXISTS "task_reviews_company_reviewer_fkey";
ALTER TABLE task_reviews
  ADD CONSTRAINT "task_reviews_company_submission_fkey"
  FOREIGN KEY ("companyId", "projectId", "taskId", "submissionId")
  REFERENCES task_submissions("companyId", "projectId", "taskId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE task_reviews
  ADD CONSTRAINT "task_reviews_company_reviewer_fkey"
  FOREIGN KEY ("companyId", "reviewerId") REFERENCES employees("companyId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS "project_documents_projectId_fkey";
ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS "project_documents_taskId_fkey";
ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS "project_documents_taskSubmissionId_fkey";
ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS "project_documents_fileObjectId_fkey";
ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS "project_documents_company_project_fkey";
ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS "project_documents_company_task_fkey";
ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS "project_documents_company_submission_fkey";
ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS "project_documents_company_file_fkey";
ALTER TABLE project_documents
  ADD CONSTRAINT "project_documents_company_project_fkey"
  FOREIGN KEY ("companyId", "projectId") REFERENCES projects("companyId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE project_documents
  ADD CONSTRAINT "project_documents_company_task_fkey"
  FOREIGN KEY ("companyId", "projectId", "taskId")
  REFERENCES project_tasks("companyId", "projectId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE project_documents
  ADD CONSTRAINT "project_documents_company_submission_fkey"
  FOREIGN KEY ("companyId", "projectId", "taskId", "taskSubmissionId")
  REFERENCES task_submissions("companyId", "projectId", "taskId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE project_documents
  ADD CONSTRAINT "project_documents_company_file_fkey"
  FOREIGN KEY ("companyId", "fileObjectId") REFERENCES file_objects("companyId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS "project_documents_target_shape_check";
ALTER TABLE project_documents
  ADD CONSTRAINT "project_documents_target_shape_check"
  CHECK ("taskSubmissionId" IS NULL OR "taskId" IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "work_log_headers_company_branch_employee_id_key"
  ON work_log_headers("companyId", "branchId", "employeeId", id);
ALTER TABLE work_log_headers DROP CONSTRAINT IF EXISTS "work_log_headers_employeeId_fkey";
ALTER TABLE work_log_headers DROP CONSTRAINT IF EXISTS "work_log_headers_company_employee_fkey";
ALTER TABLE work_log_headers DROP CONSTRAINT IF EXISTS "work_log_headers_company_fkey";
ALTER TABLE work_log_headers DROP CONSTRAINT IF EXISTS "work_log_headers_company_branch_fkey";
ALTER TABLE work_log_headers
  ADD CONSTRAINT "work_log_headers_company_fkey"
  FOREIGN KEY ("companyId") REFERENCES companies(id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE work_log_headers
  ADD CONSTRAINT "work_log_headers_company_branch_fkey"
  FOREIGN KEY ("companyId", "branchId") REFERENCES branches("companyId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE work_log_headers
  ADD CONSTRAINT "work_log_headers_company_employee_fkey"
  FOREIGN KEY ("companyId", "employeeId") REFERENCES employees("companyId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE work_log_lines DROP CONSTRAINT IF EXISTS "work_log_lines_taskId_fkey";
ALTER TABLE work_log_lines DROP CONSTRAINT IF EXISTS "work_log_lines_workLogHeaderId_fkey";
ALTER TABLE work_log_lines DROP CONSTRAINT IF EXISTS "work_log_lines_company_employee_fkey";
ALTER TABLE work_log_lines DROP CONSTRAINT IF EXISTS "work_log_lines_company_task_fkey";
ALTER TABLE work_log_lines DROP CONSTRAINT IF EXISTS "work_log_lines_company_header_fkey";
ALTER TABLE work_log_lines
  ADD CONSTRAINT "work_log_lines_company_header_fkey"
  FOREIGN KEY ("companyId", "branchId", "employeeId", "workLogHeaderId")
  REFERENCES work_log_headers("companyId", "branchId", "employeeId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE work_log_lines
  ADD CONSTRAINT "work_log_lines_company_task_fkey"
  FOREIGN KEY ("companyId", "taskId") REFERENCES project_tasks("companyId", id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE INDEX IF NOT EXISTS "file_upload_sessions_company_project_task_status_idx"
  ON file_upload_sessions("companyId", "projectId", "taskId", status);

CREATE TABLE IF NOT EXISTS project_daily_time_totals (
  "companyId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "totalHours" NUMERIC(8,2) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_daily_time_totals_pkey
    PRIMARY KEY ("companyId", "employeeId", "workDate"),
  CONSTRAINT project_daily_time_totals_company_fkey
    FOREIGN KEY ("companyId") REFERENCES companies(id) ON DELETE RESTRICT,
  CONSTRAINT project_daily_time_totals_employee_fkey
    FOREIGN KEY ("companyId", "employeeId") REFERENCES employees("companyId", id) ON DELETE RESTRICT,
  CONSTRAINT project_daily_time_totals_hours_check
    CHECK ("totalHours" >= 0 AND "totalHours" <= 24)
);
CREATE INDEX IF NOT EXISTS project_daily_time_totals_company_date_idx
  ON project_daily_time_totals("companyId", "workDate");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM work_log_lines l
    JOIN work_log_headers h ON h.id = l."workLogHeaderId"
    WHERE upper(trim(h.status)) <> 'CANCELLED'
    GROUP BY l."companyId", l."employeeId", l."workDate"::date
    HAVING SUM(l.hours) > 24
  ) THEN
    RAISE EXCEPTION 'TIMESHEET_DAILY_HOURS_RECONCILIATION_REQUIRED';
  END IF;
END $$;

INSERT INTO project_daily_time_totals("companyId", "employeeId", "workDate", "totalHours", "updatedAt")
SELECT l."companyId", l."employeeId", l."workDate"::date, SUM(l.hours), CURRENT_TIMESTAMP
FROM work_log_lines l
JOIN work_log_headers h ON h.id = l."workLogHeaderId"
WHERE upper(trim(h.status)) <> 'CANCELLED'
GROUP BY l."companyId", l."employeeId", l."workDate"::date
ON CONFLICT ("companyId", "employeeId", "workDate") DO UPDATE
SET "totalHours" = EXCLUDED."totalHours", "updatedAt" = CURRENT_TIMESTAMP;

CREATE OR REPLACE FUNCTION project_recalculate_daily_total(
  p_company_id text, p_employee_id text, p_work_date date
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_total numeric;
BEGIN
  IF p_company_id IS NULL OR p_employee_id IS NULL OR p_work_date IS NULL THEN RETURN; END IF;
  INSERT INTO project_daily_time_totals("companyId", "employeeId", "workDate", "totalHours", "updatedAt")
  VALUES (p_company_id, p_employee_id, p_work_date, 0, CURRENT_TIMESTAMP)
  ON CONFLICT ("companyId", "employeeId", "workDate") DO UPDATE
  SET "updatedAt" = project_daily_time_totals."updatedAt";

  SELECT COALESCE(SUM(l.hours), 0) INTO v_total
  FROM work_log_lines l JOIN work_log_headers h ON h.id = l."workLogHeaderId"
  WHERE l."companyId" = p_company_id AND l."employeeId" = p_employee_id
    AND l."workDate"::date = p_work_date
    AND upper(trim(h.status)) <> 'CANCELLED';
  IF v_total > 24 THEN PERFORM project_lite_raise('TIMESHEET_DAILY_HOURS_EXCEEDED'); END IF;
  UPDATE project_daily_time_totals
  SET "totalHours" = v_total, "updatedAt" = CURRENT_TIMESTAMP
  WHERE "companyId" = p_company_id AND "employeeId" = p_employee_id AND "workDate" = p_work_date;
END $$;

CREATE OR REPLACE FUNCTION project_daily_time_totals_sync()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM project_recalculate_daily_total(OLD."companyId", OLD."employeeId", OLD."workDate"::date);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM project_recalculate_daily_total(NEW."companyId", NEW."employeeId", NEW."workDate"::date);
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_work_log_daily_hours_guard ON work_log_lines;
DROP TRIGGER IF EXISTS trg_project_daily_time_totals_sync ON work_log_lines;
CREATE TRIGGER trg_project_daily_time_totals_sync
AFTER INSERT OR UPDATE OR DELETE ON work_log_lines
FOR EACH ROW EXECUTE FUNCTION project_daily_time_totals_sync();

CREATE OR REPLACE FUNCTION task_submission_history_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM project_lite_raise('PROJECT_HISTORY_IMMUTABLE'); END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW."companyId" IS DISTINCT FROM OLD."companyId"
     OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
     OR NEW."taskId" IS DISTINCT FROM OLD."taskId"
     OR NEW."versionNo" IS DISTINCT FROM OLD."versionNo"
     OR NEW."submissionNotes" IS DISTINCT FROM OLD."submissionNotes"
     OR NEW."submittedById" IS DISTINCT FROM OLD."submittedById"
     OR NEW."submittedByUserId" IS DISTINCT FROM OLD."submittedByUserId"
     OR NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt"
  THEN PERFORM project_lite_raise('PROJECT_HISTORY_IMMUTABLE'); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_task_submissions_history_guard ON task_submissions;
CREATE TRIGGER trg_task_submissions_history_guard
BEFORE UPDATE OR DELETE ON task_submissions
FOR EACH ROW EXECUTE FUNCTION task_submission_history_guard();

CREATE OR REPLACE FUNCTION task_review_history_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM project_lite_raise('PROJECT_HISTORY_IMMUTABLE');
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_task_reviews_history_guard ON task_reviews;
CREATE TRIGGER trg_task_reviews_history_guard
BEFORE UPDATE OR DELETE ON task_reviews
FOR EACH ROW EXECUTE FUNCTION task_review_history_guard();
