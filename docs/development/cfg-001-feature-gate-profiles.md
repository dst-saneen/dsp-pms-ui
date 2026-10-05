# CFG-001 — Feature-gate profiles matrix

**Wave:** Phase A (W0 Production gates)  
**Status:** Profiles defined; verify on isolated two-tenant UAT before production empty-all rollout.

## Semantics (authoritative)

| Module | `*_ENABLED=false` | Enabled + **empty** allowlist | Enabled + **non-empty** allowlist |
|---|---|---|---|
| Projects / Finance / Payroll / Onboarding / Assets / File Storage | Off for all | **All companies** | Only listed Company (and Branch where JSON scoped) |
| **Delivery V2** | Off / legacy | **Fail closed** (boot error if enabled; workers claim nothing) | Only explicit pilot Company/Branch rows |

Payroll coverage must be **⊆** Finance coverage (including empty-all rules — see CFG-003).

## Three verified profiles

### Profile 1 — All flags OFF

Use for baseline / safe rollback.

```env
PROJECTS_LITE_ENABLED=false
OFFICE_FINANCE_LITE_ENABLED=false
PAYROLL_LITE_ENABLED=false
ONBOARDING_V2_ENABLED=false
ASSET_V2_ENABLED=false
FILE_STORAGE_V2_ENABLED=false
DELIVERY_V2_ENABLED=false
```

**Expect:** No module nav/actions for gated modules; Delivery legacy; workers claim no V2 delivery for empty/disabled.

### Profile 2 — Explicit pilot IDs (recommended first production)

```env
# Example — replace with real UAT tenant IDs
PROJECTS_LITE_ENABLED=true
PROJECTS_LITE_COMPANY_IDS=<tenant-a>,<tenant-b>

OFFICE_FINANCE_LITE_ENABLED=true
OFFICE_FINANCE_LITE_COMPANY_IDS=<tenant-a>,<tenant-b>
PAYROLL_LITE_ENABLED=true
PAYROLL_LITE_COMPANY_IDS=<tenant-a>,<tenant-b>

ONBOARDING_V2_ENABLED=true
ONBOARDING_V2_COMPANY_IDS=<tenant-a>,<tenant-b>
ONBOARDING_V2_BRANCH_IDS=

ASSET_V2_ENABLED=true
ASSET_V2_SCOPE_ALLOWLIST_JSON=[{"companyId":"<tenant-a>"},{"companyId":"<tenant-b>"}]

FILE_STORAGE_V2_ENABLED=true
FILE_STORAGE_SCOPE_ALLOWLIST_JSON=[{"companyId":"<tenant-a>"},{"companyId":"<tenant-b>"}]

DELIVERY_V2_ENABLED=true
DELIVERY_V2_ALLOWLIST_JSON=[{"companyId":"<tenant-a>","dryRun":true}]
# + ZeptoMail + Delivery key JSON required
```

**Expect:** Tenant A (and listed B) get capabilities; unlisted tenant denied. Delivery only claims listed rows; dry-run does not send live provider mail when configured as dry-run.

### Profile 3 — Empty allowlists = all organizations (approved modules only)

Requires explicit business approval. **Do not** use empty Delivery allowlist.

```env
PROJECTS_LITE_ENABLED=true
PROJECTS_LITE_COMPANY_IDS=

OFFICE_FINANCE_LITE_ENABLED=true
OFFICE_FINANCE_LITE_COMPANY_IDS=
PAYROLL_LITE_ENABLED=true
PAYROLL_LITE_COMPANY_IDS=

ONBOARDING_V2_ENABLED=true
ONBOARDING_V2_COMPANY_IDS=
ONBOARDING_V2_BRANCH_IDS=

ASSET_V2_ENABLED=true
ASSET_V2_SCOPE_ALLOWLIST_JSON=

FILE_STORAGE_V2_ENABLED=true
FILE_STORAGE_SCOPE_ALLOWLIST_JSON=

# Delivery stays pilot — never empty when enabled
DELIVERY_V2_ENABLED=true
DELIVERY_V2_ALLOWLIST_JSON=[{"companyId":"<pilot-only>","dryRun":true}]
```

**Expect:** Every company gets Projects/Finance/Payroll/Onboarding/Assets/Files when other deps (keys, S3, etc.) are present. Delivery still only pilot tenant.

## Invalid combinations (must fail startup)

| Case | Result |
|---|---|
| `PAYROLL` on, `FINANCE` off | Boot error |
| Payroll empty-all + Finance restricted CSV | Boot error (CFG-003) |
| Payroll IDs not subset of Finance IDs | Boot error |
| `DELIVERY_V2_ENABLED=true` + empty allowlist | Boot error (CFG-002) |

## Verification checklist (Tenant A vs Tenant B)

For each profile, record:

1. `/me/module-capabilities` for A and B  
2. Sidebar visibility (onboarding, finance, payroll, projects, assets, delivery ops)  
3. One representative API call per module (allowed vs 403)  
4. Delivery worker claim count (pilot only / none)  
5. `node scripts/uat-phase5-gate-evidence.mjs` Pass for File Storage matrix (CFG-004)

## Production rollout rule

1. Ship code with CFG-002/003/004 semantics.  
2. First production cutover uses **Profile 2 (explicit pilots)**.  
3. Profile 3 (empty = all) only after written approval and two-tenant UAT evidence.

## Phase F smoke (2026-09-15)

| Check | Result |
|---|---|
| Freeze SHA | `93eeeb126d5b1a0137dbeb88d58731d602cfe8ca` |
| Foundation `environment` tests | 18 passed (`jest-foundation`) |
| CFG-002 / CFG-003 enforcement in `environment.ts` | Present (boot fail-closed) |
| Live Profile 1 / 2 / 3 redeploy + `/me/module-capabilities` A/B | **Not run** this session |
| `uat-phase5-gate-evidence.mjs` | **Not run** this session |

Current local backend boot with existing `.env` (Delivery off; other modules on with allowlists) is treated as **Profile-2-like smoke**, not a formal three-profile matrix.
