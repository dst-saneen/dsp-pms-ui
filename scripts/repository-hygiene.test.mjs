import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  auditRepository,
  extractMarkdownLinks,
} from './repository-hygiene.mjs';

function createFixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'erp-hygiene-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }
  return root;
}

function withFixture(files, callback) {
  const root = createFixture(files);
  try {
    return callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('detects tracked generated output and ignored files', () => {
  withFixture(
    {
      'outputs/report.txt': 'generated',
      'frontend/test-results/result.json': '{}',
      'phase-0-baseline/test.log': 'raw evidence',
      'frontend/Frontend.zip': 'source snapshot',
      'uat-phase0-results.json': '{}',
      'docs/evidence/final.json': '{}',
    },
    (root) => {
      const violations = auditRepository({
        root,
        trackedFiles: [
          'outputs/report.txt',
          'frontend/test-results/result.json',
          'phase-0-baseline/test.log',
          'frontend/Frontend.zip',
          'uat-phase0-results.json',
          'docs/evidence/final.json',
        ],
        trackedIgnoredFiles: ['frontend/test-results/result.json'],
      });

      assert.equal(
        violations.filter((item) => item.code === 'generated-path').length,
        5,
      );
      assert.deepEqual(
        violations
          .filter((item) => item.code === 'tracked-ignored')
          .map((item) => item.path),
        ['frontend/test-results/result.json'],
      );
    },
  );
});

test('rejects zero-byte tracked files', () => {
  withFixture({ 'src/empty.ts': '' }, (root) => {
    const violations = auditRepository({
      root,
      trackedFiles: ['src/empty.ts'],
    });

    assert.deepEqual(
      violations.map((item) => [item.code, item.path]),
      [['zero-byte', 'src/empty.ts']],
    );
  });
});

test('limits root documentation to README and AGENTS', () => {
  withFixture(
    {
      'README.md': '# Read me',
      'AGENTS.md': '# Agent guidance',
      'release-plan.md': '# Wrong location',
      'docs/release-plan.md': '# Correct location',
    },
    (root) => {
      const violations = auditRepository({
        root,
        trackedFiles: [
          'README.md',
          'AGENTS.md',
          'release-plan.md',
          'docs/release-plan.md',
        ],
      });

      assert.deepEqual(
        violations.map((item) => [item.code, item.path]),
        [['root-document', 'release-plan.md']],
      );
    },
  );
});

test('supports relative, URL-encoded, anchored, and parenthesized links', () => {
  withFixture(
    {
      'docs/index.md': [
        '[Guide](guides/My%20Guide.md)',
        '[Dashboard](<../app/(dashboard)/page.tsx#L20>)',
        '[Local anchor](#details)',
        '[Website](https://example.com/docs)',
      ].join('\n'),
      'docs/guides/My Guide.md': '# Guide',
      'app/(dashboard)/page.tsx': 'export default function Page() {}',
    },
    (root) => {
      const violations = auditRepository({
        root,
        trackedFiles: [
          'docs/index.md',
          'docs/guides/My Guide.md',
          'app/(dashboard)/page.tsx',
        ],
      });

      assert.deepEqual(violations, []);
      assert.deepEqual(extractMarkdownLinks('[Page](<app/(dashboard)/page.tsx>)'), [
        'app/(dashboard)/page.tsx',
      ]);
    },
  );
});

test('reports a broken local Markdown target with its source', () => {
  withFixture({ 'docs/index.md': '[Missing](missing.md)' }, (root) => {
    const violations = auditRepository({
      root,
      trackedFiles: ['docs/index.md'],
    });

    assert.deepEqual(violations, [
      {
        code: 'broken-link',
        path: 'docs/index.md',
        detail: 'missing.md',
      },
    ]);
  });
});

test('allows environment templates, pnpm lockfiles, and curated evidence', () => {
  withFixture(
    {
      'frontend/.env.local.example': 'NEXT_PUBLIC_API_URL=http://localhost:4500',
      'frontend/pnpm-lock.yaml': 'lockfileVersion: 9',
      'docs/evidence/final.xlsx': 'curated',
    },
    (root) => {
      const violations = auditRepository({
        root,
        trackedFiles: [
          'frontend/.env.local.example',
          'frontend/pnpm-lock.yaml',
          'docs/evidence/final.xlsx',
        ],
      });

      assert.deepEqual(violations, []);
    },
  );
});
