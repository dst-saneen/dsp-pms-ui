# Menu Capability Testing — Beginner Guide

**For:** Manual testers new to this project  
**Test commit:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Full test checklist:** [menu-capability-manual-testing-and-bug-fix-guide-2026-09-01.md](./menu-capability-manual-testing-and-bug-fix-guide-2026-09-01.md)

---

## 1. What are you testing? (Plain English)

You are **not** testing every page in the app. You are testing **who sees which menu items** and **what happens when someone opens a URL directly**.

Think of the app like a building with locked doors:

| Layer | What it does | Example |
|-------|----------------|---------|
| **Feature flag (backend)** | Is this module turned on for this Company/Branch? | Onboarding only for “Learn Fresh Company” |
| **Permission (user role)** | Does this user have the key? | HR Manager vs normal Employee |
| **Menu (sidebar)** | Show or hide menu links | “Employee Onboarding” hidden when module off |
| **Page gate (direct URL)** | Block the page even if someone types the URL | `/hr/employee-onboarding` shows “module not enabled” |

Your manager wants proof that all four layers work together — especially that **wrong company data never leaks** and **only one menu item is highlighted** at a time.

---

## 2. Key ideas in 5 minutes

### Sidebar menu

After login, the left sidebar lists modules: Human Resources, Office Finance, My Workspace, etc.  
Some items have **children** (sub-menus), e.g. Recruitment → Delivery, Leave → Calendar.

### Module capabilities API

The frontend calls:

```http
GET /me/module-capabilities
```

The backend returns booleans like:

- `onboardingNav` — show onboarding menus?
- `officeFinanceNav` — show Office Finance?
- `officeFinanceLite` — is Finance enabled for this company?

**Always check this API** when a menu looks wrong.

### Mock mode OFF

Your frontend must have:

```env
NEXT_PUBLIC_RECRUITMENT_USE_MOCK=false
```

Mock mode uses fake data. This test uses the **real backend**.

### Organization switcher

Users can switch **Company** and **Branch** (top of app). When they switch:

- Menus should update **immediately**
- Old company’s data must **disappear**
- Capabilities API must **refetch**

---

## 3. Test tenant (memorize these names)

| Name | ID | Role in tests |
|------|-----|----------------|
| **Learn Fresh Company 01** | `e4c645f1-2359-439c-ac68-41785cf11e82` | Allowed company — onboarding & finance should work when enabled |
| **Learn Fresh HQ 01** | `5c79da96-64e5-4027-83fc-4c1de736b10c` | Allowed branch |
| **Datascape Technology Kowdiar** (out of scope) | Company: `eadf7f5f-1669-4e90-9f32-0a1040e7cebf` | Onboarding/Finance should **not** appear |

Finance transaction for detail-route tests:

`f5d33da3-18f2-491d-852a-0402a709d3ea`

---

## 4. Test users (personas)

Use **dedicated UAT accounts**, not real employees. After changing permissions: **sign out → sign in again**.

| Persona | What they prove |
|---------|-----------------|
| HR Manager | Sees HR onboarding menus when enabled |
| Finance Manager | Sees Office Finance when enabled |
| Employee (`hr.self.read`) | Sees My Workspace → Onboarding only for self |
| Recruitment Delivery Viewer | Has `hr.recruitment.delivery.read` only — sees Delivery, not Dashboard/Openings/etc. |
| Leave Calendar Viewer | Has `hr.calendar.read` only — sees Leave → Calendar |
| Holiday Viewer | Has `hr.holidays.read` only |
| Comp-off Viewer | Has `hr.comp-off.read` only |
| Unauthorized Employee | No HR/Finance — menus hidden, direct URLs blocked |
| Org switcher user | Can switch Learn Fresh ↔ out-of-scope company |

Ask your team lead for UAT login emails/passwords. **Do not put passwords in test documents.**

---

## 5. Before you start — setup checklist

### Step A: Confirm code version

```powershell
cd "d:\app shell\dsp-pms-app"
git log -1 --oneline
```

You should be on or include commit `5916d458`. If not, checkout that commit or merge the branch that contains it.

### Step B: Fix backend if it shows TypeScript errors

If `pnpm run start:dev` shows hundreds of Prisma/type errors:

```powershell
cd backend
pnpm exec prisma generate
pnpm run start:dev
```

### Step C: Backend `.env` (recommended test profile)

Edit `backend/.env` (never commit secrets). For most onboarding/recruitment tests:

```env
RECRUITMENT_ENABLED=true
PUBLIC_CAREERS_ENABLED=true

ONBOARDING_V2_ENABLED=true
ONBOARDING_V2_COMPANY_IDS=e4c645f1-2359-439c-ac68-41785cf11e82
ONBOARDING_V2_BRANCH_IDS=
ONBOARDING_REMINDERS_ENABLED=false

OFFICE_FINANCE_LITE_ENABLED=true
OFFICE_FINANCE_LITE_COMPANY_IDS=e4c645f1-2359-439c-ac68-41785cf11e82
PAYROLL_LITE_ENABLED=false
```

**Finance keys:** The database already has Finance data encrypted with **existing v1 keys**. Get `FINANCE_IDEMPOTENCY_HMAC_KEYS_JSON` and `FINANCE_BANK_REFERENCE_ENC_KEYS_JSON` from your **approved secret store**. Do **not** generate new v1 keys. If keys are unavailable, set `OFFICE_FINANCE_LITE_ENABLED=false` and mark Finance test cases as **Blocked**.

Restart backend after any `.env` change.

### Step D: Frontend `.env`

```env
BACKEND_INTERNAL_URL=http://localhost:4500
# Recruitment availability is returned by backend capability APIs.
NEXT_PUBLIC_RECRUITMENT_USE_MOCK=false
```

Restart frontend after changes (`pnpm run dev` in `frontend/`).

### Step E: Smoke check

1. Open `http://localhost:3200`
2. Log in as HR Manager
3. Select **Learn Fresh Company 01 / Learn Fresh HQ 01**
4. Open DevTools → Network → find `GET /me/module-capabilities`
5. Confirm response is JSON (not 500 error)

---

## 6. How to run one test (template)

For every test case in the main guide:

1. **Set environment** (if the case says to disable onboarding, change `.env` and restart backend).
2. **Log in** as the correct persona.
3. **Select company/branch** stated in the case.
4. **Do the steps** (click menus, open URLs, switch company).
5. **Compare** what you see vs “Expected”.
6. **Collect evidence:**
   - Screenshot (name it clearly, e.g. `TC2-onboarding-hr-manager.png`)
   - Network tab: `/me/module-capabilities` response
   - Console tab: note errors (should be none for Pass)
7. **Fill the results table** in the main guide: Status, date, actual result, defect ID if Fail.

Status values: `Not Run` | `Pass` | `Fail` | `Blocked`

---

## 7. Recommended test order (step by step)

Do cases in this order — later cases build on earlier ones.

| Order | Case | Why first |
|-------|------|-----------|
| 1 | **Case 1** — Onboarding disabled | Baseline: menus hidden, direct URLs blocked |
| 2 | **Case 2** — Onboarding enabled | Turn feature on; confirm menus appear |
| 3 | **Case 3** — Company isolation | Switch company; menus must disappear |
| 4 | **Case 4** — Branch-only scope | Advanced scope rule |
| 5 | **Case 5** — Recruitment delivery-only | Parent menu with one child |
| 6 | **Case 6** — Leave child-only | Same pattern for Leave |
| 7 | **Case 7** — Single menu highlight | Visual: only one `aria-current="page"` |
| 8 | **Case 8** — Finance disabled | Finance off; direct routes blocked |
| 9 | **Case 9** — Finance enabled | Needs v1 keys from secret store |
| 10 | **Case 10** — Finance permission denial | Unauthorized user + company switch |
| 11 | **Case 11** — Responsive / a11y | Desktop, collapsed sidebar, mobile |

---

## 8. How to check menu highlighting (Case 7)

1. Navigate to e.g. `/hr/recruitment/delivery`
2. Open DevTools → Elements
3. Search for `aria-current="page"`
4. **Only one** menu link should have it (the “Delivery” child)
5. Parent “Recruitment” may be expanded but must **not** also be highlighted as current page
6. Refresh the page — highlight should stay correct

Routes to verify:

- `/hr/recruitment/delivery`
- `/hr/leave/calendar`
- `/hr/leave/holidays`
- `/hr/leave/comp-off`
- `/office-finance/transactions`
- `/office-finance/transactions/f5d33da3-18f2-491d-852a-0402a709d3ea`
- `/my-workspace/onboarding`

---

## 9. When something fails — quick fixes

| Symptom | First checks |
|---------|----------------|
| Menu should show but doesn’t | Restart backend; check company ID in allowlist; check `/me/module-capabilities` |
| Menu shows for every company | Bug — fail-closed allowlist broken; report P0 |
| Direct URL shows data when module off | Bug — page gate missing; report P0 |
| Old company data after switch | Hard refresh; check capabilities refetch; report P0 if data leaks |
| Two menu items highlighted | Bug in route matching; report P2 |
| Backend won’t start with Finance on | Use **existing** v1 keys from secret store — never replace |
| Permission change had no effect | Sign out and sign in again |

Full troubleshooting: see **Bug-fix guide** section in the main testing document.

---

## 10. Priority when reporting bugs

| Priority | Meaning | Examples |
|----------|---------|----------|
| **P0** | Security / data leak | Wrong company data visible; unauthorized direct URL access |
| **P1** | Wrong access for valid users | HR Manager can’t see onboarding when enabled; wrong capability flags |
| **P2** | UI polish | Double highlight, focus, mobile layout |

---

## 11. You are done when

- Every case in the main guide has a status (not left as `Not Run` unless Blocked with reason)
- All P0/P1 failures are fixed and retested
- Evidence includes commit hash `5916d458cef64ba798fcc440ee9eff024462306c`
- Finance cases marked **Blocked** if v1 secrets unavailable (not marked Pass)

---

## 12. Where the code lives (optional reading)

| Area | File |
|------|------|
| Backend capability logic | `backend/src/modules/module-capabilities/module-capabilities.service.ts` |
| Onboarding scope | `backend/src/modules/onboarding-v2/services/onboarding-feature-gate.service.ts` |
| Menu definitions | `frontend/config/navigation.ts` |
| Sidebar filtering | `frontend/components/layout/app-sidebar.tsx` |
| Direct URL blocking | `frontend/components/common/module-capability-gate.tsx` |
| Active route highlight | `frontend/components/layout/app-sidebar.utils.ts` |

You do **not** need to change code to run manual tests — only if you find a bug and your lead asks you to fix it.
