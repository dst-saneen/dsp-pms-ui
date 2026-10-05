-- Allow Organization Owner to be created as the first Employee at setup time.
-- This is not a recruitment hire and not a legacy import bypass.

ALTER TYPE "EmployeeCreationSource" ADD VALUE IF NOT EXISTS 'ORGANIZATION_SETUP';
