-- Job offer creation resolves this required value from the Company Financial
-- Profile. Existing offer values and the NOT NULL constraint remain unchanged.
ALTER TABLE "job_offers"
  ALTER COLUMN "compensationCurrency" DROP DEFAULT;
