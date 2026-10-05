---
name: hrms-erp-toolchain
description: This skill guides safe HRMS ERP Node.js, pnpm, TypeScript, Next.js, and NestJS toolchain changes. Use it when installing or upgrading dependencies, editing lockfiles, TypeScript or test configuration, build scripts, CI runtime versions, or building and running the local frontend or backend.
---

# HRMS ERP toolchain

Start from the `ERP` repository root, then run each command from its relevant
project directory. The frontend and backend are separate pnpm projects, each
with its own manifest and lockfile.

## Required baseline

- Use Node `24.20.0`, pinned in `.node-version`, and pnpm `11.24.0`.
- Verify `node -v` and `corepack pnpm --version` before dependency work.
- `pnpm-lock.yaml` is authoritative. Do not run `npm install` or introduce a
  `package-lock.json`.
- The canonical compiler is `typescript@6.0.3`.
- `@typescript/native` aliases TypeScript `7.0.2` and is an advisory compiler
  lane only. Do not replace the canonical `typescript` package with TS7 until
  the ecosystem migration criteria below have been approved.

## Dependency-change workflow

1. Inspect `git status`, the affected `package.json`, and its `pnpm-lock.yaml`.
2. Keep upgrades scoped. Do not combine a TypeScript upgrade with unrelated
   Nest, Prisma, Next, React, ESM, or database changes unless explicitly asked.
3. After changing a direct version, run `corepack pnpm install` only inside the
   affected project to regenerate its pnpm lockfile under the required Node and
   pnpm versions. Follow it with a frozen-lockfile install.
4. Preserve the backend production/test TypeScript split:
   `tsconfig.build.json` for production and `tsconfig.test.json` for tests.
   Keep Jest and ESLint aligned with those configurations.
5. Preserve Nest decorator settings, `nodenext` resolution, and existing
   explicit type declarations unless a compatibility check proves a change is
   needed.
6. Separate pre-existing test, fixture, or environment failures from failures
   introduced by the toolchain change. Never hide either category.

## Required validation

Run checks in the project(s) touched by the change.

### Frontend

```powershell
Set-Location frontend
corepack pnpm install --frozen-lockfile
corepack pnpm run typecheck
corepack pnpm run release-gates
```

`release-gates` covers the canonical TypeScript check, ESLint, Vitest, and the Next
production build. Run `test:e2e` only when its browser and environment
requirements are available.

### Backend

```powershell
Set-Location backend
corepack pnpm install --frozen-lockfile
corepack pnpm run prisma:validate
corepack pnpm run typecheck
corepack pnpm run lint:check
corepack pnpm run build
corepack pnpm run test
```

When changing tests, Jest configuration, or test-only types, also run
`typecheck:test`. TS7 evaluation is deliberately kept outside the normal
package command surface so it cannot be mistaken for a release gate. Report any existing test debt
explicitly; a passing production compiler check does not prove the test suite
or a browser workflow is healthy.

## Local runtime and login smoke

- The frontend normally serves on port `3200`; the backend normally serves on
  port `4500`.
- Verify a backend health endpoint and a frontend page after a production build
  before calling the application runnable.
- Use a controlled local/UAT account for login smoke. Do not use hard-coded,
  privileged, or unapproved credentials. Confirm the login redirect, hard
  refresh/session restoration, and logout when those actions are in scope.
- Do not claim production readiness from local HTTP checks, compilation, or
  mocks alone.

## TypeScript 7 promotion criteria

Keep TS7 as an advisory lane until all of the following are true:

1. A supported TS7 compiler API is available for the repository's toolchain.
2. Next, Nest, ESLint, Jest/ts-jest, and required plugins support it without an
   alias, patch, or unsupported bridge.
3. Fresh installs, TS7 checks, production builds, and relevant tests pass.
4. The migration is reviewed as a dedicated compatibility change with a clear
   rollback path.

## Completion report

State the Node, pnpm, TypeScript, React, Next, and backend framework versions
used; list the commands and outcomes; distinguish known failures from new
regressions; and say whether real browser/API/database smoke coverage ran.
