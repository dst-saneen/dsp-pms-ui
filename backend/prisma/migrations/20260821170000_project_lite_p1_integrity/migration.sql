-- Project Lite P1 integrity (Phase 4): terminal Work Log immutability +
-- concurrency-safe daily-hours backstop. Apply only after disposable PG
-- rehearsals and Office Finance / Project migration-order reconciliation.
-- Do not apply to shared AWS RDS from this branch until Gate 5 sign-off.

-- ---------------------------------------------------------------------------
-- Terminal Work Log Header immutability (APPROVED / CANCELLED)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION work_log_header_terminal_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF upper(trim(OLD.status)) IN ('APPROVED', 'CANCELLED')
       OR upper(trim(COALESCE(OLD."statusV2"::text, ''))) IN ('APPROVED', 'CANCELLED')
    THEN
      PERFORM project_lite_raise('PROJECT_HISTORY_IMMUTABLE');
    END IF;
    RETURN OLD;
  END IF;

  IF upper(trim(OLD.status)) IN ('APPROVED', 'CANCELLED')
     OR upper(trim(COALESCE(OLD."statusV2"::text, ''))) IN ('APPROVED', 'CANCELLED')
  THEN
    -- Allow no-op updates that only touch updatedAt if values otherwise match.
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW."companyId" IS DISTINCT FROM OLD."companyId"
       OR NEW."employeeId" IS DISTINCT FROM OLD."employeeId"
       OR NEW."periodStart" IS DISTINCT FROM OLD."periodStart"
       OR NEW."periodEnd" IS DISTINCT FROM OLD."periodEnd"
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW."statusV2" IS DISTINCT FROM OLD."statusV2"
       OR NEW."totalHours" IS DISTINCT FROM OLD."totalHours"
       OR NEW.remarks IS DISTINCT FROM OLD.remarks
       OR NEW."reportingManagerEmployeeId" IS DISTINCT FROM OLD."reportingManagerEmployeeId"
       OR NEW."reportingManagerUserId" IS DISTINCT FROM OLD."reportingManagerUserId"
       OR NEW.version IS DISTINCT FROM OLD.version
    THEN
      PERFORM project_lite_raise('PROJECT_HISTORY_IMMUTABLE');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_log_headers_terminal_immutable ON work_log_headers;
CREATE TRIGGER trg_work_log_headers_terminal_immutable
  BEFORE UPDATE OR DELETE ON work_log_headers
  FOR EACH ROW
  EXECUTE FUNCTION work_log_header_terminal_guard();

-- ---------------------------------------------------------------------------
-- Terminal Work Log Line immutability when parent header is terminal
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION work_log_line_terminal_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  header_status text;
  header_status_v2 text;
BEGIN
  SELECT upper(trim(h.status)), upper(trim(COALESCE(h."statusV2"::text, '')))
    INTO header_status, header_status_v2
  FROM work_log_headers h
  WHERE h.id = COALESCE(NEW."workLogHeaderId", OLD."workLogHeaderId");

  IF header_status IN ('APPROVED', 'CANCELLED')
     OR header_status_v2 IN ('APPROVED', 'CANCELLED')
  THEN
    PERFORM project_lite_raise('PROJECT_HISTORY_IMMUTABLE');
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_log_lines_terminal_immutable ON work_log_lines;
CREATE TRIGGER trg_work_log_lines_terminal_immutable
  BEFORE INSERT OR UPDATE OR DELETE ON work_log_lines
  FOR EACH ROW
  EXECUTE FUNCTION work_log_line_terminal_guard();

-- ---------------------------------------------------------------------------
-- Daily hours concurrency backstop (still enforced in app TX with FOR UPDATE)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION work_log_daily_hours_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  employee_id text;
  work_day date;
  total numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    employee_id := OLD."employeeId";
    work_day := OLD."workDate"::date;
  ELSE
    employee_id := COALESCE(
      NEW."employeeId",
      (SELECT h."employeeId" FROM work_log_headers h WHERE h.id = NEW."workLogHeaderId")
    );
    work_day := NEW."workDate"::date;
  END IF;

  IF employee_id IS NULL OR work_day IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(l.hours), 0)
    INTO total
  FROM work_log_lines l
  JOIN work_log_headers h ON h.id = l."workLogHeaderId"
  WHERE COALESCE(l."employeeId", h."employeeId") = employee_id
    AND l."workDate"::date = work_day
    AND (TG_OP = 'DELETE' OR l.id IS DISTINCT FROM NEW.id)
    AND upper(trim(h.status)) NOT IN ('CANCELLED');

  IF TG_OP <> 'DELETE' THEN
    total := total + COALESCE(NEW.hours, 0);
  END IF;

  IF total > 24 THEN
    PERFORM project_lite_raise('TIMESHEET_DAILY_HOURS_EXCEEDED');
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_log_daily_hours_guard ON work_log_lines;
CREATE TRIGGER trg_work_log_daily_hours_guard
  BEFORE INSERT OR UPDATE OR DELETE ON work_log_lines
  FOR EACH ROW
  EXECUTE FUNCTION work_log_daily_hours_guard();
