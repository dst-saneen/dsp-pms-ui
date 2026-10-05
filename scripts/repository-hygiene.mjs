#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DOCUMENTS = new Set(['AGENTS.md', 'README.md']);
const ROOT_DOCUMENT_EXTENSIONS = new Set([
  '.doc',
  '.docx',
  '.md',
  '.pdf',
  '.ppt',
  '.pptx',
  '.txt',
  '.xls',
  '.xlsx',
]);
const GENERATED_DIRECTORY_NAMES = new Set([
  '.cache',
  '.next',
  '.nyc_output',
  '.qa-runs',
  '.turbo',
  'blob-report',
  'build',
  'coverage',
  'dist',
  'graphify-out',
  'outputs',
  'playwright-report',
  'test-results',
]);
const GENERATED_FILE_EXTENSIONS = new Set([
  '.7z',
  '.db',
  '.log',
  '.rar',
  '.sqlite',
  '.sqlite3',
  '.zip',
]);
const HISTORICAL_OUTPUT_DIRECTORIES = new Set([
  'phase-0-baseline',
  'phase-4-database',
  'phase-5-release',
]);

function normalizeRepositoryPath(filePath) {
  return filePath.replaceAll('\\', '/').replace(/^\.\//, '');
}

function removeMarkdownCode(markdown) {
  const visibleLines = [];
  let fence;

  for (const line of markdown.split(/\r?\n/)) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fence) {
        fence = marker[0];
      } else if (marker[0] === fence) {
        fence = undefined;
      }
      continue;
    }
    if (!fence) {
      visibleLines.push(line.replace(/`[^`\r\n]*`/g, ''));
    }
  }

  return visibleLines.join('\n');
}

function readInlineLinkTarget(markdown, start) {
  let cursor = start;
  while (/\s/.test(markdown[cursor] ?? '')) cursor += 1;

  if (markdown[cursor] === '<') {
    const end = markdown.indexOf('>', cursor + 1);
    if (end === -1) return undefined;
    return { target: markdown.slice(cursor + 1, end), end: end + 1 };
  }

  const targetStart = cursor;
  let nestedParentheses = 0;
  let escaped = false;
  while (cursor < markdown.length) {
    const character = markdown[cursor];
    if (escaped) {
      escaped = false;
      cursor += 1;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      cursor += 1;
      continue;
    }
    if (character === '(') {
      nestedParentheses += 1;
    } else if (character === ')') {
      if (nestedParentheses === 0) break;
      nestedParentheses -= 1;
    } else if (/\s/.test(character) && nestedParentheses === 0) {
      break;
    }
    cursor += 1;
  }

  if (cursor === targetStart) return undefined;
  return { target: markdown.slice(targetStart, cursor), end: cursor };
}

export function extractMarkdownLinks(markdown) {
  const visibleMarkdown = removeMarkdownCode(markdown);
  const targets = [];
  let cursor = 0;

  while (cursor < visibleMarkdown.length) {
    const linkStart = visibleMarkdown.indexOf('](', cursor);
    if (linkStart === -1) break;
    const parsed = readInlineLinkTarget(visibleMarkdown, linkStart + 2);
    if (parsed?.target) targets.push(parsed.target);
    cursor = parsed ? parsed.end + 1 : linkStart + 2;
  }

  const referencePattern = /^\s*\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))/gm;
  for (const match of visibleMarkdown.matchAll(referencePattern)) {
    targets.push(match[1] ?? match[2]);
  }

  return targets;
}

function isGeneratedPath(filePath) {
  const normalized = normalizeRepositoryPath(filePath);
  const lowerPath = normalized.toLowerCase();
  const segments = lowerPath.split('/');
  const basename = segments.at(-1) ?? '';

  if (segments.some((segment) => GENERATED_DIRECTORY_NAMES.has(segment))) {
    return true;
  }
  if (segments.some((segment) => segment === '.tmp' || segment === '.temp')) {
    return true;
  }
  if (segments[0]?.startsWith('.tmp-')) return true;
  if (HISTORICAL_OUTPUT_DIRECTORIES.has(segments[0])) return true;
  if (/^uat-.*\.(?:json|txt)$/.test(basename) && segments.length === 1) {
    return true;
  }
  return GENERATED_FILE_EXTENSIONS.has(path.extname(basename));
}

function isUnexpectedRootDocument(filePath) {
  const normalized = normalizeRepositoryPath(filePath);
  if (normalized.includes('/')) return false;
  if (ROOT_DOCUMENTS.has(normalized)) return false;
  return ROOT_DOCUMENT_EXTENSIONS.has(path.extname(normalized).toLowerCase());
}

function localLinkTarget(rawTarget) {
  const target = rawTarget.trim();
  if (!target || target.startsWith('#') || target.startsWith('//')) {
    return undefined;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(target)) return undefined;

  const withoutFragment = target.split('#', 1)[0].split('?', 1)[0];
  if (!withoutFragment) return undefined;
  try {
    return decodeURIComponent(withoutFragment);
  } catch {
    return withoutFragment;
  }
}

export function auditRepository({
  root,
  trackedFiles,
  trackedIgnoredFiles = [],
}) {
  const violations = [];
  const normalizedTrackedFiles = trackedFiles.map(normalizeRepositoryPath);

  for (const filePath of normalizedTrackedFiles) {
    const absolutePath = path.resolve(root, filePath);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) continue;

    if (isGeneratedPath(filePath)) {
      violations.push({ code: 'generated-path', path: filePath });
    }
    if (statSync(absolutePath).size === 0) {
      violations.push({ code: 'zero-byte', path: filePath });
    }
    if (isUnexpectedRootDocument(filePath)) {
      violations.push({ code: 'root-document', path: filePath });
    }

    if (path.extname(filePath).toLowerCase() !== '.md') continue;
    const markdown = readFileSync(absolutePath, 'utf8');
    for (const rawTarget of extractMarkdownLinks(markdown)) {
      const target = localLinkTarget(rawTarget);
      if (!target) continue;
      const resolvedTarget = path.resolve(path.dirname(absolutePath), target);
      if (!existsSync(resolvedTarget)) {
        violations.push({
          code: 'broken-link',
          path: filePath,
          detail: rawTarget,
        });
      }
    }
  }

  for (const filePath of trackedIgnoredFiles.map(normalizeRepositoryPath)) {
    violations.push({ code: 'tracked-ignored', path: filePath });
  }

  return violations.sort(
    (left, right) =>
      left.path.localeCompare(right.path) || left.code.localeCompare(right.code),
  );
}

function runGit(root, args) {
  const result = spawnSync(process.env.GIT_BIN || 'git', args, {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  }
  return result.stdout.split('\0').filter(Boolean);
}

function runCli() {
  const rootResult = spawnSync(process.env.GIT_BIN || 'git', [
    'rev-parse',
    '--show-toplevel',
  ], { encoding: 'utf8' });
  if (rootResult.status !== 0) {
    throw new Error(rootResult.stderr.trim() || 'Not inside a Git repository');
  }

  const root = rootResult.stdout.trim();
  const trackedFiles = runGit(root, ['ls-files', '-z']);
  const trackedIgnoredFiles = runGit(root, [
    'ls-files',
    '-ci',
    '--exclude-standard',
    '-z',
  ]);
  const violations = auditRepository({ root, trackedFiles, trackedIgnoredFiles });

  if (violations.length) {
    console.error(`Repository hygiene failed with ${violations.length} violation(s):`);
    for (const violation of violations) {
      const detail = violation.detail ? ` -> ${violation.detail}` : '';
      console.error(`- ${violation.code}: ${violation.path}${detail}`);
    }
    process.exitCode = 1;
    return;
  }

  const markdownCount = trackedFiles.filter(
    (filePath) => path.extname(filePath).toLowerCase() === '.md',
  ).length;
  console.log(
    `Repository hygiene passed (${trackedFiles.length} tracked files, ${markdownCount} Markdown files checked).`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
