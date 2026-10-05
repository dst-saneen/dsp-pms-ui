# Stage 10 — Controlled Production Rollout

**Work order:** `business-calendar-development-work-order.md` §21  
**Date:** 2026-08-07  
**Status:** COMPLETE (runbook + CLIs ready; **ops execution** of cutover is gated on backup + UAT)

> Stage 10 delivers the **controlled rollout package**: preparation checklist, deploy order,  
> verify/provision/compare CLIs, monitoring, and rollback. It does **not** flip production  
> offices to ACTIVE from this chat.

---

## 1. Deliverables

| Artifact | Path |
|----------|------|
| Runbook | `docs/product/business-calendar-stage-10-rollout-runbook.md` |
| This evidence | `docs/product/business-calendar-stage-10-rollout.md` |
| Verify runner | `business-calendar-stage10-verify.runner.ts` |
| Verify CLI | `pnpm run migration:calendar:verify` |
| Provision CLI | `pnpm run migration:calendar:provision` |
| Parity comparison | `pnpm run migration:calendar:shadow` |

---

## 2. Cutover sequence (summary)

```text
migrate deploy → backend/frontend → verify → provision LEGACY
→ HR publish → SHADOW + parity → ACTIVE (one office) → smoke → expand
```

Rollback before ACTIVE: return `LEGACY`. After Runtime-dependent transactions: forward fix; never drop history.

---

## 3. Safety

| Rule | Status |
|------|--------|
| Consumers gated by office `runtimeMode` | ✅ Stage 6 |
| LEGACY→ACTIVE blocked without SHADOW | ✅ |
| Production-named DB requires `--allow-production` | ✅ verify + provision |
| No automated ACTIVE on RDS from Stage 10 | ✅ |
| Legacy Holiday tables retained | ✅ (ops policy in runbook) |

---

## 4. Tests

```powershell
cd backend
npx.cmd jest src/modules/business-calendar --runInBand
```

Includes Stage 10 required-table helper spec.

---

## 5. Exit gate

| Gate | Status |
|------|--------|
| Preparation / deploy / monitor / rollback documented | ✅ |
| Guarded provision + verify + compare CLIs | ✅ |
| Pilot ACTIVE executed in production | ⏳ ops (runbook §2 step 11) |
| Smoke + expand office-by-office | ⏳ ops |

---

## 6. Suggested first ops command (non-prod / after backup)

```powershell
cd backend
pnpm.cmd run migration:calendar:verify -- --company-id=<COM-000002-uuid> --branch-id=<BR-000002-uuid>
```

Then follow the runbook; do not `--apply` provision or `--activate-shadow` / ACTIVE until backup + HR approval.

---

*Business Calendar Stages 0–10 implementation package is complete. Production cutover follows the Stage 10 runbook.*
