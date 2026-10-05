import { requireSafeDatabaseSchema } from '../../scripts/create-prisma-client';

describe('script database schema safety', () => {
  it('requires an explicit safe PostgreSQL identifier before scripts create a connection', () => {
    expect(() => requireSafeDatabaseSchema(undefined)).toThrow(
      'DATABASE_SCHEMA is required.',
    );
    expect(() =>
      requireSafeDatabaseSchema('dsp_pms; DROP SCHEMA public'),
    ).toThrow('DATABASE_SCHEMA must be a valid PostgreSQL identifier.');
    expect(requireSafeDatabaseSchema('dsp_pms_stg')).toBe('dsp_pms_stg');
  });
});
