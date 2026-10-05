ALTER TABLE "companies"
ADD COLUMN "legal_country_code" VARCHAR(2);

ALTER TABLE "companies"
ADD CONSTRAINT "companies_legal_country_code_format"
CHECK (
  "legal_country_code" IS NULL
  OR "legal_country_code" ~ '^[A-Z]{2}$'
);

ALTER TABLE "pending_registrations"
ADD COLUMN "legal_country_code" VARCHAR(2);

ALTER TABLE "pending_registrations"
ADD CONSTRAINT "pending_registrations_legal_country_code_format"
CHECK (
  "legal_country_code" IS NULL
  OR "legal_country_code" ~ '^[A-Z]{2}$'
);
