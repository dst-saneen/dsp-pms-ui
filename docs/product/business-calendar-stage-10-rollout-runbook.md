# Stage 10 — Controlled Production Rollout Runbook

**Work order:** `business-calendar-development-work-order.md` §21  
**Pilot:** COM-000002 / BR-000002 Kowdiar (`Asia/Kolkata`)  
**Rule:** Activate **one office at a time**. Never auto-ACTIVE from deploy.

> This runbook is the Stage 10 deliverable. Actual production cutover is an **ops execution** of these steps with backup evidence.  
> Do **not** run destructive migrate/reset against AWS RDS from CI.

---

## 0. Preconditions

- [ ] Stages 0–9 evidence reviewed
- [ ] Stage 9 UAT checklist signed (or explicit waiver)
- [ ] Approved Git commit SHA: __________
- [ ] Database backup evidence attached: __________
- [ ] On-call / HR contact: __________

---

## 1. Preparation (§21.1)

| # | Step | Command / evidence |
|---|------|--------------------|
| 1 | Confirm commit | `git rev-parse HEAD` → record SHA |
| 2 | Migration status | `cd backend && npx prisma migrate status` |
| 3 | Backup | Snapshot / RDS backup ID recorded |
| 4 | Review SQL | `backend/prisma/migrations/20260807140000_business_calendar_foundation/migration.sql` |
| 5 | Permissions in SQL | Same migration seeds `calendar.business.*` |
| 6 | Env | `DATABASE_URL`, `DATABASE_SCHEMA`, app URLs; no gov API secrets in logs |
| 7 | First wave | Company + Kowdiar branch IDs |
| 8 | Location / TZ | Branch `Asia/Kolkata`, country `IN`, subdivision `IN-KL` |
| 9 | HR users | Have `calendar.business.*` roles |

### Readiness verify (safe / read-only)

```powershell
cd backend
pnpm.cmd run migration:calendar:verify -- --company-id=<COM-uuid> --branch-id=<Kowdiar-uuid>
```

Report: `docs/product/business-calendar-stage-10-verify-report.json`

Production-named DB: add `--allow-production` only after backup evidence.

---

## 2. Deployment (§21.2)

### 2.1 Deploy order

1. **Additive migration** (reviewed):  
   `npx prisma migrate deploy`  
2. **Backend** deploy (consumers already gated by office `runtimeMode`; default LEGACY).  
3. **Frontend** deploy (nav already permission-gated to `calendar.business.read`).  
4. **Post-deploy verify:** `pnpm run migration:calendar:verify -- …`
5. **Provision calendars (LEGACY):**  

```powershell
pnpm.cmd run migration:calendar:provision -- --company-id=<uuid> --actor-user-id=<uuid>
# review dry-run report, then:
pnpm.cmd run migration:calendar:provision -- --company-id=<uuid> --actor-user-id=<uuid> --apply
```

6. Keep all offices **LEGACY**.  
7. HR reviews working week + events (UI or Stage 5 backfill → publish).  
8. Publish draft versions.  
9. Enable **SHADOW** (API or Stage 5 shadow `--activate-shadow`):  

```powershell
pnpm.cmd run migration:calendar:shadow -- --company-id=<uuid> --branch-id=<uuid> --actor-user-id=<uuid> --activate-shadow
# or alias:
pnpm.cmd run migration:calendar:shadow -- ...same args...
```

10. Approve parity report (zero unexplained diffs).  
11. Enable **ACTIVE** for **pilot branch only**:  

```http
POST /business-calendar/runtime/mode
{ "companyId": "...", "branchId": "...", "mode": "ACTIVE" }
```

Blocks `LEGACY → ACTIVE` (must SHADOW first).

12. Smoke-test Leave / Roster / Attendance / Workforce Calendar / Business Calendar UI.  
13. Expand office by office using the same SHADOW → ACTIVE path.

### 2.2 Consumers stay safe

| Mode | Leave / Roster / Attendance / WF Calendar |
|------|-------------------------------------------|
| LEGACY | Legacy Holiday + BranchWorkingDay |
| SHADOW | Still legacy consumers; parity compare only |
| ACTIVE | Runtime consumer path |

---

## 3. Monitoring (§21.3)

Watch for 48h after pilot ACTIVE:

| Signal | Where |
|--------|--------|
| Runtime resolve failures | API 4xx/5xx on `/business-calendar/runtime/*` |
| Parity diffs | Stage 5/10 compare report |
| Missing TZ / location | Stage 10 verify `blockers` |
| Publish conflicts | `409` stale / overlap |
| Import failures | Import batch `FAILED` |
| Outbox lag | Outbox admin / metrics |
| Unresolved impacts | `/administration/business-calendar/impacts` |
| Leave/Roster deltas | Spot-check vs pre-cutover samples |

Logs: request IDs + entity IDs only (no leave reasons / PII dumps).

---

## 4. Rollback (§21.4)

### Before any ACTIVE office / before calendar-dependent Runtime IDs matter

1. `POST /business-calendar/runtime/mode` → `LEGACY` for that office.  
2. Optionally hide nav by removing `calendar.business.read` from non-pilot roles.  
3. **Keep** additive tables and audit history.

### After ACTIVE transactions exist

1. Do **not** drop tables or delete runtime revisions.  
2. Prefer forward fix; keep Leave/Roster/Attendance snapshots.  
3. Restore from backup **only** for migration corruption / unrecoverable deploy failure.

Legacy `holidays` + `branch_working_days` remain for ≥ 2 stable releases after last office cutover.

---

## 5. Smoke checklist (pilot ACTIVE)

| # | Check | Pass? |
|---|-------|-------|
| S1 | Business day preview matches published calendar | |
| S2 | New leave request excludes Runtime holiday | |
| S3 | Draft roster generation sets runtime day ids | |
| S4 | Published roster unchanged by later amendment | |
| S5 | Attendance check-in uses roster snapshot | |
| S6 | Locked attendance period rejects rewrite | |
| S7 | Workforce calendar privacy unchanged | |
| S8 | Impacts list reachable | |

---

## 6. CLI index

| Script | npm |
|--------|-----|
| Post-deploy verify | `migration:calendar:verify` |
| Provision legacy calendars | `migration:calendar:provision` |
| Parity compare | `migration:calendar:shadow` |
| Backfill | `migration:calendar:backfill` |
| Shadow | `migration:calendar:shadow` |

---

*Execution of this runbook on production is an ops change, not an automated Stage 10 test.*
