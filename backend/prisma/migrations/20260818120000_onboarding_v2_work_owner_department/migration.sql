-- Onboarding V2: add DEPARTMENT to WorkOwnerType (must be committed before rows use it).
ALTER TYPE "WorkOwnerType" ADD VALUE IF NOT EXISTS 'DEPARTMENT';
