-- Project Lite Phase 6: bind upload sessions to Project/Task.
ALTER TABLE "file_upload_sessions"
  ADD COLUMN IF NOT EXISTS "projectId" TEXT,
  ADD COLUMN IF NOT EXISTS "taskId" TEXT;

CREATE INDEX IF NOT EXISTS "file_upload_sessions_companyId_projectId_idx"
  ON "file_upload_sessions" ("companyId", "projectId");

CREATE INDEX IF NOT EXISTS "file_upload_sessions_companyId_taskId_idx"
  ON "file_upload_sessions" ("companyId", "taskId");
