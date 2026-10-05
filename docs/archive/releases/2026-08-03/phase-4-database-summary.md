# Phase 4 — Database compatibility (evidence)

**Date:** 2026-08-03

**Live schema:** `dsp_pms` on `dsp_erp_dev` — migrations applied in Phase 5 (see `phase-5-release/CLOSURE.md`).

## A1 — Pending security migration validation

File: `backend/prisma/migrations/20260731190000_security_tenant_roles_and_account_recovery/migration.sql`

| Requirement | Present |
| --- | --- |
| `user_invitations` table + FKs/indexes | Yes |
| `password_reset_challenges` table + FKs/indexes | Yes |
| Nullable `users.passwordHash` | Yes |
| INVITED ↔ password check constraint | Yes |
| Role `companyGroupId` / `normalizedName` + ownership check | Yes |
| `permissions.isTenantAssignable` | Yes (security/org/dashboard only initially) |
| Audit `requestId` / org context columns + indexes | Yes |
| Attendance / self / asset-assignment permissions | Yes (`isTenantAssignable=false` until E) |
| System-role mappings for those permissions | Yes (partial; leave/onboarding/docs completed in E) |
| Does not grant `platform.admin` to tenant roles | Yes |

## A3 — Live preflight (`dsp_pms`)

See `a3-preflight.json`.

| Entity | Count |
| --- | ---: |
| Company Groups | 2 |
| Companies | 2 |
| Branches | 2 |
| Employees | 10 |
| Users | 19 |
| Roles | 7 |
| Permissions | 31 |
| Role permissions | 52 |
| User role assignments | 2 |
| Auth sessions | 17 |
| Pending registrations | 2 |
| Audit logs | 68 |

Checks:

- User statuses: ACTIVE 16 / DISABLED 2 / LOCKED 1 (no INVITED yet)
- Null passwords: none (all statuses have password hashes)
- Duplicate system role codes: 0
- Orphaned role assignments: 0
- Tables without PK: 0
- Security objects from pending migration: **absent** (expected)
- Planned core FK indexes: **absent** (expected)

## E — New migration created

`backend/prisma/migrations/20260803120000_activate_tenant_workforce_permissions_and_core_fk_indexes/`

- Sets accepted workforce + org + security permissions `isTenantAssignable=true`
- Inserts missing B3 system-role mappings with `ON CONFLICT DO NOTHING`
- Adds 15 core FK indexes (`CREATE INDEX IF NOT EXISTS`)
- Prisma `schema.prisma` updated with matching `@@index` declarations
- `prisma validate` passed

## A2 — Disposable schema tests (same RDS, isolated schemas)

No local Docker/Postgres; used temporary schemas on the same instance, then dropped.

| Test | Schema | Result |
| --- | --- | --- |
| Empty from-zero | `dsp_pms_phase4_disposable` | All **91** migrations applied |
| Upgrade from current AWS level | `dsp_pms_phase4_upgrade` | Baseline 89 applied, then both pending applied cleanly |
| Post-checks | both schemas | Security tables, nullable password, tenant-assignable set, 15 indexes, no `platform.admin` on tenant roles |
| Cleanup | both schemas | **Dropped** (`CASCADE`) |

Evidence files:

- `a2-empty-migrate-deploy.txt`
- `a2-upgrade-baseline-deploy.txt`
- `a2-upgrade-pending-deploy.txt`
- `a2-upgrade-status-after.txt`
- `a4-postcheck-empty.json`
- `a4-postcheck-upgrade.json`

## Live `dsp_pms` status after Phase 4 work

Originally left pending; Phase 5 applied both migrations. Post-deploy evidence is under `phase-5-release/`.

Scripts added for reuse:

- `backend/scripts/phase4-migration-preflight.mjs`
- `backend/scripts/phase4-disposable-schema.mjs`
- `backend/scripts/phase4-postcheck.mjs`
