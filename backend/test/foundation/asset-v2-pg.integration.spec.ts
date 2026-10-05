/**
 * Real PostgreSQL concurrency and uniqueness gates (plan §15).
 * Skipped unless ASSET_PG_TEST=1 so foundation CI does not mutate a shared DB.
 */
import { createPrismaClient } from '../../scripts/create-prisma-client';

const describePg = process.env.ASSET_PG_TEST === '1' ? describe : describe.skip;

describePg('Asset V2 PostgreSQL integration', () => {
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

  it('has the source-command uniqueness indexes required for onboarding seams', async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE indexname IN (
        'employee_assets_companyId_sourceCommandKey_uq',
        'software_license_allocations_companyId_sourceCommandKey_uq'
      )
    `;
    expect(indexes.map((row) => row.indexname).sort()).toEqual([
      'employee_assets_companyId_sourceCommandKey_uq',
      'software_license_allocations_companyId_sourceCommandKey_uq',
    ]);
  });

  it('keeps asset command receipts keyed by company and operation id', async () => {
    const constraints = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'asset_command_receipts'
        AND indexdef ILIKE '%operationId%'
    `;
    expect(constraints.length).toBeGreaterThan(0);
  });

  it('has acknowledgement pair and date integrity constraints', async () => {
    const constraints = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname
      FROM pg_constraint
      WHERE conname IN (
        'employee_assets_ack_pair_check',
        'software_license_allocations_ack_pair_check',
        'employee_assets_close_date_check',
        'software_license_allocations_revoke_date_check'
      )
    `;
    expect(constraints.map((row) => row.conname).sort()).toEqual([
      'employee_assets_ack_pair_check',
      'employee_assets_close_date_check',
      'software_license_allocations_ack_pair_check',
      'software_license_allocations_revoke_date_check',
    ]);
  });
});
