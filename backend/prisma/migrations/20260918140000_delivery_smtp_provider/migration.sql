-- SMTP is a distinct transport from the ZeptoMail HTTP API. Existing rows
-- retain their historical provider; new rows record the transport that sent
-- the message.
ALTER TYPE "DeliveryProvider" ADD VALUE IF NOT EXISTS 'SMTP';
