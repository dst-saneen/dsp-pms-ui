-- Gate P0.10: short-lived encrypted invitation token envelope (raw token never in Outbox).
ALTER TABLE "user_invitations"
  ADD COLUMN IF NOT EXISTS "tokenCiphertext" TEXT;
