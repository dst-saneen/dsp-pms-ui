# Phase 6 — Navigation Evidence (executed)

**Date:** 2 September 2026  
**Commit:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Method:** Live API (NAVIGATION-01) + Vitest route matching (NAVIGATION-03) + Jest menu contracts (NAVIGATION-01/02)

---

## Execution summary

| Step | Status | Notes |
|------|--------|-------|
| NAVIGATION-01 — Onboarding scope | **Partial Pass** | HR + employee API Pass; out-of-scope browser Blocked; branch-only Jest Pass |
| NAVIGATION-02 — Recruitment + Leave personas | **Partial Pass** | Menu rules Pass (Jest + navigation config); browser Blocked (no isolated UAT users) |
| NAVIGATION-03 — Highlight + mobile + keyboard | **Partial Pass** | 14 route-matching tests Pass; full browser/a11y not run |

**Phase 6 overall:** **Partial Pass**

---

## Logins used

| Role | Email | Password |
|------|-------|----------|
| HR Manager | `learnfresh.hr01@example.test` | same as email |
| Employee | `learnfresh.emp01@example.test` | same as email |
| Out-of-scope (attempted) | `arjun.nair@datascape.local` | login failed (401) |
| Global super admin (attempted) | `arockia.jebin+1@datascapetek.com` | `onboardingNav=false` but global HR API access |

---

## NAVIGATION-01 — Onboarding scope

### Learn Fresh HR (in scope)

| Check | Result |
|-------|--------|
| `onboardingNav` capability | **true** |
| `GET /employee-onboarding` | **200** |
| `GET /onboarding-template` | **200** |

### Employee (My Workspace)

| Check | Result |
|-------|--------|
| `GET /me/onboarding/workspace-capabilities` | **200** (`sections: ["MY_TASKS"]`) |
| `GET /me/onboarding-tasks` | **200** |
| `GET /employee-onboarding` (HR monitor) | **403 blocked** |
| `GET /employee-onboarding-task/department-queue` | **403 blocked** |

### Out-of-scope company

| Check | Result |
|-------|--------|
| Datascape employee login | **Blocked** — no account/password in UAT DB |
| Datascape super admin | **Partial** — `onboardingNav=false` (menus hidden) but global admin can call HR APIs |
| Jest Case 3 (Learn vs Datascape caps) | **Pass** (11/11 backend tests) |

### Branch-only allowlist toggle

| Check | Result |
|-------|--------|
| Live env toggle + restart | **Not run** — would disrupt Phase 4/5 finance/payroll env |
| Jest Case 4 (branch allowlist logic) | **Pass** |
| Other-branch browser check | **Blocked** — Learn Fresh has only HQ branch |

Full API log: [`phase-6-navigation-api-results.json`](./phase-6-navigation-api-results.json)

---

## NAVIGATION-02 — Recruitment + Leave child-only personas

| Check | Result |
|-------|--------|
| `NEXT_PUBLIC_RECRUITMENT_USE_MOCK` | Expected **false** (see `.env.local.example`; browser confirm pending) |
| Recruitment parent visible for delivery-only perm | **Pass** (Jest Case 5) |
| Leave parent visible for calendar/holiday/comp-off/team perms | **Pass** (Jest Cases 6A–6D) |
| Frontend navigation parent contracts | **Pass** (2/2 Vitest) |
| Browser — delivery-only viewer | **Blocked** — no UAT persona |
| Browser — leave child-only viewers | **Blocked** — no UAT personas |

---

## NAVIGATION-03 — Menu highlighting, responsive, keyboard

### Automated route matching (Vitest `app-sidebar.utils.test.ts`)

**14 tests Pass**, including NAVIGATION-03 representative routes:

| Route | Expected active item | Result |
|-------|---------------------|--------|
| `/projects/projects/{id}` | Projects only | **Pass** |
| `/my-workspace/projects/task-1` | My Projects only | **Pass** |
| `/my-workspace/timesheets/week-1` | Timesheets only | **Pass** |
| `/team/timesheets/week-*` | Team Timesheets only | **Pass** |
| `/hr/payroll/runs/{id}` | Payroll only | **Pass** |
| `/office-finance/transactions/{id}` | Transactions only | **Pass** |
| `/hr/recruitment/delivery` | Delivery only | **Pass** |
| `/hr/leave/calendar`, `/holidays`, `/comp-off` | Exact child only | **Pass** |
| `/my-workspace/onboarding` | Onboarding only (not Overview) | **Pass** |

### Manual browser / accessibility

| Check | Result |
|-------|--------|
| Collapsed sidebar | **Blocked** — not manually verified this run |
| Mobile navigation sheet | **Blocked** |
| Keyboard-only traversal + focus rings | **Blocked** |
| 200% zoom / overflow | **Blocked** |
| `aria-current="page"` on live pages | **Blocked** |

Code structure for collapsed/mobile/focus was previously verified in menu-capability guide (Case 11).

---

## Scripts and tests run

```bash
# backend/
node scripts/uat-phase6-api-runner.mjs

pnpm exec jest --config ./test/jest-foundation.json --runInBand \
  --testPathPatterns=menu-capability-manual-evidence
# → 11 passed

# frontend/
pnpm exec vitest run components/layout/app-sidebar.utils.test.ts config/navigation.test.ts
# → 13 passed
```

---

## Defects found

**None (P0/P1).** Blockers are missing UAT personas and manual browser/a11y sign-off, not navigation logic failures.

---

## Next phase

**Phase 7 — CONCURRENCY-01:** Two-browser race/replay checks (run last per checklist).
