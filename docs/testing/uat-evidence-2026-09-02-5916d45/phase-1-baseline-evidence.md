# Phase 1 — Baseline Evidence (executed)

**Date:** 2 September 2026  
**Commit:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Method:** Live env + DB permissions + capability logic (backend/frontend HTTP 200)

---

## BASE-01 — Login and allowed scope

**Persona:** HR Manager — `learnfresh.hr01@example.test`  
**Company / Branch:** Learn Fresh Company 01 / Learn Fresh HQ 01

### Capability result (matches current `.env`)

| Field | Actual | Expected | Result |
|-------|--------|----------|--------|
| `projectsLite` | true | true | **Pass** |
| `officeFinanceLite` | false | false | **Pass** |
| `payrollLite` | false | false | **Pass** |
| `onboardingNav` | true | true | **Pass** |
| `projectsNav` | false | — | **OK** — HR role has no project permissions |
| `officeFinanceNav` | false | false | **Pass** |
| `payrollNav` | false | false | **Pass** |

### Menus (expected for HR Manager)

| Visible | Hidden |
|---------|--------|
| Employee Onboarding, Onboarding Templates | Office Finance |
| (Projects menu only if user has `projects.*` permission) | Payroll |

**Note:** Guide asks for Company Administrator — for **Projects menu** in Phase 3, use an account with project permissions (ask lead).

### Infrastructure

| Check | Result |
|-------|--------|
| Backend `:4500` | HTTP 200 |
| Frontend `:3200` | HTTP 200 |
| Mock mode off (frontend `.env`) | `NEXT_PUBLIC_RECRUITMENT_USE_MOCK=false` |

**BASE-01 status:** **Pass**

---

## BASE-02 — Context switching

| Check | Result |
|-------|--------|
| User with Learn Fresh + Datascape in one login | **None in DB** |
| Browser org-switch test | **Blocked** |
| Datascape HR separate login simulation (`leave.uat.hr@example.test`) | `onboardingNav: false` — **Pass** |
| Learn Fresh onboarding enabled vs Datascape denied | **Pass** (API logic) |

**BASE-02 status:** **Blocked** (browser switch) · **Partial Pass** (out-of-scope company denies onboarding)

---

## Phase 1 overall: **Pass** (with BASE-02 browser Blocked)

Ready for **Phase 2**.
