-- Recruitment-to-Onboarding foundation (additive)

CREATE TYPE "JobOpeningStatus" AS ENUM ('DRAFT', 'OPEN', 'ON_HOLD', 'FILLED', 'CLOSED');
CREATE TYPE "JobApplicationStatus" AS ENUM (
  'APPLIED', 'SCREENING', 'INTERVIEW', 'MANAGER_REVIEW', 'SELECTED',
  'OFFER_SENT', 'OFFER_ACCEPTED', 'HIRED', 'REJECTED', 'WITHDRAWN', 'OFFER_DECLINED'
);
CREATE TYPE "InterviewSessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');
CREATE TYPE "InterviewMode" AS ENUM ('PHONE', 'VIDEO', 'IN_PERSON');
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'SUBMITTED');
CREATE TYPE "JobOfferStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED', 'SUPERSEDED');
CREATE TYPE "RecruitmentDocumentKind" AS ENUM ('CV', 'SUPPORTING', 'OFFER_PDF');
CREATE TYPE "MalwareScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED', 'QUARANTINED');
CREATE TYPE "ApplicationSource" AS ENUM ('PUBLIC_CAREERS', 'HR_INTERNAL');
CREATE TYPE "EmployeeCreationSource" AS ENUM ('RECRUITMENT', 'LEGACY_IMPORT');
CREATE TYPE "CareerEventType" AS ENUM (
  'APPLICATION_SUBMITTED', 'INTERVIEWS_COMPLETED', 'SELECTED', 'OFFER_ACCEPTED',
  'EMPLOYEE_CREATED', 'ONBOARDING_STARTED', 'ONBOARDING_COMPLETED', 'PROBATION_STARTED',
  'PROBATION_CONFIRMED', 'PROMOTION', 'TRANSFER', 'MANAGER_CHANGE', 'SEPARATION'
);
CREATE TYPE "CompensationPeriod" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "RecruitmentActorType" AS ENUM ('USER', 'SYSTEM', 'CANDIDATE');

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "creationSource" "EmployeeCreationSource" NOT NULL DEFAULT 'LEGACY_IMPORT',
  ADD COLUMN IF NOT EXISTS "sourceCandidateId" TEXT,
  ADD COLUMN IF NOT EXISTS "probationStartDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "probationPlannedEndDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "probationConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "probationConfirmedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "probationConfirmationNote" TEXT;

CREATE TABLE "candidates" (
  "id" TEXT NOT NULL,
  "companyGroupId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT,
  "email" TEXT NOT NULL,
  "normalizedEmail" TEXT NOT NULL,
  "mobile" TEXT,
  "normalizedMobile" TEXT,
  "source" TEXT,
  "employeeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_openings" (
  "id" TEXT NOT NULL,
  "openingCode" TEXT NOT NULL,
  "companyGroupId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "designationId" TEXT NOT NULL,
  "hiringManagerEmployeeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "employmentType" TEXT,
  "location" TEXT,
  "headcountTotal" INTEGER NOT NULL DEFAULT 1,
  "headcountFilled" INTEGER NOT NULL DEFAULT 0,
  "headcountReserved" INTEGER NOT NULL DEFAULT 0,
  "targetJoiningDate" TIMESTAMP(3),
  "applicationDeadline" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "status" "JobOpeningStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "job_openings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_opening_criteria" (
  "id" TEXT NOT NULL,
  "jobOpeningId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "weightPercent" DECIMAL(5,2) NOT NULL,
  "displayOrder" INTEGER NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "job_opening_criteria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_applications" (
  "id" TEXT NOT NULL,
  "applicationCode" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "jobOpeningId" TEXT NOT NULL,
  "source" "ApplicationSource" NOT NULL,
  "status" "JobApplicationStatus" NOT NULL DEFAULT 'APPLIED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "coverNote" TEXT,
  "privacyAcknowledgedAt" TIMESTAMP(3),
  "privacyAckVersion" TEXT,
  "submittedAt" TIMESTAMP(3),
  "screeningStartedAt" TIMESTAMP(3),
  "selectedAt" TIMESTAMP(3),
  "offerSentAt" TIMESTAMP(3),
  "offerAcceptedAt" TIMESTAMP(3),
  "hiredAt" TIMESTAMP(3),
  "employeeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_application_status_history" (
  "id" TEXT NOT NULL,
  "jobApplicationId" TEXT NOT NULL,
  "fromStatus" "JobApplicationStatus",
  "toStatus" "JobApplicationStatus" NOT NULL,
  "reasonCode" TEXT,
  "comment" TEXT,
  "actorType" "RecruitmentActorType" NOT NULL,
  "actorId" TEXT,
  "requestId" TEXT,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_application_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interview_sessions" (
  "id" TEXT NOT NULL,
  "jobApplicationId" TEXT NOT NULL,
  "roundNumber" INTEGER NOT NULL,
  "roundName" TEXT NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "scheduledStartAt" TIMESTAMP(3) NOT NULL,
  "scheduledEndAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "mode" "InterviewMode" NOT NULL,
  "locationOrLink" TEXT,
  "evaluationDeadlineAt" TIMESTAMP(3),
  "status" "InterviewSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "cancellationReason" TEXT,
  "rescheduleReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interview_panel_members" (
  "id" TEXT NOT NULL,
  "interviewSessionId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "userId" TEXT,
  "isLead" BOOLEAN NOT NULL DEFAULT false,
  "assignmentStatus" TEXT NOT NULL DEFAULT 'ASSIGNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "interview_panel_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interview_evaluations" (
  "id" TEXT NOT NULL,
  "interviewSessionId" TEXT NOT NULL,
  "panelMemberId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT',
  "recommendation" TEXT,
  "strengths" TEXT,
  "concerns" TEXT,
  "confidentialNotes" TEXT,
  "weightedTotal" DECIMAL(8,2),
  "submittedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "interview_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interview_evaluation_scores" (
  "id" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "criterionId" TEXT NOT NULL,
  "criterionNameSnapshot" TEXT NOT NULL,
  "weightPercentSnapshot" DECIMAL(5,2) NOT NULL,
  "score" INTEGER NOT NULL,
  "weightedContribution" DECIMAL(8,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "interview_evaluation_scores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recruitment_documents" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT,
  "jobApplicationId" TEXT,
  "jobOfferId" TEXT,
  "kind" "RecruitmentDocumentKind" NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "scanStatus" "MalwareScanStatus" NOT NULL DEFAULT 'PENDING',
  "scannedAt" TIMESTAMP(3),
  "uploadedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruitment_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_offers" (
  "id" TEXT NOT NULL,
  "jobApplicationId" TEXT NOT NULL,
  "versionNo" INTEGER NOT NULL,
  "status" "JobOfferStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "designationId" TEXT NOT NULL,
  "reportingManagerEmployeeId" TEXT NOT NULL,
  "employmentType" TEXT,
  "joiningDate" TIMESTAMP(3) NOT NULL,
  "compensationAmount" DECIMAL(14,2) NOT NULL,
  "compensationCurrency" TEXT NOT NULL DEFAULT 'INR',
  "compensationPeriod" "CompensationPeriod" NOT NULL DEFAULT 'MONTHLY',
  "probationDays" INTEGER NOT NULL DEFAULT 90,
  "expiryDate" TIMESTAMP(3) NOT NULL,
  "termsText" TEXT,
  "recruitmentDocumentId" TEXT,
  "responseTokenHash" TEXT,
  "responseTokenExpiresAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "respondedLegalName" TEXT,
  "responseEvidence" JSONB,
  "sentAt" TIMESTAMP(3),
  "sentByUserId" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT,
  "supersededByOfferId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "job_offers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_career_events" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "eventType" "CareerEventType" NOT NULL,
  "eventAt" TIMESTAMP(3) NOT NULL,
  "employeeVisibleSummary" TEXT NOT NULL,
  "hrDetailReference" TEXT,
  "sourceModule" TEXT NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "auditReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_career_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "designation_onboarding_assignments" (
  "id" TEXT NOT NULL,
  "designationId" TEXT NOT NULL,
  "branchId" TEXT,
  "onboardingTemplateId" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "designation_onboarding_assignments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "company_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "designations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_hiringManagerEmployeeId_fkey" FOREIGN KEY ("hiringManagerEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "job_opening_criteria" ADD CONSTRAINT "job_opening_criteria_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "job_openings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidates" ADD CONSTRAINT "candidates_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "company_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "job_openings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_application_status_history" ADD CONSTRAINT "job_application_status_history_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "interview_panel_members" ADD CONSTRAINT "interview_panel_members_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_panel_members" ADD CONSTRAINT "interview_panel_members_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "interview_evaluations" ADD CONSTRAINT "interview_evaluations_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_evaluations" ADD CONSTRAINT "interview_evaluations_panelMemberId_fkey" FOREIGN KEY ("panelMemberId") REFERENCES "interview_panel_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_evaluations" ADD CONSTRAINT "interview_evaluations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "interview_evaluation_scores" ADD CONSTRAINT "interview_evaluation_scores_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "interview_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_evaluation_scores" ADD CONSTRAINT "interview_evaluation_scores_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "job_opening_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recruitment_documents" ADD CONSTRAINT "recruitment_documents_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_documents" ADD CONSTRAINT "recruitment_documents_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recruitment_documents" ADD CONSTRAINT "recruitment_documents_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "job_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "job_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_reportingManagerEmployeeId_fkey" FOREIGN KEY ("reportingManagerEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_recruitmentDocumentId_fkey" FOREIGN KEY ("recruitmentDocumentId") REFERENCES "recruitment_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_supersededByOfferId_fkey" FOREIGN KEY ("supersededByOfferId") REFERENCES "job_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_career_events" ADD CONSTRAINT "employee_career_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "designation_onboarding_assignments" ADD CONSTRAINT "designation_onboarding_assignments_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "designations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "designation_onboarding_assignments" ADD CONSTRAINT "designation_onboarding_assignments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "designation_onboarding_assignments" ADD CONSTRAINT "designation_onboarding_assignments_onboardingTemplateId_fkey" FOREIGN KEY ("onboardingTemplateId") REFERENCES "OnboardingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "job_openings_companyId_openingCode_key" ON "job_openings"("companyId", "openingCode");
CREATE INDEX "job_openings_companyGroupId_idx" ON "job_openings"("companyGroupId");
CREATE INDEX "job_openings_companyId_status_idx" ON "job_openings"("companyId", "status");
CREATE INDEX "job_openings_branchId_status_idx" ON "job_openings"("branchId", "status");
CREATE INDEX "job_openings_applicationDeadline_idx" ON "job_openings"("applicationDeadline");
CREATE INDEX "job_openings_hiringManagerEmployeeId_idx" ON "job_openings"("hiringManagerEmployeeId");

CREATE UNIQUE INDEX "job_opening_criteria_jobOpeningId_displayOrder_key" ON "job_opening_criteria"("jobOpeningId", "displayOrder");
CREATE INDEX "job_opening_criteria_jobOpeningId_idx" ON "job_opening_criteria"("jobOpeningId");

CREATE UNIQUE INDEX "candidates_companyGroupId_normalizedEmail_key" ON "candidates"("companyGroupId", "normalizedEmail");
CREATE INDEX "candidates_companyGroupId_idx" ON "candidates"("companyGroupId");
CREATE INDEX "candidates_employeeId_idx" ON "candidates"("employeeId");

CREATE UNIQUE INDEX "job_applications_candidateId_jobOpeningId_key" ON "job_applications"("candidateId", "jobOpeningId");
CREATE UNIQUE INDEX "job_applications_applicationCode_key" ON "job_applications"("applicationCode");
CREATE INDEX "job_applications_jobOpeningId_status_idx" ON "job_applications"("jobOpeningId", "status");
CREATE INDEX "job_applications_candidateId_idx" ON "job_applications"("candidateId");
CREATE INDEX "job_applications_employeeId_idx" ON "job_applications"("employeeId");

CREATE INDEX "job_application_status_history_jobApplicationId_createdAt_idx" ON "job_application_status_history"("jobApplicationId", "createdAt");

CREATE INDEX "interview_sessions_jobApplicationId_idx" ON "interview_sessions"("jobApplicationId");
CREATE INDEX "interview_sessions_scheduledStartAt_idx" ON "interview_sessions"("scheduledStartAt");

CREATE UNIQUE INDEX "interview_panel_members_interviewSessionId_employeeId_key" ON "interview_panel_members"("interviewSessionId", "employeeId");
CREATE INDEX "interview_panel_members_employeeId_idx" ON "interview_panel_members"("employeeId");

CREATE UNIQUE INDEX "interview_evaluations_panelMemberId_key" ON "interview_evaluations"("panelMemberId");
CREATE UNIQUE INDEX "interview_evaluations_interviewSessionId_panelMemberId_key" ON "interview_evaluations"("interviewSessionId", "panelMemberId");
CREATE INDEX "interview_evaluations_employeeId_idx" ON "interview_evaluations"("employeeId");

CREATE UNIQUE INDEX "interview_evaluation_scores_evaluationId_criterionId_key" ON "interview_evaluation_scores"("evaluationId", "criterionId");

CREATE INDEX "recruitment_documents_candidateId_idx" ON "recruitment_documents"("candidateId");
CREATE INDEX "recruitment_documents_jobApplicationId_idx" ON "recruitment_documents"("jobApplicationId");
CREATE INDEX "recruitment_documents_jobOfferId_idx" ON "recruitment_documents"("jobOfferId");
CREATE INDEX "recruitment_documents_scanStatus_idx" ON "recruitment_documents"("scanStatus");

CREATE UNIQUE INDEX "job_offers_jobApplicationId_versionNo_key" ON "job_offers"("jobApplicationId", "versionNo");
CREATE UNIQUE INDEX "job_offers_recruitmentDocumentId_key" ON "job_offers"("recruitmentDocumentId");
CREATE INDEX "job_offers_jobApplicationId_status_idx" ON "job_offers"("jobApplicationId", "status");
CREATE INDEX "job_offers_status_idx" ON "job_offers"("status");

CREATE INDEX "employee_career_events_employeeId_eventAt_idx" ON "employee_career_events"("employeeId", "eventAt");
CREATE INDEX "employee_career_events_eventType_idx" ON "employee_career_events"("eventType");

CREATE INDEX "designation_onboarding_assignments_designationId_branchId_isActive_idx" ON "designation_onboarding_assignments"("designationId", "branchId", "isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "employees_sourceCandidateId_key" ON "employees"("sourceCandidateId");
CREATE INDEX IF NOT EXISTS "employees_creationSource_idx" ON "employees"("creationSource");

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_sourceCandidateId_fkey"
  FOREIGN KEY ("sourceCandidateId") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_probationConfirmedByUserId_fkey"
  FOREIGN KEY ("probationConfirmedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "code", "name", "description", "updatedAt")
VALUES
  (md5('permission:hr.recruitment.read'), 'hr.recruitment.read', 'View recruitment', NULL, CURRENT_TIMESTAMP),
  (md5('permission:hr.recruitment.manage'), 'hr.recruitment.manage', 'Manage recruitment', NULL, CURRENT_TIMESTAMP),
  (md5('permission:hr.recruitment.offer'), 'hr.recruitment.offer', 'Manage recruitment offers', NULL, CURRENT_TIMESTAMP),
  (md5('permission:hr.recruitment.convert'), 'hr.recruitment.convert', 'Convert candidates to employees', NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    ('ORGANIZATION_OWNER', 'hr.recruitment.read'),
    ('ORGANIZATION_OWNER', 'hr.recruitment.manage'),
    ('ORGANIZATION_OWNER', 'hr.recruitment.offer'),
    ('ORGANIZATION_OWNER', 'hr.recruitment.convert'),
    ('COMPANY_ADMINISTRATOR', 'hr.recruitment.read'),
    ('COMPANY_ADMINISTRATOR', 'hr.recruitment.manage'),
    ('COMPANY_ADMINISTRATOR', 'hr.recruitment.offer'),
    ('COMPANY_ADMINISTRATOR', 'hr.recruitment.convert'),
    ('HR_MANAGER', 'hr.recruitment.read'),
    ('HR_MANAGER', 'hr.recruitment.manage'),
    ('HR_MANAGER', 'hr.recruitment.offer'),
    ('HR_MANAGER', 'hr.recruitment.convert')
)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT md5('role-permission:' || m."roleCode" || ':' || m."permissionCode"), r."id", p."id"
FROM mappings m
JOIN "roles" r ON r."code" = m."roleCode"
JOIN "permissions" p ON p."code" = m."permissionCode"
ON CONFLICT DO NOTHING;
