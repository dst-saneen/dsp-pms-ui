import { createHash } from 'node:crypto';

export const IMMUTABLE_LEGACY_SCHEMA_QUALIFIED_MIGRATIONS = Object.freeze({
  'prisma/migrations/20260819140000_secure_file_storage_and_signed_offer/migration.sql':
    '9ec71278c78cef0d607f9bde9d86cc7a7f5559cd4afa797a50efff7aa60d2ef5',
  'prisma/migrations/20260820120000_secure_file_storage_contract_hardening/migration.sql':
    'd6b3f1b0aa2b70962fc44ba98b42f1c046ba45f74523ad6797c1de2b739f3fd9',
  'prisma/migrations/20260820134000_delivery_v2_production_expand/migration.sql':
    '153d6173e67344971e4adb2b44a35958798e1d2c4a68fd0259c3b6be71ebeb3d',
  'prisma/migrations/20260821130000_office_finance_lite_expand/migration.sql':
    '6ac389c3149881b9bbd04edb4fa9fe1450241710b6292ce462f655a2bb5c3211',
  'prisma/migrations/20260821140000_payroll_lite_expand/migration.sql':
    '657b8aaa8fc326787f5fd7102594c18c069b378e6313d9d74433e519abad3d3e',
  'prisma/migrations/20260826130000_leave_request_company_scope/migration.sql':
    '279bcfe32508ba556177aff83790efd06d82b40de90a6e47bca060722bdc3b18',
});

type SqlTokenKind =
  'WORD' | 'QUOTED_IDENTIFIER' | 'STRING' | 'DOLLAR_STRING' | 'SYMBOL';

type SqlToken = {
  kind: SqlTokenKind;
  value: string;
};

const ALLOWED_SYSTEM_OR_RECORD_QUALIFIERS = new Set([
  'excluded',
  'information_schema',
  'new',
  'old',
  'pg_catalog',
]);

const RELATION_OR_OBJECT_KEYWORDS = new Set([
  'analyze',
  'call',
  'from',
  'function',
  'index',
  'into',
  'join',
  'procedure',
  'references',
  'sequence',
  'table',
  'truncate',
  'type',
  'update',
  'vacuum',
  'view',
]);

const OBJECT_NAME_LITERAL_FUNCTIONS = new Set([
  'currval',
  'nextval',
  'setval',
  'to_regclass',
  'to_regnamespace',
  'to_regoper',
  'to_regoperator',
  'to_regproc',
  'to_regprocedure',
  'to_regrole',
  'to_regtype',
]);

const REGISTRY_CAST_TYPES = new Set([
  'regclass',
  'regnamespace',
  'regoper',
  'regoperator',
  'regproc',
  'regprocedure',
  'regrole',
  'regtype',
]);

function isIdentifier(token: SqlToken | undefined): token is SqlToken {
  return token?.kind === 'WORD' || token?.kind === 'QUOTED_IDENTIFIER';
}

function identifierValue(token: SqlToken | undefined): string | null {
  return isIdentifier(token) ? token.value.toLowerCase() : null;
}

function isKeyword(token: SqlToken | undefined, keyword: string): boolean {
  return token?.kind === 'WORD' && token.value.toLowerCase() === keyword;
}

function isSymbol(token: SqlToken | undefined, symbol: string): boolean {
  return token?.kind === 'SYMBOL' && token.value === symbol;
}

function lexSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let index = 0;

  const readSingleQuotedString = (
    quoteIndex: number,
    backslashEscapes: boolean,
  ): { token: SqlToken; nextIndex: number } => {
    let cursor = quoteIndex + 1;
    let value = '';
    while (cursor < sql.length) {
      const character = sql[cursor];
      if (character === "'") {
        if (sql[cursor + 1] === "'") {
          value += "'";
          cursor += 2;
          continue;
        }
        return {
          token: { kind: 'STRING', value },
          nextIndex: cursor + 1,
        };
      }
      if (backslashEscapes && character === '\\' && cursor + 1 < sql.length) {
        value += sql[cursor + 1];
        cursor += 2;
        continue;
      }
      value += character;
      cursor += 1;
    }
    return { token: { kind: 'STRING', value }, nextIndex: cursor };
  };

  while (index < sql.length) {
    const character = sql[index];
    const next = sql[index + 1];

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    if (character === '-' && next === '-') {
      index += 2;
      while (index < sql.length && !/[\r\n]/.test(sql[index])) {
        index += 1;
      }
      continue;
    }

    if (character === '/' && next === '*') {
      let depth = 1;
      index += 2;
      while (index < sql.length && depth > 0) {
        if (sql[index] === '/' && sql[index + 1] === '*') {
          depth += 1;
          index += 2;
        } else if (sql[index] === '*' && sql[index + 1] === '/') {
          depth -= 1;
          index += 2;
        } else {
          index += 1;
        }
      }
      continue;
    }

    if (character === '"') {
      let cursor = index + 1;
      let value = '';
      while (cursor < sql.length) {
        if (sql[cursor] === '"') {
          if (sql[cursor + 1] === '"') {
            value += '"';
            cursor += 2;
            continue;
          }
          cursor += 1;
          break;
        }
        value += sql[cursor];
        cursor += 1;
      }
      tokens.push({ kind: 'QUOTED_IDENTIFIER', value });
      index = cursor;
      continue;
    }

    if (character === "'") {
      const result = readSingleQuotedString(index, false);
      tokens.push(result.token);
      index = result.nextIndex;
      continue;
    }

    if (
      /[eEbBxXnN]/.test(character) &&
      next === "'" &&
      (index === 0 || !/[A-Za-z0-9_$]/.test(sql[index - 1]))
    ) {
      const result = readSingleQuotedString(
        index + 1,
        character.toLowerCase() === 'e',
      );
      tokens.push(result.token);
      index = result.nextIndex;
      continue;
    }

    if (
      /[uU]/.test(character) &&
      next === '&' &&
      sql[index + 2] === "'" &&
      (index === 0 || !/[A-Za-z0-9_$]/.test(sql[index - 1]))
    ) {
      const result = readSingleQuotedString(index + 2, true);
      tokens.push(result.token);
      index = result.nextIndex;
      continue;
    }

    if (character === '$') {
      const delimiter = sql
        .slice(index)
        .match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
      if (delimiter) {
        const contentStart = index + delimiter.length;
        const contentEnd = sql.indexOf(delimiter, contentStart);
        if (contentEnd === -1) {
          tokens.push({
            kind: 'DOLLAR_STRING',
            value: sql.slice(contentStart),
          });
          break;
        }
        tokens.push({
          kind: 'DOLLAR_STRING',
          value: sql.slice(contentStart, contentEnd),
        });
        index = contentEnd + delimiter.length;
        continue;
      }
    }

    if (/[A-Za-z_]/.test(character)) {
      let cursor = index + 1;
      while (cursor < sql.length && /[A-Za-z0-9_$]/.test(sql[cursor])) {
        cursor += 1;
      }
      tokens.push({ kind: 'WORD', value: sql.slice(index, cursor) });
      index = cursor;
      continue;
    }

    if (character === ':' && next === ':') {
      tokens.push({ kind: 'SYMBOL', value: '::' });
      index += 2;
      continue;
    }

    tokens.push({ kind: 'SYMBOL', value: character });
    index += 1;
  }

  return tokens;
}

function statementStart(
  tokens: ReadonlyArray<SqlToken>,
  index: number,
): number {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (isSymbol(tokens[cursor], ';')) {
      return cursor + 1;
    }
  }
  return 0;
}

function statementHasKeywords(
  tokens: ReadonlyArray<SqlToken>,
  index: number,
  required: ReadonlyArray<string>,
): boolean {
  const start = statementStart(tokens, index);
  const words = new Set(
    tokens
      .slice(start, index)
      .filter((token) => token.kind === 'WORD')
      .map((token) => token.value.toLowerCase()),
  );
  return required.every((keyword) => words.has(keyword));
}

function isProceduralBody(
  tokens: ReadonlyArray<SqlToken>,
  index: number,
): boolean {
  if (isKeyword(tokens[index - 1], 'as')) {
    return true;
  }
  const start = statementStart(tokens, index);
  const firstWord = tokens
    .slice(start, index)
    .find((token) => token.kind === 'WORD');
  return isKeyword(firstWord, 'do');
}

function qualifiedNameAt(
  tokens: ReadonlyArray<SqlToken>,
  index: number,
): { schema: string; object: string } | null {
  if (
    !isIdentifier(tokens[index]) ||
    !isSymbol(tokens[index + 1], '.') ||
    !isIdentifier(tokens[index + 2])
  ) {
    return null;
  }
  return {
    schema: tokens[index].value,
    object: tokens[index + 2].value,
  };
}

function parseQualifiedObjectLiteral(
  value: string,
): { schema: string; object: string } | null {
  const match = value.match(
    /^\s*"?([A-Za-z_][\w$]*)"?\s*\.\s*"?([A-Za-z_][\w$]*)"?\s*$/,
  );
  return match ? { schema: match[1], object: match[2] } : null;
}

function addReference(
  references: Set<string>,
  qualified: { schema: string; object: string } | null,
): void {
  if (!qualified) {
    return;
  }
  const schema = qualified.schema.toLowerCase();
  if (!ALLOWED_SYSTEM_OR_RECORD_QUALIFIERS.has(schema)) {
    references.add(`${qualified.schema}.${qualified.object}`);
  }
}

function collectExplicitSchemaReferences(
  sql: string,
  references: Set<string>,
): void {
  const tokens = lexSql(sql);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const qualified = qualifiedNameAt(tokens, index);
    const schema = qualified?.schema.toLowerCase();

    if (
      schema &&
      (schema === 'public' || /^dsp_pms(?:_[a-z0-9_$]+)?$/.test(schema))
    ) {
      addReference(references, qualified);
    }

    if (
      qualified &&
      (isSymbol(tokens[index - 1], '::') || isSymbol(tokens[index + 3], '('))
    ) {
      addReference(references, qualified);
    }

    if (
      token.kind === 'WORD' &&
      RELATION_OR_OBJECT_KEYWORDS.has(token.value.toLowerCase()) &&
      !(isKeyword(token, 'from') && isKeyword(tokens[index - 1], 'distinct'))
    ) {
      let objectIndex = index + 1;
      while (
        ['if', 'not', 'exists', 'only', 'concurrently', 'table'].some(
          (modifier) => isKeyword(tokens[objectIndex], modifier),
        )
      ) {
        objectIndex += 1;
      }
      addReference(references, qualifiedNameAt(tokens, objectIndex));
    }

    if (
      isKeyword(token, 'on') &&
      (statementHasKeywords(tokens, index, ['create', 'index']) ||
        statementHasKeywords(tokens, index, ['grant']) ||
        statementHasKeywords(tokens, index, ['revoke']))
    ) {
      let objectIndex = index + 1;
      if (isKeyword(tokens[objectIndex], 'table')) {
        objectIndex += 1;
      }
      addReference(references, qualifiedNameAt(tokens, objectIndex));
    }

    if (token.kind === 'STRING') {
      let registryType: string | null = null;
      if (isSymbol(tokens[index + 1], '::')) {
        let typeIndex = index + 2;
        if (
          identifierValue(tokens[typeIndex]) === 'pg_catalog' &&
          isSymbol(tokens[typeIndex + 1], '.')
        ) {
          typeIndex += 2;
        }
        registryType = identifierValue(tokens[typeIndex]);
      }
      const calledFunction = isSymbol(tokens[index - 1], '(')
        ? identifierValue(tokens[index - 2])
        : null;
      if (
        (registryType && REGISTRY_CAST_TYPES.has(registryType)) ||
        (calledFunction && OBJECT_NAME_LITERAL_FUNCTIONS.has(calledFunction))
      ) {
        addReference(references, parseQualifiedObjectLiteral(token.value));
      }
    }

    if (
      (token.kind === 'STRING' || token.kind === 'DOLLAR_STRING') &&
      isProceduralBody(tokens, index)
    ) {
      collectExplicitSchemaReferences(token.value, references);
    }
  }
}

export function findExplicitSchemaReferences(sql: string): string[] {
  const references = new Set<string>();
  collectExplicitSchemaReferences(sql, references);
  return [...references].sort();
}

function collectSchemaNeutralityViolations(
  sql: string,
  violations: Set<string>,
): void {
  const tokens = lexSql(sql);

  for (const reference of findExplicitSchemaReferences(sql)) {
    violations.add(`schema reference ${reference}`);
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (isKeyword(token, 'set')) {
      let settingIndex = index + 1;
      if (
        isKeyword(tokens[settingIndex], 'local') ||
        isKeyword(tokens[settingIndex], 'session')
      ) {
        settingIndex += 1;
      }
      const setting = identifierValue(tokens[settingIndex]);
      if (setting === 'search_path') {
        violations.add('search_path mutation');
      }
      if (setting === 'schema') {
        violations.add(
          statementHasKeywords(tokens, index, ['alter'])
            ? 'schema namespace mutation'
            : 'search_path mutation',
        );
      }
    }

    if (isKeyword(token, 'reset')) {
      const setting = identifierValue(tokens[index + 1]);
      if (setting === 'search_path') {
        violations.add('search_path mutation');
      }
      if (setting === 'all') {
        violations.add('session configuration reset');
      }
    }

    if (isKeyword(token, 'discard') && isKeyword(tokens[index + 1], 'all')) {
      violations.add('session configuration reset');
    }

    if (
      (isKeyword(token, 'create') ||
        isKeyword(token, 'drop') ||
        isKeyword(token, 'alter')) &&
      isKeyword(tokens[index + 1], 'schema')
    ) {
      violations.add('schema namespace mutation');
    }

    if (
      identifierValue(token) === 'set_config' &&
      isSymbol(tokens[index + 1], '(')
    ) {
      violations.add('set_config call');
    }

    if (isKeyword(token, 'execute')) {
      const staticTriggerCall =
        (isKeyword(tokens[index + 1], 'function') ||
          isKeyword(tokens[index + 1], 'procedure')) &&
        statementHasKeywords(tokens, index, ['create', 'trigger']);
      if (!staticTriggerCall) {
        violations.add('dynamic SQL EXECUTE');
      }
    }

    if (
      (token.kind === 'STRING' || token.kind === 'DOLLAR_STRING') &&
      isProceduralBody(tokens, index)
    ) {
      collectSchemaNeutralityViolations(token.value, violations);
    }
  }
}

/**
 * Finds SQL constructs that make a migration target-dependent or prevent a
 * reliable static proof of schema neutrality. Procedural bodies are lexed
 * recursively, including PostgreSQL's single- and dollar-quoted forms.
 */
export function findSchemaNeutralityViolations(sql: string): string[] {
  const violations = new Set<string>();
  collectSchemaNeutralityViolations(sql, violations);
  return [...violations].sort();
}

export function sha256(content: string | Buffer): string {
  const portableContent =
    typeof content === 'string' ? content.replace(/\r\n/g, '\n') : content;
  return createHash('sha256').update(portableContent).digest('hex');
}
