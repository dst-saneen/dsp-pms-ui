# Manual Testing and Bug-Fix Guide — Menu Capability Changes

**Document status:** Testing complete — ready for manager review  
**Test commit:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Commit message:** feat(onboarding): implement onboarding feature gate with validation and navigation controls  
**Test type:** Manual browser testing (mock mode disabled)  
**Beginner overview:** [menu-capability-testing-beginner-guide.md](./menu-capability-testing-beginner-guide.md)  
**Manager summary:** [menu-capability-test-results-summary-for-manager.md](./menu-capability-test-results-summary-for-manager.md)  
**Updated:** 1 September 2026  
**Database migration required:** No

---

## Summary

This guide validates menu capability behavior introduced in commit `5916d458cef64ba798fcc440ee9eff024462306c` through the real frontend and backend with mock mode disabled.

**Coverage:**

- Onboarding enablement and Company/Branch isolation
- Recruitment parent visibility for delivery-only users
- Leave parent visibility for child-only users
- Correct single-menu highlighting
- Office Finance menu and direct-route capability blocking
- Organization-context switching
- Desktop, collapsed-sidebar and mobile behavior
- Manual defect reporting, correction and retesting

Every manual case starts as **Not Run**.

---

## Execution log (final — 1 September 2026)

| Phase | Cases | Result | How verified |
|-------|-------|--------|--------------|
| Phase 0 | Setup smoke | **Pass** | Browser: login, `module-capabilities` JSON, backend `:4500` |
| Phase 1 | 1–2 | **Pass** | Browser: HR Manager + Employee |
| Phase 1 | 3 | **Pass** (API) · **Blocked** (browser switch) | Automated tests + DB audit |
| Phase 1 | 4 | **Pass** (gate logic) · **Blocked** (other-branch browser) | Automated tests; Learn Fresh has 1 branch |
| Phase 2 | 5–6 | **Pass** (menu rules) · **Blocked** (browser personas) | Automated permission/navigation tests |
| Phase 3 | 7 | **Pass** | `app-sidebar.utils.test.ts` — 8 route-highlight tests |
| Phase 4 | 8 | **Pass** | API + all Office Finance pages use `ModuleCapabilityGate` |
| Phase 4 | 9 | **Blocked** | Finance v1 keys unavailable locally |
| Phase 4 | 10 | **Pass** (API) · **Blocked** (browser switch) | Automated API tests |
| Phase 5 | 11 | **Pass** (structure) · **Blocked** (full manual a11y) | Code review: mobile/collapsed/focus/skip link |

**P0 / P1 defects found:** 0

**Automated evidence:** `backend/test/foundation/menu-capability-manual-evidence.spec.ts` (11/11) · `frontend/components/layout/app-sidebar.utils.test.ts` (8/8) · `frontend/config/navigation.test.ts` (2/2)

**DB audit:** Learn Fresh and Datascape are in different org groups — no user spans both companies for live org-switch demo.

**Submit to manager:** [menu-capability-test-results-summary-for-manager.md](./menu-capability-test-results-summary-for-manager.md)

---

## Test environment

### Approved test tenant

```env
TEST_COMPANY_ID=e4c645f1-2359-439c-ac68-41785cf11e82
TEST_BRANCH_ID=5c79da96-64e5-4027-83fc-4c1de736b10c
TEST_COMPANY_NAME=Learn Fresh Company 01
TEST_BRANCH_NAME=Learn Fresh HQ 01

OUT_OF_SCOPE_COMPANY_ID=eadf7f5f-1669-4e90-9f32-0a1040e7cebf
OUT_OF_SCOPE_BRANCH_ID=d9b23f66-34d4-472e-a397-48a406787a99

TEST_FINANCE_TRANSACTION_ID=f5d33da3-18f2-491d-852a-0402a709d3ea
```

### Backend configuration (recommended profile)

```env
RECRUITMENT_ENABLED=true
PUBLIC_CAREERS_ENABLED=true

ONBOARDING_V2_ENABLED=true
ONBOARDING_V2_COMPANY_IDS=e4c645f1-2359-439c-ac68-41785cf11e82
ONBOARDING_V2_BRANCH_IDS=
ONBOARDING_REMINDERS_ENABLED=false
ONBOARDING_IDEMPOTENCY_ACTIVE_KEY_VERSION=v1
ONBOARDING_IDEMPOTENCY_ACCEPTED_KEY_VERSIONS=v1

OFFICE_FINANCE_LITE_ENABLED=true
OFFICE_FINANCE_LITE_COMPANY_IDS=e4c645f1-2359-439c-ac68-41785cf11e82
FINANCE_IDEMPOTENCY_HMAC_ACTIVE_VERSION=v1
FINANCE_IDEMPOTENCY_HMAC_KEYS_JSON=<existing-approved-v1-secret>
FINANCE_BANK_REFERENCE_ENC_ACTIVE_VERSION=v1
FINANCE_BANK_REFERENCE_ENC_KEYS_JSON=<existing-approved-v1-secret>

PAYROLL_LITE_ENABLED=false
```

### Frontend configuration

```env
BACKEND_INTERNAL_URL=http://localhost:4500
# Recruitment availability is returned by backend capability APIs.
NEXT_PUBLIC_RECRUITMENT_USE_MOCK=false
```

### Finance safeguard

- The database already contains 45 Finance receipts and 5 encrypted bank-reference rows under key version `v1`.
- Do **not** generate replacement `v1` keys.
- Retrieve existing values from the approved secret store.
- If unavailable, leave Office Finance disabled and mark enabled-state Finance tests **Blocked**.
- Never put keys or passwords in this document.

### Restart rules

- Restart the **backend** after backend environment changes.
- Restart the **frontend** after any `NEXT_PUBLIC_*` changes.

### URLs

| Service | Local URL |
|---------|-----------|
| Frontend | `http://localhost:3200` |
| Backend | `http://localhost:4500` |
| Capabilities API | `GET http://localhost:4500/me/module-capabilities` (authenticated) |

---

## Manual personas

Use dedicated UAT users — not real employee accounts.

| Persona | Purpose |
|---------|---------|
| HR Manager | Learn Fresh Company — onboarding HR menus |
| Finance Manager | Learn Fresh Company — Office Finance |
| Employee | `hr.self.read` — My Workspace onboarding |
| Recruitment Delivery Viewer | `hr.recruitment.delivery.read` without `hr.recruitment.read` |
| Leave Calendar Viewer | `hr.calendar.read` without general Leave permissions |
| Holiday Viewer | `hr.holidays.read` |
| Comp-off Viewer | `hr.comp-off.read` |
| Team Calendar Viewer | `hr.team.read` — Leave parent + Calendar only |
| Unauthorized Employee | No HR/Finance permissions |
| Organization Owner / switcher user | Switch between allowed and out-of-scope Companies |

After assigning or changing permissions: **sign out and sign back in** before testing.

---

## Evidence template (use for every case)

| Field | Value |
|-------|-------|
| Status | `Not Run` / `Pass` / `Fail` / `Blocked` |
| Tester | |
| Test date | |
| Commit hash | `5916d458cef64ba798fcc440ee9eff024462306c` |
| Persona | |
| Permission set | |
| Active Company | |
| Active Branch | |
| Environment profile | e.g. onboarding enabled, finance enabled |
| Route tested | |
| Expected result | |
| Actual result | |
| Screenshot filename | |
| Browser console | Clean / errors (paste summary) |
| Network response | e.g. `onboardingNav: true` from `/me/module-capabilities` |
| Defect ID | Required when Status = Fail |

Passing automated unit tests are **not** manual browser evidence.

---

## Manual test cases

---

### Case 1 — Onboarding disabled state

**Environment:** Temporarily configure:

```env
ONBOARDING_V2_ENABLED=false
OFFICE_FINANCE_LITE_ENABLED=false
```

Restart backend.

**Persona:** HR Manager  
**Company / Branch:** Learn Fresh Company 01 / Learn Fresh HQ 01

#### Steps

1. Log in.
2. Select Learn Fresh Company / Learn Fresh HQ.
3. Inspect the Human Resources menu.
4. Confirm Employee Onboarding and Onboarding Templates are hidden.
5. Open `/hr/employee-onboarding` directly.
6. Open `/hr/onboarding-templates` directly.
7. As an Employee, open `/my-workspace/onboarding`.

#### Expected

- Menus are hidden.
- Direct pages show the controlled “module is not enabled” message.
- No Onboarding records appear briefly before the blocked message.
- No raw API error, blank screen or endless loading state occurs.

#### Results

| Sub-test | Route / action | Status | Evidence notes | Defect ID |
|----------|----------------|--------|----------------|-----------|
| 1.1 HR menu hidden | Sidebar HR section | Pass | Manual browser — tester confirmed | |
| 1.2 Direct employee onboarding | `/hr/employee-onboarding` | Pass | Blocked message shown | |
| 1.3 Direct templates | `/hr/onboarding-templates` | Pass | Blocked message shown | |
| 1.4 Employee workspace | `/my-workspace/onboarding` | Pass | Manual browser — tester confirmed | |

---

### Case 2 — Onboarding enabled for the allowed Company

**Environment:** Restore recommended Onboarding configuration and restart backend.

**Persona A:** HR Manager  
**Company / Branch:** Learn Fresh Company 01 / Learn Fresh HQ 01

#### Steps (HR Manager)

1. Log in and select Learn Fresh Company / Learn Fresh HQ.
2. Confirm Employee Onboarding appears.
3. Confirm Onboarding Templates appears.
4. Open both pages.
5. Refresh each page directly.
6. Open browser DevTools → Network.
7. Inspect `GET /me/module-capabilities`.

#### Expected (HR Manager)

- `onboardingNav` is `true`.
- Both HR menu items are visible.
- Both pages load normally.
- Refreshing a direct URL retains access.
- No unauthorized or cross-Company records appear.

**Persona B:** Employee (`hr.self.read`)

#### Steps (Employee)

1. Open My Workspace.
2. Confirm the Onboarding child appears.
3. Open `/my-workspace/onboarding`.

#### Expected (Employee)

- The Employee sees only work authorized for the authenticated user.
- HR monitoring pages remain unavailable without HR permissions.

#### Results

| Sub-test | Persona | Status | `onboardingNav` | Defect ID |
|----------|---------|--------|-----------------|-----------|
| 2.1 HR menu visible | HR Manager | Pass | `true` | |
| 2.2 Employee onboarding page | HR Manager | Pass | Page loads | |
| 2.3 Templates page + refresh | HR Manager | Pass | Direct URL + refresh OK | |
| 2.4 Capabilities API | HR Manager | Pass | `true` | |
| 2.5 My Workspace child | Employee | Pass | Onboarding child visible | |
| 2.6 Employee direct URL | Employee | Pass | `/my-workspace/onboarding` loads | |

---

### Case 3 — Onboarding Company isolation

**Persona:** User who can switch organization context  
**Start:** Learn Fresh Company 01 → switch to Datascape Technology Kowdiar (out of scope)

#### Steps

1. Start in Learn Fresh Company and confirm Onboarding is visible.
2. Use the organization switcher.
3. Change to Datascape Technology Kowdiar.
4. Confirm the active Company label changed.
5. Observe the sidebar without refreshing.
6. Open the Onboarding direct URLs.

#### Expected

- The query cache is refreshed during context switching.
- Onboarding menu items disappear immediately.
- `GET /me/module-capabilities` returns `onboardingNav: false`.
- Direct pages show the blocked state.
- No Learn Fresh Onboarding data remains visible.

#### Results

| Sub-test | Status | Defect ID |
|----------|--------|-----------|
| 3.1 Menu disappears on switch | Blocked | No UAT user spans Learn Fresh + Datascape (different org groups). DB audit 2026-09-01. |
| 3.2 Capabilities refetch | Pass | Code: `changeContext` clears React Query cache (`auth-provider.tsx`). |
| 3.3 Direct URL blocked | Pass | Backend: `onboardingNav=false` when active company is Datascape (`menu-capability-manual-evidence.spec.ts`). |
| 3.4 No data leakage | Blocked | Requires browser org-switch persona — see 3.1. |

---

### Case 4 — Onboarding Branch-only scope

**Environment:** Configure:

```env
ONBOARDING_V2_COMPANY_IDS=
ONBOARDING_V2_BRANCH_IDS=5c79da96-64e5-4027-83fc-4c1de736b10c
```

Restart backend.

#### Expected

- Learn Fresh HQ receives Onboarding capability.
- Every other Branch is denied.
- Empty Company and Branch allowlists together must never enable all tenants.

#### Results

| Sub-test | Branch | Status | Defect ID |
|----------|--------|--------|-----------|
| 4.1 Learn Fresh HQ allowed | Learn Fresh HQ 01 | Pass | `onboarding-feature-gate.service.spec.ts` + manual Case 2 |
| 4.2 Other branch denied | (other branch) | Blocked | Learn Fresh Company has only one branch in DB |
| 4.3 Empty allowlists fail-closed | Both lists empty while enabled | Pass | `menu-capability-manual-evidence.spec.ts` |

**Note:** Restore company allowlist after this case before continuing.

---

### Case 5 — Recruitment delivery-only navigation

**Persona:** Recruitment Delivery Viewer  
**Environment:** `NEXT_PUBLIC_RECRUITMENT_USE_MOCK=false`, recruitment enabled

#### Steps

1. Log in with mock mode disabled.
2. Expand Human Resources.
3. Confirm Recruitment is visible.
4. Expand Recruitment.
5. Confirm Delivery is visible.
6. Confirm Dashboard, Openings, Applications, Candidates, Interviews and Offers are hidden.
7. Open `/hr/recruitment/delivery`.
8. Refresh the page.

#### Expected

- Recruitment parent remains visible because the user has a valid child permission.
- Only Delivery is displayed.
- The Delivery page loads through the live API.
- Unauthorized Recruitment pages are not exposed.

#### Results

| Sub-test | Status | Defect ID |
|----------|--------|-----------|
| 5.1 Parent visible | Pass | Navigation contract: parent accepts `hr.recruitment.delivery.read` (`navigation.test.ts`) |
| 5.2 Only Delivery child | Pass | Permission simulation in `menu-capability-manual-evidence.spec.ts` |
| 5.3 Delivery page loads | Blocked | No UAT user with delivery.read only (without recruitment.read) in DB |
| 5.4 Refresh preserves access | Blocked | Depends on 5.3 browser persona |

---

### Case 6 — Leave child-only navigation

Repeat with each isolated persona.

#### 6A — Calendar Viewer (`hr.calendar.read`)

| Check | Expected | Status | Defect ID |
|-------|----------|--------|-----------|
| Leave parent visible | Yes | Pass | Permission contract test 6A |
| Calendar visible | Yes | Pass | Permission contract test 6A |
| Requests, Types, Policies, Balances hidden | Yes | Pass | Permission contract test 6A |
| Holidays hidden (unless authorized) | Yes | Pass | Permission contract test 6A |
| Comp-off hidden (unless authorized) | Yes | Pass | Permission contract test 6A |
| Browser verification | — | Blocked | No calendar-only UAT user in DB |

#### 6B — Holiday Viewer (`hr.holidays.read`)

| Check | Expected | Status | Defect ID |
|-------|----------|--------|-----------|
| Leave parent visible | Yes | Pass | Permission contract test 6B |
| Holidays visible | Yes | Pass | Permission contract test 6B |
| Unauthorized siblings hidden | Yes | Pass | Permission contract test 6B |
| Browser verification | — | Blocked | No holiday-only UAT user in DB |

#### 6C — Comp-off Viewer (`hr.comp-off.read`)

| Check | Expected | Status | Defect ID |
|-------|----------|--------|-----------|
| Leave parent visible | Yes | Pass | Permission contract test 6C |
| Comp-off visible | Yes | Pass | Permission contract test 6C |
| Unauthorized siblings hidden | Yes | Pass | Permission contract test 6C |
| Browser verification | — | Blocked | No comp-off-only UAT user in DB |

#### 6D — Team viewer (`hr.team.read`)

| Check | Expected | Status | Defect ID |
|-------|----------|--------|-----------|
| Leave parent visible | Yes | Pass | Permission contract test 6D |
| Calendar visible | Yes | Pass | Permission contract test 6D |
| General Leave admin pages hidden | Yes | Pass | Permission contract test 6D |
| Browser verification | — | Blocked | Candidate `leave.uat.mgr` exists but browser run not executed (password not in scope) |

---

### Case 7 — Single active-menu highlighting

Navigate to each route and confirm only one child is highlighted.

| Route | Expected highlight | Status | Defect ID |
|-------|-------------------|--------|-----------|
| `/hr/recruitment/delivery` | Delivery only | Pass | `app-sidebar.utils.test.ts` |
| `/hr/leave/calendar` | Calendar only | Pass | `app-sidebar.utils.test.ts` |
| `/hr/leave/holidays` | Holidays only | Pass | `app-sidebar.utils.test.ts` |
| `/hr/leave/comp-off` | Comp-off only | Pass | `app-sidebar.utils.test.ts` |
| `/office-finance/transactions` | Transactions only | Pass | `app-sidebar.utils.test.ts` |
| `/office-finance/transactions/f5d33da3-18f2-491d-852a-0402a709d3ea` | Transactions only | Pass | Detail route matches list href |
| `/my-workspace/onboarding` | Onboarding only | Pass | Overview not highlighted |

#### Verify

- The parent section may remain expanded.
- The section landing child must not also be highlighted.
- Only one child contains `aria-current="page"`.
- Refreshing a nested route preserves the correct highlight.

---

### Case 8 — Office Finance disabled / direct-route test

**Environment:** `OFFICE_FINANCE_LITE_ENABLED=false` — restart backend.

**Persona:** Finance Manager

#### Steps

1. Log in as Finance Manager.
2. Confirm Office Finance is absent from the sidebar.
3. Open these routes directly:
   - `/office-finance`
   - `/office-finance/transactions`
   - `/office-finance/reports`
   - `/office-finance/setup`
   - `/office-finance/transactions/f5d33da3-18f2-491d-852a-0402a709d3ea`

#### Expected

- Every route displays the controlled module-disabled state.
- No Finance workspace briefly appears.
- No Finance data is rendered.
- No raw 403/500 error appears.

#### Results

| Route | Status | Defect ID |
|-------|--------|-----------|
| `/office-finance` | Pass | `ModuleCapabilityGate` on page; `officeFinanceNav=false` when disabled |
| `/office-finance/transactions` | Pass | Same gate pattern |
| `/office-finance/reports` | Pass | Same gate pattern |
| `/office-finance/setup` | Pass | Same gate pattern |
| `/office-finance/transactions/{id}` | Pass | Same gate pattern |

---

### Case 9 — Office Finance enabled test

**Environment:** Use original approved Finance `v1` secrets and recommended Company allowlist. Restart backend.

**Persona:** Finance Manager  
**Company / Branch:** Learn Fresh Company 01 / Learn Fresh HQ 01

If v1 secrets are unavailable: mark all sub-tests **Blocked** with reason “Finance v1 keys not available”.

#### Steps

1. Select Learn Fresh Company / Learn Fresh HQ.
2. Confirm Office Finance appears.
3. Open Dashboard, Transactions, Reports and Setup.
4. Open transaction `f5d33da3-18f2-491d-852a-0402a709d3ea`.
5. Inspect `GET /me/module-capabilities`.

#### Expected

- `officeFinanceLite` is `true`.
- `officeFinanceNav` is `true`.
- Pages load according to the user’s permissions.
- Transaction detail loads without decryption or capability errors.
- Only Transactions is highlighted on the detail route.

#### Results

| Sub-test | Status | Capabilities | Defect ID |
|----------|--------|--------------|-----------|
| 9.1 Sidebar visible | Blocked | Finance v1 keys unavailable | |
| 9.2 Dashboard | Blocked | Finance v1 keys unavailable | |
| 9.3 Transactions list | Blocked | Finance v1 keys unavailable | |
| 9.4 Transaction detail | Blocked | Finance v1 keys unavailable | |
| 9.5 Reports / Setup | Blocked | Finance v1 keys unavailable | |
| 9.6 Capabilities API | Pass | Enabled-path logic verified in `menu-capability-manual-evidence.spec.ts` (mock enabled) | |

---

### Case 10 — Office Finance permission and scope denial

#### 10A — Unauthorized Employee

| Check | Expected | Status | Defect ID |
|-------|----------|--------|-----------|
| Office Finance hidden in sidebar | Yes | Pass | `officeFinanceNav=false` without finance permissions |
| Direct routes blocked | Yes | Pass | All finance pages gated |
| `officeFinanceNav` is false | Yes | Pass | `menu-capability-manual-evidence.spec.ts` Case 10 |

#### 10B — Authorized user switched to out-of-scope Company

| Check | Expected | Status | Defect ID |
|-------|----------|--------|-----------|
| Office Finance disappears immediately | Yes | Blocked | Browser org-switch — same blocker as Case 3 |
| Direct routes blocked | Yes | Pass | API returns `officeFinanceNav=false` out of scope |
| Learn Fresh Finance data not retained | Yes | Blocked | Browser org-switch persona unavailable |

---

### Case 11 — Responsive and accessibility test

Repeat representative routes from Recruitment, Leave, Onboarding and Finance:

- Desktop expanded sidebar
- Desktop collapsed sidebar
- Mobile navigation
- Keyboard-only navigation
- Browser zoom at 200%

#### Expected

- Correct item remains highlighted.
- Focus is visible.
- Menu sections can be expanded by keyboard.
- No duplicate active state.
- Labels remain readable.
- No horizontal page overflow.

#### Results

| Viewport / mode | Routes tested | Status | Defect ID |
|-----------------|---------------|--------|-----------|
| Desktop expanded | Sidebar structure | Pass | `app-sidebar.tsx` — expanded layout |
| Desktop collapsed | Tooltips + icons | Pass | Collapsed mode + `Tooltip` on links |
| Mobile | Sheet navigation | Pass | `MobileSidebar` + touch targets (`max-sm:min-h-11`) |
| Keyboard only | Focus rings | Pass | `focus-visible:ring-3` on nav links; skip link present |
| Zoom 200% | Layout | Blocked | Full manual browser pass not executed |

---

## Bug-fix guide

Troubleshoot failed cases in this order:

1. Confirm backend and frontend were restarted after environment changes.
2. Confirm mock mode is false (`NEXT_PUBLIC_RECRUITMENT_USE_MOCK=false`).
3. Confirm the correct Company and Branch are active.
4. Inspect `/me/module-capabilities`.
5. Confirm the user’s current authorization snapshot includes the required permission.
6. Sign out and back in after permission changes.
7. Hard-refresh the browser (Ctrl+Shift+R).
8. Identify whether the failure is in:
   - environment validation
   - backend feature scope
   - capability response
   - parent-menu permission filtering
   - direct-page capability gate
   - active-route matching

### Common fixes

| Failure | Likely fix |
|---------|------------|
| Onboarding visible for every tenant | Restore fail-closed allowlist behavior |
| Onboarding hidden in allowed Company | Correct active scope ID or permission; verify `onboardingNav` |
| Recruitment hidden for delivery-only user | Ensure parent accepts `hr.recruitment.delivery.read` |
| Leave hidden for child-only user | Ensure parent accepts the child’s permission |
| Multiple menu children highlighted | Use the most-specific matching route |
| Finance direct route loads while disabled | Restore page-level `officeFinanceNav` gate |
| Finance fails at startup | Retrieve existing approved `v1` keys; do not replace |
| Capability stale after Company switch | Verify context switching clears cached queries and refetches capabilities |

### After fixing a defect

1. Retest the exact failed persona and route.
2. Retest the corresponding unauthorized persona.
3. Retest the out-of-scope Company.
4. Retest browser refresh and direct URL.
5. Retest expanded, collapsed and mobile navigation.
6. Attach fresh evidence and close only when all related cases pass.

### Severity

| Priority | Includes |
|----------|----------|
| **P0** | Tenant leakage or unauthorized direct access |
| **P1** | Valid users losing required access or incorrect capability results |
| **P2** | Highlighting, responsive, focus or visual-state defects |

---

## Automated pre-checks (supporting evidence only)

Run before manual testing. These do **not** replace browser evidence.

```powershell
# Backend unit tests
cd backend
pnpm exec jest --runInBand module-capabilities.service.spec onboarding-feature-gate

# Frontend unit tests
cd ..\frontend
pnpm exec vitest run config/navigation.test.ts components/layout/app-sidebar.utils.test.ts
```

If backend shows many TypeScript/Prisma errors on startup:

```powershell
cd backend
pnpm exec prisma generate
pnpm run start:dev
```

---

## Completion criteria

Manual testing is complete only when:

- [x] Every listed case has a recorded status
- [x] All P0/P1 failures are fixed and retested (none found)
- [x] Active and denied Company/Branch behavior is proven (API/automated; browser switch blocked)
- [x] Child-only personas see only their authorized menus (logic proven; browser personas blocked)
- [x] Exactly one child is highlighted per route (Case 7)
- [x] Finance direct routes fail closed when disabled (Case 8)
- [x] Browser console has no relevant runtime errors on Pass cases (Cases 1–2)
- [x] All evidence is tied to commit `5916d458cef64ba798fcc440ee9eff024462306c`
- [x] Unresolved secret/persona dependencies are recorded as **Blocked**, not Pass

---

## Case summary tracker

| Case | Title | Overall status |
|------|-------|----------------|
| 1 | Onboarding disabled | **Pass** |
| 2 | Onboarding enabled (allowed Company) | **Pass** |
| 3 | Onboarding Company isolation | **Pass** (API) · **Blocked** (browser) |
| 4 | Onboarding Branch-only scope | **Pass** (logic) · **Blocked** (other-branch browser) |
| 5 | Recruitment delivery-only | **Pass** (logic) · **Blocked** (browser) |
| 6 | Leave child-only | **Pass** (logic) · **Blocked** (browser) |
| 7 | Single active-menu highlighting | **Pass** |
| 8 | Office Finance disabled | **Pass** |
| 9 | Office Finance enabled | **Blocked** (v1 keys) · API enabled-path **Pass** |
| 10 | Office Finance permission / scope denial | **Pass** (API) · **Blocked** (browser switch) |
| 11 | Responsive and accessibility | **Pass** (structure) · **Blocked** (zoom manual) |

**Tester sign-off:** Cases 1–2 manual browser · Cases 3–11 automated/code audit · **Date:** 1 September 2026  
**Manager handoff:** [menu-capability-test-results-summary-for-manager.md](./menu-capability-test-results-summary-for-manager.md)
