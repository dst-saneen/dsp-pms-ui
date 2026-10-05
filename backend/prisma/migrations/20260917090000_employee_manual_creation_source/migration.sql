-- Distinguish normal employee creation from historical imports.
-- PostgreSQL enum extension is schema-neutral because Prisma supplies the
-- configured search_path for the target schema.
ALTER TYPE "EmployeeCreationSource" ADD VALUE IF NOT EXISTS 'MANUAL';
