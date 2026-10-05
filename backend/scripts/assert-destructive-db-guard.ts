import { createHash } from 'node:crypto';

export const QA_STAGING_TARGET = Object.freeze({
  databaseName: 'dsp_erp_dev',
  databaseUser: 'dscape',
  databaseSchema: 'dsp_pms_stg',
  currentSchema: 'dsp_pms',
  sentinelKey: 'DSP-ERP-QA-STAGING',
  confirmationToken: 'CONFIRM-QA-WRITES:dsp_erp_dev:dsp_pms_stg',
  bootstrapToken: 'BOOTSTRAP-QA-SENTINEL:dsp_erp_dev:dsp_pms_stg',
});

const RETIRED_UAT_SCRIPTS = new Set(['e2e-uat-setup', 'e2e-uat-fix']);

type Environment = NodeJS.ProcessEnv | Record<string, string | undefined>;

export interface QaWriteTarget {
  databaseName: string;
  databaseUser: string;
  databaseSchema: string;
  sentinelKey: string;
}

export interface RawQueryClient {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
}

export interface RuntimeDatabaseIdentity {
  databaseName: string;
  databaseSchema: string | null;
  databaseUser: string;
}

interface RuntimeTargetRow extends RuntimeDatabaseIdentity {
  databaseSchemas: string[] | null;
  sentinelPresent: boolean;
  sentinelResolvesInApprovedSchema: boolean;
  sentinelSchema: string | null;
}

interface SchemaObjectRow {
  objectType: string;
  objectName: string;
  objectDefinition: string;
}

const SAFE_DATABASE_URL_QUERY_PARAMETERS = new Set([
  'schema',
  'sslmode',
  'sslrootcert',
  'sslcert',
  'sslkey',
  'sslpassword',
  'sslcrl',
  'ssl_min_protocol_version',
  'ssl_max_protocol_version',
  'sslnegotiation',
  'channel_binding',
  'gssencmode',
]);

const TARGET_CHANGING_DATABASE_URL_QUERY_PARAMETERS = new Set([
  'application_name',
  'database',
  'dbname',
  'host',
  'hostaddr',
  'options',
  'passfile',
  'password',
  'port',
  'search_path',
  'service',
  'servicefile',
  'user',
  'username',
]);

const POSTGRES_CONNECTION_OVERRIDE_ENVIRONMENT_KEYS = new Set([
  'PGAPPNAME',
  'PGCHANNELBINDING',
  'PGCONNECT_TIMEOUT',
  'PGDATABASE',
  'PGGSSDELEGATION',
  'PGGSSENCMODE',
  'PGHOST',
  'PGHOSTADDR',
  'PGKRBSRVNAME',
  'PGOPTIONS',
  'PGPASSFILE',
  'PGPASSWORD',
  'PGPORT',
  'PGREQUIREAUTH',
  'PGSERVICE',
  'PGSERVICEFILE',
  'PGSSLCERT',
  'PGSSLCOMPRESSION',
  'PGSSLCRL',
  'PGSSLKEY',
  'PGSSLMAXPROTOCOLVERSION',
  'PGSSLMINPROTOCOLVERSION',
  'PGSSLMODE',
  'PGSSLNEGOTIATION',
  'PGSSLROOTCERT',
  'PGSYSCONFDIR',
  'PGTARGETSESSIONATTRS',
  'PGUSER',
]);

function readRequiredEnvironment(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function readExactTargetEnvironment(env: Environment, name: string): string {
  const value = env[name];
  if (!value?.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export interface ParsedDatabaseUrl {
  databaseName: string;
  databaseUser: string;
  configuredSchema: string | null;
  safeQueryParameters: Array<[string, string]>;
  url: URL;
}

function parseDatabaseUrl(databaseUrl: string): ParsedDatabaseUrl {
  try {
    const runtimeUrl = new URL(
      databaseUrl.replace(/^postgres(?:ql)?\+asyncpg:\/\//i, 'postgresql://'),
    );
    if (
      runtimeUrl.protocol !== 'postgresql:' &&
      runtimeUrl.protocol !== 'postgres:'
    ) {
      throw new Error('database URL must use the PostgreSQL protocol');
    }
    if (!runtimeUrl.hostname) {
      throw new Error('database URL must name a host directly');
    }
    if (runtimeUrl.hash) {
      throw new Error('database URL must not contain a fragment');
    }

    const pathSegments = runtimeUrl.pathname
      .split('/')
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));

    if (pathSegments.length !== 1) {
      throw new Error('database path must contain exactly one database name');
    }

    const queryParameters = new Map<string, string[]>();
    for (const [rawName, value] of runtimeUrl.searchParams) {
      const name = rawName.toLowerCase();
      if (rawName !== name) {
        throw new Error(
          `DATABASE_URL query parameter "${rawName}" must use its canonical lowercase name.`,
        );
      }
      if (TARGET_CHANGING_DATABASE_URL_QUERY_PARAMETERS.has(name)) {
        throw new Error(
          `DATABASE_URL query parameter "${name}" can override the approved staging target.`,
        );
      }
      if (!SAFE_DATABASE_URL_QUERY_PARAMETERS.has(name)) {
        throw new Error(
          `DATABASE_URL query parameter "${name}" is not permitted for guarded staging writes.`,
        );
      }
      const values = queryParameters.get(name) ?? [];
      values.push(value);
      queryParameters.set(name, values);
    }

    for (const [name, values] of queryParameters) {
      if (values.length !== 1) {
        throw new Error(
          `DATABASE_URL query parameter "${name}" must not be repeated.`,
        );
      }
    }

    const configuredSchema = queryParameters.get('schema')?.[0] ?? null;
    return {
      databaseName: pathSegments[0],
      databaseUser: decodeURIComponent(runtimeUrl.username),
      configuredSchema,
      safeQueryParameters: [...queryParameters.entries()].map(
        ([name, values]) => [name, values[0]],
      ),
      url: runtimeUrl,
    };
  } catch {
    throw new Error('DATABASE_URL is invalid.');
  }
}

function assertExactQaStagingTarget(target: QaWriteTarget): void {
  if (target.databaseName !== QA_STAGING_TARGET.databaseName) {
    throw new Error(
      `DATABASE_NAME must be exactly "${QA_STAGING_TARGET.databaseName}" for QA writes.`,
    );
  }
  if (target.databaseUser !== QA_STAGING_TARGET.databaseUser) {
    throw new Error(
      `DATABASE_USER must be exactly "${QA_STAGING_TARGET.databaseUser}" for QA writes.`,
    );
  }
  if (target.databaseSchema !== QA_STAGING_TARGET.databaseSchema) {
    throw new Error(
      `DATABASE_SCHEMA must be exactly "${QA_STAGING_TARGET.databaseSchema}" for QA writes.`,
    );
  }
}

/**
 * libpq-style environment values can silently override parts of a connection
 * string. Guarded writers use DATABASE_URL and DATABASE_SSL_* only, so reject
 * every non-empty libpq connection override before a staging connection is
 * opened.
 */
export function assertNoPostgresEnvironmentOverrides(env: Environment): void {
  const override = Object.entries(env).find(
    ([name, value]) =>
      POSTGRES_CONNECTION_OVERRIDE_ENVIRONMENT_KEYS.has(name.toUpperCase()) &&
      Boolean(value?.trim()),
  );
  if (override) {
    throw new Error(
      `${override[0]} is not permitted for guarded staging writes. Use the canonical DATABASE_URL and DATABASE_SSL_* configuration instead.`,
    );
  }
}

/**
 * Preserves only transport/TLS URL settings and forces the approved schema.
 * It intentionally drops all user-controlled connection options before Prisma
 * is spawned in a separate process.
 */
export function createCanonicalStagingDatabaseUrl(
  databaseUrl: string,
  target: QaWriteTarget,
): string {
  assertExactQaStagingTarget(target);
  const parsedUrl = parseDatabaseUrl(databaseUrl);
  if (parsedUrl.databaseName !== target.databaseName) {
    throw new Error('DATABASE_URL database does not match DATABASE_NAME.');
  }
  if (parsedUrl.databaseUser !== target.databaseUser) {
    throw new Error('DATABASE_URL user does not match DATABASE_USER.');
  }
  if (
    parsedUrl.configuredSchema !== null &&
    parsedUrl.configuredSchema !== target.databaseSchema
  ) {
    throw new Error('DATABASE_URL schema does not match DATABASE_SCHEMA.');
  }

  const canonicalUrl = new URL(parsedUrl.url.toString());
  canonicalUrl.protocol = 'postgresql:';
  canonicalUrl.search = '';
  for (const [name, value] of parsedUrl.safeQueryParameters) {
    if (name !== 'schema') {
      canonicalUrl.searchParams.set(name, value);
    }
  }
  canonicalUrl.searchParams.set('schema', target.databaseSchema);
  return canonicalUrl.toString();
}

/**
 * Performs the connection-free half of the QA write guard.
 *
 * Every QA writer must call this before opening a connection, then call
 * assertQaStagingSentinel with that connection before its first mutation.
 */
export function assertQaWriteEnvironment(
  scriptName: string,
  env: Environment = process.env,
): QaWriteTarget {
  const nodeEnv = env.NODE_ENV?.trim() || 'development';
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new Error(
      `${scriptName} may only run when NODE_ENV is development or test.`,
    );
  }

  if (RETIRED_UAT_SCRIPTS.has(scriptName)) {
    throw new Error(
      `${scriptName} is retired because it selects and rewrites shared records. Use the guarded reference-data and run-manifest tooling instead.`,
    );
  }

  if (env.ALLOW_DESTRUCTIVE_DB_SCRIPTS !== 'true') {
    throw new Error(
      `Refusing QA writes. Set ALLOW_DESTRUCTIVE_DB_SCRIPTS=true only for the approved staging schema before running ${scriptName}.`,
    );
  }

  assertNoPostgresEnvironmentOverrides(env);

  const databaseName = readExactTargetEnvironment(env, 'DATABASE_NAME');
  const databaseUser = readExactTargetEnvironment(env, 'DATABASE_USER');
  const databaseSchema = readExactTargetEnvironment(env, 'DATABASE_SCHEMA');

  if (databaseSchema === QA_STAGING_TARGET.currentSchema) {
    throw new Error(
      `Refusing current schema "${QA_STAGING_TARGET.currentSchema}". QA writers may target only "${QA_STAGING_TARGET.databaseSchema}".`,
    );
  }
  assertExactQaStagingTarget({
    databaseName,
    databaseUser,
    databaseSchema,
    sentinelKey: QA_STAGING_TARGET.sentinelKey,
  });

  const databaseUrl = readRequiredEnvironment(env, 'DATABASE_URL');
  const parsedUrl = parseDatabaseUrl(databaseUrl);
  if (parsedUrl.databaseName !== databaseName) {
    throw new Error('DATABASE_URL database does not match DATABASE_NAME.');
  }
  if (parsedUrl.databaseUser !== databaseUser) {
    throw new Error('DATABASE_URL user does not match DATABASE_USER.');
  }
  if (
    parsedUrl.configuredSchema !== null &&
    parsedUrl.configuredSchema !== databaseSchema
  ) {
    throw new Error('DATABASE_URL schema does not match DATABASE_SCHEMA.');
  }

  const sentinelKey = readRequiredEnvironment(env, 'QA_STAGING_SENTINEL_KEY');
  if (sentinelKey !== QA_STAGING_TARGET.sentinelKey) {
    throw new Error(
      `QA_STAGING_SENTINEL_KEY must be exactly "${QA_STAGING_TARGET.sentinelKey}".`,
    );
  }

  const confirmationToken = readRequiredEnvironment(
    env,
    'QA_STAGING_CONFIRMATION_TOKEN',
  );
  if (confirmationToken !== QA_STAGING_TARGET.confirmationToken) {
    throw new Error(
      'QA_STAGING_CONFIRMATION_TOKEN does not match the staging target.',
    );
  }

  return { databaseName, databaseUser, databaseSchema, sentinelKey };
}

/**
 * Reads the connected identity for a diagnostic or dry-run without authorizing
 * a write. Call assertQaStagingSentinel separately before any mutation.
 */
export async function readRuntimeDatabaseIdentity(
  queryClient: RawQueryClient,
  scriptName: string,
): Promise<RuntimeDatabaseIdentity> {
  let rows: RuntimeDatabaseIdentity[];
  try {
    rows = await queryClient.$queryRawUnsafe<RuntimeDatabaseIdentity[]>(
      `SELECT current_database() AS "databaseName",
              current_schema() AS "databaseSchema",
              current_user AS "databaseUser"`,
    );
  } catch {
    throw new Error(
      `${scriptName} could not resolve the connected database target.`,
    );
  }

  const runtime = rows[0];
  if (!runtime) {
    throw new Error(
      `${scriptName} could not resolve the connected database target.`,
    );
  }
  return runtime;
}

/**
 * Performs the database-backed half of the QA write guard. Call it after a
 * connection is opened and before the first mutation.
 */
export async function assertQaStagingSentinel(
  queryClient: RawQueryClient,
  scriptName: string,
  target: QaWriteTarget,
): Promise<void> {
  assertExactQaStagingTarget(target);

  let rows: RuntimeTargetRow[];
  try {
    const quotedSchema = `"${target.databaseSchema.replaceAll('"', '""')}"`;
    const quotedSentinelTable = '"qa_environment_sentinel"';
    const sentinelRelation = `${target.databaseSchema}.qa_environment_sentinel`;
    rows = await queryClient.$queryRawUnsafe<RuntimeTargetRow[]>(
      `SELECT
         current_database() AS "databaseName",
         current_schema() AS "databaseSchema",
         array_to_json(current_schemas(false)) AS "databaseSchemas",
         current_user AS "databaseUser",
         (
           SELECT namespace.nspname
             FROM pg_catalog.pg_class relation
             JOIN pg_catalog.pg_namespace namespace
               ON namespace.oid = relation.relnamespace
            WHERE relation.oid = to_regclass($2)
         ) AS "sentinelSchema",
         to_regclass('qa_environment_sentinel') = to_regclass($2)
           AS "sentinelResolvesInApprovedSchema",
         EXISTS (
           SELECT 1
           FROM ${quotedSchema}.${quotedSentinelTable}
           WHERE sentinel_key = $1
             AND database_name = current_database()
             AND schema_name = current_schema()
             AND enabled = TRUE
         ) AS "sentinelPresent"`,
      target.sentinelKey,
      sentinelRelation,
    );
  } catch {
    throw new Error(
      `${scriptName} could not verify qa_environment_sentinel; no writes were authorized.`,
    );
  }

  const runtime = rows[0];
  if (!runtime) {
    throw new Error(
      `${scriptName} could not resolve the connected database target.`,
    );
  }
  if (runtime.databaseName !== target.databaseName) {
    throw new Error(`${scriptName} connected to an unexpected database.`);
  }
  if (runtime.databaseUser !== target.databaseUser) {
    throw new Error(`${scriptName} connected as an unexpected database user.`);
  }
  if (runtime.databaseSchema !== target.databaseSchema) {
    throw new Error(`${scriptName} connected to an unexpected schema.`);
  }
  if (
    !Array.isArray(runtime.databaseSchemas) ||
    runtime.databaseSchemas.length !== 1 ||
    runtime.databaseSchemas[0] !== target.databaseSchema
  ) {
    throw new Error(
      `${scriptName} connected with an unsafe search_path; only the approved staging schema may be effective.`,
    );
  }
  if (runtime.sentinelSchema !== target.databaseSchema) {
    throw new Error(
      `${scriptName} found qa_environment_sentinel outside the approved staging schema.`,
    );
  }
  if (!runtime.sentinelResolvesInApprovedSchema) {
    throw new Error(
      `${scriptName} resolved qa_environment_sentinel through an unsafe schema fallback.`,
    );
  }
  if (!runtime.sentinelPresent) {
    throw new Error(
      `${scriptName} found no enabled staging sentinel for the connected target.`,
    );
  }
}

function stripSqlCommentsAndLiterals(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/'(?:''|[^'])*'/g, "''");
}

/**
 * Rejects target-changing statements and relation/type references qualified
 * to any schema other than the approved staging schema.
 */
export function assertNoCrossSchemaReferences(
  sql: string,
  expectedSchema = QA_STAGING_TARGET.databaseSchema,
): void {
  const normalized = stripSqlCommentsAndLiterals(sql);
  if (/\bset\s+(?:local\s+)?search_path\b/i.test(normalized)) {
    throw new Error('QA SQL must not change search_path.');
  }

  for (const match of normalized.matchAll(
    /"?(dsp_pms(?:_[a-z0-9_$]+)?|public)"?\s*\.\s*"?([a-z_][\w$]*)"?/gi,
  )) {
    const referencedSchema = match[1].toLowerCase();
    if (referencedSchema !== expectedSchema.toLowerCase()) {
      throw new Error(
        `QA SQL references schema "${referencedSchema}"; only "${expectedSchema}" is permitted.`,
      );
    }
  }

  const relationPattern =
    /\b(?:from|join|update|into|references|table|type|sequence|view)\s+(?:only\s+)?(?:"([a-z_][\w$]*)"|([a-z_][\w$]*))\s*\.\s*(?:"[a-z_][\w$]*"|[a-z_][\w$]*)/gi;
  for (const match of normalized.matchAll(relationPattern)) {
    const referencedSchema = (match[1] ?? match[2]).toLowerCase();
    if (referencedSchema !== expectedSchema.toLowerCase()) {
      throw new Error(
        `QA SQL references schema "${referencedSchema}"; only "${expectedSchema}" is permitted.`,
      );
    }
  }
}

/**
 * Produces a deterministic structural fingerprint for before/after evidence.
 * It intentionally fingerprints metadata, not tenant or transaction data.
 */
export async function readQaSchemaFingerprint(
  queryClient: RawQueryClient,
  schema = QA_STAGING_TARGET.databaseSchema,
): Promise<string> {
  const rows = await queryClient.$queryRawUnsafe<SchemaObjectRow[]>(
    `SELECT object_type AS "objectType",
            object_name AS "objectName",
            object_definition AS "objectDefinition"
       FROM (
         SELECT 'column'::text AS object_type,
                table_name || '.' || column_name AS object_name,
                data_type || ':' || is_nullable || ':' || COALESCE(column_default, '') AS object_definition
           FROM information_schema.columns
          WHERE table_schema = $1
         UNION ALL
         SELECT 'index'::text, indexname, indexdef
           FROM pg_catalog.pg_indexes
          WHERE schemaname = $1
       ) objects
      ORDER BY object_type, object_name, object_definition`,
    schema,
  );

  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}

export function requiredEnv(name: string): string {
  return readRequiredEnvironment(process.env, name);
}
