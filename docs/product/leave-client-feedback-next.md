# Leave — client feedback (post demo)

Short notes from client review. **What they asked** vs **what we have**, plus **phases** to implement one at a time.

Say **start Phase X** when ready. Do not start the next phase until the current one is done.

---

## Client asks vs today

### 1. Leave policies — monthly + decimals

| Client asked | What we have now |
|---|---|
| Per role (designation), set **how much leave per month** | Policy matrix / form uses **annual entitlement** |
| Allow **decimal** values (e.g. `1.5`) | Decimals already in data; UI step is `0.5` |
| UI should feel monthly | UI still yearly |

### 2. Leave types — company wise

| Client asked | What we have now |
|---|---|
| Each company has its own leave types | Already company-scoped (`companyId`) |

### 3. Leave balances → Employee leave balance

| Client asked | What we have now |
|---|---|
| Rename to **Employee Leave Balance** | Nav says **Balances** |
| List employees, balances under each | Generate / tool screen — hard to read |
| Admin / HR see people in their scope | Scope exists; list UX does not match |

### 4. My Workspace calendar — day click

| Client asked | What we have now |
|---|---|
| Click date → simple **day window** | Day panel exists |
| Remove **Apply leave** from that panel | Apply leave button is on the day panel |
| Day view is for everything later (leave, tasks…) | Leave-focused today |

---

## Phases

### Phase 0 — Leave types company check (small) ✅

**Goal:** Confirm leave types are company-wise in UI and wording.

- Done: Types page requires a **company** filter (defaults to active / sole company)
- Done: List loads only that company’s types; empty copy explains company ownership
- Done: Create pre-fills selected company; edit locks company
- No model change (already `LeaveType.companyId`)

**Exit:** HR can see that types belong to the selected company.

---

### Phase 1 — Policies: monthly entitlement + decimals ✅

**Goal:** HR sets **leave days per month** per designation (role), with decimals.

- Done: Matrix + policy form use **days per month** (decimals, e.g. `1.5`)
- Done: API/DB still store **yearly** as `monthly × 12` so generate/balance math stays consistent
- Done: List column shows **Days / month**
- Existing yearly policies (e.g. 12) show as `1` per month in the UI

**Exit:** Matrix cell = monthly days; decimals save; balances still make sense for the year.

---

### Phase 2 — Employee Leave Balance list ✅

**Goal:** Admin/HR see employees and each person’s leave balances under them.

- Done: Nav renamed **Employee Leave Balance**
- Done: Employee list with expand → leave types (entitlement / used / pending / available)
- Done: Year + company + branch filters; scope from existing domain scope
- Done: **Generate balances** kept as secondary action

**Exit:** Open page → employee list → expand one person → see their balances.

---

### Phase 3 — My Workspace day window cleanup ✅

**Goal:** Day click is a simple day detail, not a leave-apply shortcut.

- Done: Removed **Apply leave** from the day detail panel
- Done: Apply leave stays in the calendar toolbar (and Balances tab)
- Done: Day panel copy kept short — date + what is on that day

**Exit:** Click a calendar date → simple day window, no Apply leave button there.

---

## Order

| Phase | Name | Depends on |
|------|------|------------|
| 0 | Leave types company check | — |
| 1 | Monthly policy + decimals | — |
| 2 | Employee Leave Balance list | Phase 1 preferred (monthly numbers show correctly) |
| 3 | Day window cleanup | — (can run anytime) |

**Suggested:** `0 → 1 → 2 → 3`

---

## How we run

1. You say **start Phase 0** (or 1 / 2 / 3)
2. That phase only is implemented and checked
3. You review, then say start next phase
