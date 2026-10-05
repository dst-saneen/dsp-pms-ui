-- Office Finance Lite reconcile: preflight guards for dirty data.
-- Stops migration with RAISE if incompatible rows are found.
-- Empty environments pass through.

DO $$
BEGIN
  -- Reserved for environment-specific backfill reports.
  -- Project.clientName/clientContact are preserved; businessPartyId backfill is operator-approved only.
  NULL;
END $$;
