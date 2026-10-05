# Repository Hygiene, Gitignore, and Documentation Implementation Plan

> **For agentic workers:** Execute this plan natively in the current feature branch. Do not use subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove repository clutter, establish predictable UI/API ignore rules, organize documentation by purpose, and enforce the resulting policy without changing runtime behavior.

**Architecture:** Shared repository rules live in the root `.gitignore`, while package-specific generated outputs remain documented in the frontend and backend ignore files. Documentation is consolidated under `docs/`, raw outputs remain ignored, curated evidence remains tracked, and a dependency-free Node checker enforces the policy in CI.

**Tech Stack:** Git, Node.js 24, GitHub Actions, Markdown, Next.js 16, NestJS 11.

**Spec:** Approved user plan in the task conversation dated 2026-09-23.

## Global Constraints

- Preserve every application URL and route.
- Preserve every API contract and controller.
- Do not modify the Prisma schema or migrations.
- Do not connect to or mutate `dsp_pms`.
- Keep `pnpm-lock.yaml` and all `.env*.example` templates tracked.
- Retain curated summaries and final evidence; delete raw/generated intermediates.
- Execute natively without subagents.

## Task 1: Ignore Policy and Repository Cleanup

- [x] Normalize shared and package-specific ignore rules.
- [x] Preserve the final workflow workbook and concise release summaries.
- [x] Remove generated outputs, duplicate archives, obsolete raw evidence, and all tracked zero-byte files.
- [x] Remove the seven no-op barrel exports that target empty backend files.
- [x] Verify ignored/tracked-file behavior and commit `chore: normalize repository hygiene`.

## Task 2: Documentation Consolidation

- [x] Add the documentation hub and contribution policy.
- [x] Organize documentation into purpose-based areas and populated product modules.
- [x] Consolidate non-identical root/docs copies without losing current or historical state.
- [x] Update UI/API/root READMEs and every internal link.
- [x] Commit `docs: organize project documentation`.

## Task 3: Automated Enforcement

- [x] Write failing Node tests for tracked generated paths, zero-byte files, root-document policy, and Markdown links.
- [x] Implement the dependency-free repository-hygiene checker.
- [x] Add the GitHub Actions hygiene workflow.
- [x] Run checker tests and the checker, then commit `ci: enforce repository hygiene`.

## Final Verification

- [x] Verify ignore behavior and tracked ignored files.
- [x] Run frontend release gates.
- [x] Run backend production typecheck, build, full tests, and Prisma validation.
- [x] Run scoped lint for changed scripts and TypeScript barrels.
- [x] Confirm the diff contains no runtime routes, APIs, schema, migrations, or environment-semantics changes.
- [x] Refresh the ignored Graphify code graph.
