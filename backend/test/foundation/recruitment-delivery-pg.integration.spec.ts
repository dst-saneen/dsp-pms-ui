/**
 * Phase H — PostgreSQL schema gates for shortlist + delivery V2.
 * Skipped unless RECRUITMENT_DELIVERY_PG_TEST=1 so CI does not mutate a shared DB.
 */
import { createPrismaClient } from '../../scripts/create-prisma-client';

const describePg =
  process.env.RECRUITMENT_DELIVERY_PG_TEST === '1' ? describe : describe.skip;

describePg('Recruitment delivery PostgreSQL acceptance', () => {
  let prisma: Awaited<ReturnType<typeof createPrismaClient>>['prisma'];
  let disconnect: () => Promise<void>;

  beforeAll(async () => {
    const client = await createPrismaClient();
    prisma = client.prisma;
    disconnect = () => client.disconnect();
  });

  afterAll(async () => {
    await disconnect?.();
  });

  it('has SHORTLISTED on JobApplicationStatus and shortlistedAt on job_applications', async () => {
    const enums = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'JobApplicationStatus'
        AND e.enumlabel = 'SHORTLISTED'
    `;
    expect(enums).toHaveLength(1);

    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'job_applications'
        AND column_name = 'shortlistedAt'
    `;
    expect(columns).toHaveLength(1);
  });

  it('does not rewrite existing SCREENING / INTERVIEW / OFFER statuses', async () => {
    const rewritten = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*)::bigint AS n
      FROM "job_applications"
      WHERE "status"::text IN ('SCREENING', 'INTERVIEW', 'OFFER_SENT', 'OFFER_ACCEPTED')
        AND "shortlistedAt" IS NOT NULL
        AND "screeningStartedAt" IS NULL
    `;
    expect(Number(rewritten[0]?.n ?? 0)).toBe(0);
  });

  it('has delivery V2 tables required for monitoring', async () => {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE tablename IN (
        'delivery_messages',
        'delivery_attempts',
        'delivery_provider_events',
        'email_suppressions',
        'delivery_command_receipts'
      )
    `;
    expect(tables.map((row) => row.tablename).sort()).toEqual([
      'delivery_attempts',
      'delivery_command_receipts',
      'delivery_messages',
      'delivery_provider_events',
      'email_suppressions',
    ]);
  });

  it('seeds delivery monitoring permissions', async () => {
    const permissions = await prisma.$queryRaw<Array<{ code: string }>>`
      SELECT code
      FROM permissions
      WHERE code IN (
        'hr.recruitment.delivery.read',
        'hr.recruitment.delivery.retry',
        'platform.delivery.read',
        'platform.delivery.retry'
      )
      ORDER BY code
    `;
    expect(permissions.map((row) => row.code)).toEqual([
      'hr.recruitment.delivery.read',
      'hr.recruitment.delivery.retry',
      'platform.delivery.read',
      'platform.delivery.retry',
    ]);
  });
});
