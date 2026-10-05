-- Gate P0.9: idempotent DeliveryProviderEvent inserts for webhook replays.
-- PostgreSQL UNIQUE allows multiple NULLs, so missing providerEventId/digest is fine.
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_provider_events_provider_canonicalPayloadDigest_key"
  ON "delivery_provider_events" ("provider", "canonicalPayloadDigest");

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_provider_events_provider_providerEventId_key"
  ON "delivery_provider_events" ("provider", "providerEventId");
