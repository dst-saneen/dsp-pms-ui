# HRMS ERP developer toolchain workflow

This document is the shared workflow for dependency, TypeScript, Node.js,
Next.js, React, and NestJS changes in this repository. The companion
project-local agent skill is
[`.cursor/skills/hrms-erp-toolchain/SKILL.md`](../../.cursor/skills/hrms-erp-toolchain/SKILL.md).

## Supported baseline

| Area | Required version or policy |
| --- | --- |
| Node.js | `24.20.0` — pinned in [`.node-version`](../../.node-version) |
| pnpm | `11.24.0` — declared by each project |
| Canonical TypeScript compiler | `6.0.3` |
| TypeScript 7 advisory lane | `@typescript/native` alias at `7.0.2` |
| Frontend | Next `16.3.3`, React `19.2.8` |
| Dependency lockfiles | Each project owns a `pnpm-lock.yaml`; do not use npm lockfiles |

The frontend and backend are separate pnpm projects. Run dependency commands
inside the project being changed:

- `frontend/` — Next.js and React application
- `backend/` — NestJS, Prisma, and Jest application

## First-time setup and daily preflight

Open a new terminal at the repository root and verify the toolchain before
installing or building:

```powershell
node -v
corepack pnpm --version
```

They must report Node `v24.20.0` and pnpm `11.24.0`. If they do not, correct the
terminal's Node/Corepack installation before continuing; do not update a lockfile
using another runtime.

For a clean install, run the following in each project you will work in:

```powershell
corepack pnpm install --frozen-lockfile
```

`pnpm-lock.yaml` is the source of truth. Never run `npm install`, and do not add
or restore `package-lock.json` files.

## Making a dependency or compiler change

1. Start with `git status` and inspect the affected `package.json` and lockfile.
2. Keep the pull request narrow. A TypeScript update should not also become a
   Nest, Prisma, ESM, database, or product-feature migration unless that is an
   explicit requirement.
3. Update the direct dependency deliberately, then run `corepack pnpm install`
   inside the affected project to regenerate only its pnpm lockfile with the
   supported Node/pnpm baseline. Follow it with a frozen install.
4. Review both the manifest and lockfile diff. Unexpected major upgrades or
   unrelated transitive churn need an explanation before merge.
5. Do not use `pnpm up --latest` for broad upgrades without an approved impact
   review.

For backend TypeScript configuration, preserve the split between production and
test compilation:

- `tsconfig.build.json` drives production compilation.
- `tsconfig.test.json` covers Jest test files and test-only types.
- Jest and ESLint must remain configured for the right TypeScript project.

## Validation gates

Run the relevant commands after every toolchain change. A green build is not a
substitute for test, browser, API, or database evidence.

### Frontend

```powershell
Set-Location frontend
corepack pnpm run typecheck
corepack pnpm run release-gates
```

`release-gates` runs the canonical TypeScript check, ESLint, Vitest, and a Next
production build. Add `corepack pnpm run test:e2e` when the required browser and
environment are available.

### Backend

```powershell
Set-Location backend
corepack pnpm run prisma:validate
corepack pnpm run typecheck
corepack pnpm run lint:check
corepack pnpm run build
corepack pnpm run test
```

When a change touches tests, Jest configuration, or test-only types, also run:

```powershell
corepack pnpm run typecheck:test
```

TypeScript 6.0.3 is the release compiler. Experimental compiler evaluation is
kept outside the normal package command surface so it cannot be mistaken for a
required production gate.

Do not convert an existing failing test into an unreported baseline. Record
whether a failure is pre-existing, an environment/fixture issue, or a regression
from the current change.

## Local build and smoke workflow

For development servers:

```powershell
# Terminal 1
Set-Location backend
corepack pnpm run start:dev

# Terminal 2
Set-Location frontend
corepack pnpm run dev
```

The usual local URLs are `http://localhost:4500` for the backend and
`http://localhost:3200` for the frontend. For a production-artifact check, run
the build command first, then use `start:prod` for the backend and `start` for
the frontend.

Login smoke is a separate evidence gate. Use an approved controlled local or UAT
account, verify the expected post-login route, hard-refresh to check session
restoration, and log out if appropriate. Never use embedded privileged test
credentials or trial passwords against a real account.

## TypeScript 6 and TypeScript 7 policy

TypeScript `6.0.3` is the main compiler because the current Next, Nest, ESLint,
and Jest tooling depend on the stable TypeScript compiler API. TypeScript `7.0.2`
is installed as the `@typescript/native` advisory lane so the codebase can be
checked for forward compatibility and compiler performance without placing the
application toolchain on an unsupported API.

Do not switch the main `typescript` dependency to TS7 merely because the TS7
standalone check is faster. Promote it only in a dedicated compatibility change
after all of these are confirmed:

1. The required TS7 compiler API is supported by the ecosystem tools used here.
2. Next, Nest, ESLint, Jest/ts-jest, and required plugins work without aliases,
   patches, or unsupported bridges.
3. Fresh installs, TS7 checks, production builds, and relevant test suites pass.
4. The change has an explicit rollback path and review approval.

## What to include in a pull request or handoff

- Exact Node, pnpm, TypeScript, React, Next, and affected backend framework versions.
- Package manifest and lockfile changes, including any intentional transitive upgrades.
- Commands run and their results.
- New failures separately from known failures or environment blockers.
- Whether real API/database/browser/login smoke tests ran, and what they proved.

When this baseline changes, update this document, the companion skill,
`.node-version`, both manifests, relevant lockfiles, and CI in the same reviewed
change.
