const REDACTED = '[REDACTED]';
const MAX_LOG_STRING_LENGTH = 4_096;
const MAX_LOG_DEPTH = 6;

const SENSITIVE_KEYS = new Set([
  'accesstoken',
  'address',
  'apikey',
  'authorization',
  'bankaccount',
  'body',
  'connectionstring',
  'content',
  'cookie',
  'data',
  'databasepassword',
  'databaseurl',
  'dateofbirth',
  'dob',
  'documentbody',
  'documentcontent',
  'documentdata',
  'developmentverificationcode',
  'email',
  'emiratesid',
  'employee',
  'employeedata',
  'employeeprofile',
  'filebuffer',
  'filecontent',
  'filedata',
  'firstname',
  'fullname',
  'iban',
  'lastname',
  'nationalid',
  'parameters',
  'params',
  'passport',
  'passportnumber',
  'password',
  'passwd',
  'payload',
  'payroll',
  'phone',
  'proxyauthorization',
  'query',
  'record',
  'records',
  'refreshtoken',
  'salary',
  'secret',
  'setcookie',
  'sql',
  'token',
  'otp',
  'platformsetuptoken',
  'verificationcode',
  'zohosmtppassword',
]);

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.replace(/[-_\s]/g, '').toLowerCase());
}

function sanitizeString(value: string): string {
  const lines = value.split(/\r?\n/);
  const firstStackFrame = lines.findIndex((line) => /^\s*at\s/.test(line));
  const withoutStackMessage =
    firstStackFrame > 0 ? lines.slice(firstStackFrame).join('\n') : value;
  const sanitized = withoutStackMessage
    .replace(
      /\b(postgres(?:ql)?(?:\+asyncpg)?:\/\/)([^:\s/@]+):([^@\s/]+)@/gi,
      `$1${REDACTED}:${REDACTED}@`,
    )
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`)
    .replace(
      /([?&](?:access_token|api_key|authorization|password|secret|token)=)[^&#\s]+/gi,
      `$1${REDACTED}`,
    )
    .replace(/\bAKIA[A-Z0-9]{16}\b/g, REDACTED)
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,
      REDACTED,
    );

  return sanitized.length <= MAX_LOG_STRING_LENGTH
    ? sanitized
    : `${sanitized.slice(0, MAX_LOG_STRING_LENGTH)}…[TRUNCATED]`;
}

export function sanitizeLogValue(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return typeof value === 'bigint' ? value.toString() : value;
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return '[Function]';
  }

  if (depth >= MAX_LOG_DEPTH) {
    return '[TRUNCATED]';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return '[REDACTED_BINARY]';
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      ...(value.stack ? { stack: sanitizeString(value.stack) } : {}),
    };
  }

  if (typeof value !== 'object') {
    return '[UNSUPPORTED]';
  }

  if (seen.has(value)) {
    return '[CIRCULAR]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, seen, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(
      ([key, nestedValue]) => [
        key,
        isSensitiveKey(key)
          ? REDACTED
          : sanitizeLogValue(nestedValue, seen, depth + 1),
      ],
    ),
  );
}
