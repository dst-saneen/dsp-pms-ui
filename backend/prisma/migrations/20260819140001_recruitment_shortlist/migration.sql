-- Add SHORTLISTED to JobApplicationStatus enum
-- PostgreSQL requires ALTER TYPE … ADD VALUE for enums; the value is inserted
-- between APPLIED and SCREENING so the logical order is preserved in pg_enum.
ALTER TYPE "JobApplicationStatus" ADD VALUE IF NOT EXISTS 'SHORTLISTED' AFTER 'APPLIED';

-- Add shortlistedAt timestamp to job_applications
ALTER TABLE "job_applications"
  ADD COLUMN IF NOT EXISTS "shortlistedAt" TIMESTAMP(3);
