# Leave review — what it means + fix phases

Manager review: **not release-ready**. Build/tests mostly pass. Real bugs remain. **No DB/migration was changed in that review.**

Say **start Phase A** (then B, C…) when you want to fix. One phase at a time.

---

## What the verdict means (simple)

| They said | Meaning |
|---|---|
| Substantial, builds | Leave feature is mostly there |
| Not release-ready | Do not ship until P1s are fixed |
| Partial / Remediation Required | Fix bugs first, then prove on a **disposable** DB + UAT |
| Worktree clean at `d6317c2` | They reviewed that commit only |

**Passed:** backend tests, prisma validate, lint/build both sides.  
**Not passed:** 4 P1 bugs, 2 P2 bugs, migration not applied, no e2e/Playwright, no signed UAT.

---

## Confirmed issues (plain language)

### P1-1. Manager can be assigned but cannot approve (stuck)

When someone applies leave, we pick the reporting manager if they are an **active employee in the company**.

We do **not** check:
- they have a **login** (active User)
- they have **`hr.team.approve`**

So a manager with no login / no permission is stored as the approver. The request sits in Manager review forever. Nobody eligible can act.

### P1-2. Any HR with leave.manage can act (not only assigned)

HR step was snapshotted to one person (oldest HR). We later allowed **any in-scope employee with `hr.leave.manage`** so UAT HR could see the queue.

Reviewer says that is too wide: it can **bypass** the assigned HR.

**Intent to keep:** HR queue is company/scope HR, not one frozen person.  
**Intent to tighten:** only real HR in that scope (not a random person who somehow has the permission), still no self-approve / same-actor.

### P1-3. A working-day override can show as a holiday

Business Calendar can mark a date as **must work** (override). That row still uses reason `EVENT`. Workforce Calendar treats **every EVENT as a holiday**, so a working day can look like a holiday / non-working day.

Also a fallback reads **raw published events**, not the official effective calendar version.

### P1-4. Mixed ACTIVE + LEGACY branches drop company holidays

If **Branch A** uses Business Calendar (ACTIVE) and **Branch B** still uses old Holiday master (LEGACY), company-wide legacy holidays may be skipped for Branch B. People on LEGACY branch miss company holidays.

### P1-5. Leave day-count is read outside the save transaction

On submit we lock and reserve balance in a **serializable transaction**. Policy + calendar day-count still use the **normal** DB client. Two people submitting at once can see different working-day / policy data than the reservation.

### P2-1. Matrix allows 0 days while ticked

Work order: if a cell is **enabled**, days must be **> 0**.  
Today `0` can save. Also missing: **unchanged count** on save, and **omitted cells should disable** that policy.

### P2-2. Notifications go to the employee, not the approver

Outbox emails/notifies the **requester**. Manager/HR do not get “please approve”. After manager approves, HR is not notified.

### Gates (not code bugs — proof still missing)

- B0 migration still **unapplied** (do **not** run on live RDS / `dsp_erp_dev`)
- `jest-e2e.json` missing → `test:e2e` fails
- No Playwright / frontend tests
- Disposable-DB + signed Employee/Manager/HR UAT still open

---

## Phases

### Phase A — Manager must be able to login and approve ✅

**Fix P1-1.** When resolving the manager step, require:
- active Employee in company
- linked **active User**
- permission **`hr.team.approve`**

If not eligible, skip manager (same as today when no manager) and do not assign a stuck person.

**Exit:** A manager without login/permission is never stored as current approver.

---

### Phase B — HR act: in-scope HR only, not a wide bypass ✅

**Fix P1-2.** Keep: any **in-scope HR** can see/act on the HR step (so queue is not one old snapshotted person).  
Tighten: actor must have `hr.leave.manage` **and** a scoped HR role (HR Manager / Company Admin / Org Owner) for that employee's tenant; keep self-ban and “manager who already decided cannot do HR”.  
Assigned HR can still act.

**Exit:** Random non-HR cannot approve. Real company HR can. Assigned-only stuck queue is gone.

---

### Phase C — Calendar: override is not a holiday ✅

**Fix P1-3.** Holiday projection must use **dayStatus** (or equivalent): only non-working / half-day holiday, never `WORKING_DAY_OVERRIDE`.  
Stop using raw published events as the source of truth; use effective runtime / effective version.

**Exit:** Forced working day does not show as holiday.

---

### Phase D — LEGACY branch still gets company holidays ✅

**Fix P1-4.** If any branch in the company is LEGACY, company-wide legacy holidays still apply to those LEGACY branches, even if another branch is ACTIVE.

**Exit:** Mixed-mode company: LEGACY branch sees company holidays.

---

### Phase E — Submit calculation inside the same transaction ✅

**Fix P1-5.** `resolveCalculation` must use the **transaction client** (policy + calendar reads under the same serializable txn as reserve).

**Exit:** Day count and balance reserve share one transaction.

---

### Phase F — Matrix: no zero-day enabled cells ✅

**Fix P2-1.** Enabled cell entitlement **> 0**. Return **unchanged** count. **Omitted** cells disable those policies (per work order).

**Exit:** Tick + `0` rejected. Save payload matches WO.

---

### Phase G — Notify the current approver ✅

**Fix P2-2.** Outbox targets **current approver** (manager, then HR). After manager approve, emit an event so HR is notified. Requester still gets status updates.

**Exit:** Manager gets submit notice; HR gets notice after manager approve.

---

### Phase H — Release gates (later, not live DB) ✅

**Not a product bugfix.** Disposable DB only:
- apply/validate B0 migration — `pnpm run migration:leave-policy:preflight` + `migration:leave-policy:apply` (explicit disposable URL only)
- `jest-e2e.json` added — `pnpm run test:e2e` runs HTTP e2e specs
- Playwright / UAT sign-off — manual checklist in `leave-review-phase-h.md`

**Do not** migrate `dsp_erp_dev` or AWS RDS unless you explicitly say so.

**Pack:** `docs/product/leave-review-phase-h.md`

---

## Order

| Phase | What | Priority |
|------|------|----------|
| A | Eligible manager | P1 |
| B | HR act rules | P1 |
| C | Holiday vs working override | P1 |
| D | Mixed ACTIVE/LEGACY holidays | P1 |
| E | Calc inside transaction | P1 |
| F | Matrix > 0 + omit/disable | P2 |
| G | Approver notifications | P2 |
| H | Disposable migrate + e2e/UAT | Gates |

**Suggested:** `A → B → C → D → E → F → G`, then **H** when you want release proof.

---

## Wave 2 — New review findings (after A–H)

Manager re-reviewed after remediation. New issues below. Say **start Phase I** (then J…) to fix one at a time.

### Confirmed issues (plain language)

#### W2-P1-1. Manager permission is not tenant-scoped

Phase A checked: active User + employee in company + `hr.team.approve`.

It did **not** check that the role assignment is for **this employee’s Branch / Company / Company Group**.

So a person who is the reporting manager, but only has `hr.team.approve` from **another** company/branch assignment, can still be snapshotted as approver — then may fail when they try to act (or act with wrong authority).

**Intent:** Same pattern as scoped HR (Phase B): permission must land in the subject’s tenant scope.

#### W2-P1-2. Leave balances bypass the immutable ledger

Leave **submit / approve / reject** already use the ledger (reserve / consume / release).

But HR **create / update / delete** balance APIs still write `entitlement` / `used` / `pending` / `balance` **directly** — no ledger row, no mandatory reason, no audit trail that matches the approved leave plan.

**Intent:** Any balance number change goes through ledger (+ reason + audit). Manual edits are adjustments, not silent field updates.

#### W2-P1-3. Matrix “replace” still only updates dirty cells

Phase F rejected zero-day enabled cells and returned `unchanged`.

Work order still says: **omitted cells should disable** those policies.

Today:
- Frontend sends **only dirty** cells
- Backend loops **only submitted** cells

So an active policy that HR never touches in this save stays enabled forever. That is **not** a full replace contract.

**Intent (pick one and lock it):**
- **A (WO literal):** Save = full grid replace → omitted = disable (frontend must send every cell, or backend disables missing keys).
- **B (product pragmatic):** Save = patch dirty cells only → document that omitted means “leave unchanged”, not “disable”.

Reviewer expects **A**. Plan below follows **A**.

#### W2-P1-4. Missing runtime rows can hide holidays

After Phase C, ACTIVE offices load holidays from **materialized runtime rows only**.

Publish commits the version **first**, then materializes. If materialization fails or the visible calendar range was never written, employee/workforce calendars can show **no holidays** even though the published calendar has them.

**Intent:** Calendar holiday projection must not silently empty when runtime is incomplete — materialize-on-read, or fail/preview fill, or block publish until materialize succeeds.

#### W2-P2-1. Entitlement validation inconsistent

Matrix requires entitlement **> 0**. Standalone policy form allows **0**. Create/update DTO has **no Min/Max**, so API can send **negative** days.

**Intent:** One rule everywhere: enabled/policy entitlement **> 0** (and a sensible max), UI + API.

---

### Wave 2 phases

### Phase I — Manager approve permission must be in tenant scope ✅

**Fix W2-P1-1.** In `resolveEligibleManager`, require `hr.team.approve` via a role assignment scoped to the subject employee’s branch **or** company **or** company group (mirror HR scoping, not “any assignment anywhere”).

**Exit:** Manager with only foreign-scope `hr.team.approve` is skipped (null), not assigned.

---

### Phase J — Balance edits go through ledger ✅

**Fix W2-P1-2.** Remove or lock direct create/update of entitlement/used/pending/balance. Manual changes = ledger adjustment with mandatory reason + audit. Soft-delete still audited. Prefer generate-missing / ledger paths for HR UI.

**Exit:** No balance field rewrite without a ledger transaction.

---

### Phase K — Matrix replace disables omitted cells ✅

**Fix W2-P1-3.** Backend: after applying submitted cells, **disable every other active designation cell in scope** that was not in the payload (or require full grid and reject partial). Frontend: either send full cell set on save, or keep dirty-only but backend still disables omitted actives (document clearly). Prefer: frontend sends full grid snapshot for the loaded designations × leave types.

**Exit:** Unticked / omitted previously-active cell becomes disabled on save.

---

### Phase L — Calendar holidays when runtime is incomplete ✅

**Fix W2-P1-4.** For ACTIVE offices: if runtime row missing for a date in range, **preview/resolve** (or materialize that range) before projecting holidays — same safety as leave duration consumer. Optionally tighten publish so materialize failure is surfaced (not silent empty calendar).

**Exit:** Published holiday still appears on workforce/personal calendar even if a runtime row was missing.

---

### Phase M — Policy entitlement > 0 everywhere ✅

**Fix W2-P2-1.** Align DTO (`Min(0.01)` / max), standalone form schema, and service create/update with matrix rule.

**Exit:** Form and API reject 0 / negative entitlement.

---

## Wave 2 order

| Phase | What | Priority |
|------|------|----------|
| I | Manager permission tenant-scoped | P1 |
| J | Balance ledger for manual edits | P1 |
| K | Matrix omit = disable | P1 |
| L | Runtime missing ≠ hide holidays | P1 |
| M | Entitlement > 0 on form/API | P2 |

**Suggested:** `I → J → K → L → M`.
