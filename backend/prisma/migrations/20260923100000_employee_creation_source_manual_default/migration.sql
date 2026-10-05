-- New direct Employee records are manual creations unless their creator explicitly
-- records a different source. Historical imported rows remain unchanged.
ALTER TABLE "employees" ALTER COLUMN "creationSource" SET DEFAULT 'MANUAL';
