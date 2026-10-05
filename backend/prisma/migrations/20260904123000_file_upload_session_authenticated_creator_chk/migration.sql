-- Authenticated upload sessions authenticate via creatorUserId (Bearer),
-- not publicSessionTokenHash. The prior check blocked Finance/HR/Project
-- receipts created by signed-in users.
ALTER TABLE "file_upload_sessions"
  DROP CONSTRAINT IF EXISTS "file_upload_sessions_public_token_chk";

ALTER TABLE "file_upload_sessions"
  ADD CONSTRAINT "file_upload_sessions_public_token_chk" CHECK (
    "publicSessionTokenHash" IS NOT NULL
    OR "creatorUserId" IS NOT NULL
    OR "employeeId" IS NOT NULL
    OR "jobApplicationId" IS NOT NULL
    OR "purpose" = 'GENERATED_OFFER'
  );

-- Extended purposes (Finance / Payroll / Projects / HR requests) were added
-- after the original purpose-target check and were never allowed by it.
ALTER TABLE "file_upload_sessions"
  DROP CONSTRAINT IF EXISTS "file_upload_sessions_purpose_target_chk";

ALTER TABLE "file_upload_sessions"
  ADD CONSTRAINT "file_upload_sessions_purpose_target_chk" CHECK (
    (
      "purpose" IN ('CV', 'SUPPORTING')
      AND ("jobOpeningId" IS NOT NULL OR "jobApplicationId" IS NOT NULL)
    )
    OR ("purpose" = 'EMPLOYEE_DOCUMENT' AND "employeeId" IS NOT NULL)
    OR (
      "purpose" IN ('SIGNED_OFFER', 'GENERATED_OFFER')
      AND "jobOfferId" IS NOT NULL
    )
    OR (
      "purpose" = 'FINANCE_RECEIPT'
      AND "applicationOperationId" IS NOT NULL
    )
    OR (
      "purpose" = 'PAYROLL_PAYSLIP'
      AND ("employeeId" IS NOT NULL OR "applicationOperationId" IS NOT NULL)
    )
    OR ("purpose" = 'PROJECT_SUPPORTING' AND "projectId" IS NOT NULL)
    OR (
      "purpose" = 'HR_REQUEST_ATTACHMENT'
      AND "employeeId" IS NOT NULL
    )
  );
