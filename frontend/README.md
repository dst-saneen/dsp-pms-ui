# ERP frontend

Next.js application for the ERP browser experience. Run commands from `frontend` with project dependencies installed.

## Structure and configuration

- `app/` owns routes and layouts.
- `features/` owns module-specific UI, queries, and validation.
- `components/` contains implemented shared UI only; future placeholders are documented in plans rather than committed as empty files.
- `e2e/` contains Playwright workflow tests.

Copy a documented environment template such as `.env.local.example` or `.env.e2e.example`; real `.env*` files remain local. The UI runs at `http://localhost:3200` and expects the API at `http://localhost:4500`.

## Run

```bash
pnpm dev
```

For a production-style start, build first and then run:

```bash
pnpm build
pnpm start
```

## Quality and release checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm release-gates
pnpm release-gates:full
```

Playwright writes local artifacts to `test-results/` and, when configured, `playwright-report/` or `blob-report/`. Coverage, Next.js build output, and all browser artifacts are ignored and must not be committed. Promote only reviewed final evidence into [`docs/evidence`](../docs/evidence/).

See the [documentation index](../docs/README.md) and [company workflow guide](../docs/product/company-workflow-guide/README.md) for supported UI workflows.
