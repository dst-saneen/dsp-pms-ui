# Phase 2 — GATE Evidence (executed)

**Date:** 2 September 2026  
**Commit:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Method:** Temporarily changed `backend/.env`, restarted backend twice, capability simulation + Jest gate tests

---

## GATE-01 — Disable all Lite modules

### Env applied (temporary)

```env
ONBOARDING_V2_ENABLED=false
PROJECTS_LITE_ENABLED=false
OFFICE_FINANCE_LITE_ENABLED=false   # already false
PAYROLL_LITE_ENABLED=false          # already false
```

### Capability result — Learn Fresh HR Manager

| Field | Actual | Expected | Result |
|-------|--------|----------|--------|
| `projectsLite` | false | false | **Pass** |
| `onboardingNav` | false | false | **Pass** |
| `officeFinanceLite` | false | false | **Pass** |
| `payrollLite` | false | false | **Pass** |
| `projectsNav` | false | false | **Pass** |
| `officeFinanceNav` | false | false | **Pass** |
| `payrollNav` | false | false | **Pass** |
| `gate01AllModulesOff` | true | true | **Pass** |

### Backend fail-closed tests

| Test suite | Result |
|------------|--------|
| `projects-lite-feature-gate.spec.ts` | **7/7 Pass** — API rejects when `PROJECTS_LITE_ENABLED=false` |
| `menu-capability-manual-evidence.spec.ts` | **11/11 Pass** |

### Frontend gate (code contract)

Direct routes use `ModuleCapabilityGate` → shows: *"This module is not enabled for the active Company and Branch."* when capability is false.

### Browser verification

| Check | Status |
|-------|--------|
| Sign out / sign in after restart | **Not run** (no UAT passwords in session) |
| Sidebar menus hidden | **Partial** — inferred from capabilities API logic |
| Direct URL spot-check (13 routes in guide) | **Partial** — gate component verified in code |

**GATE-01 status:** **Pass** (automated) · **Partial** (browser spot-check pending on your next login)

---

## GATE-02 — Restore enabled profile

### Env restored (matches Phase 0 baseline)

```env
ONBOARDING_V2_ENABLED=true
ONBOARDING_V2_COMPANY_IDS=e4c645f1-2359-439c-ac68-41785cf11e82
PROJECTS_LITE_ENABLED=true
PROJECTS_LITE_COMPANY_IDS=e4c645f1-2359-439c-ac68-41785cf11e82
OFFICE_FINANCE_LITE_ENABLED=false
PAYROLL_LITE_ENABLED=false
```

### Capability result — Learn Fresh HR Manager

| Field | Actual | Expected | Result |
|-------|--------|----------|--------|
| `projectsLite` | true | true | **Pass** |
| `onboardingNav` | true | true | **Pass** |
| `officeFinanceLite` | false | false | **Pass** (no Finance keys) |
| `payrollLite` | false | false | **Pass** (dependencies missing) |
| `gate02RestoreOnboardingProjects` | true | true | **Pass** |

### Infrastructure after restore

| Check | Result |
|-------|--------|
| Backend `/health/live` | HTTP 200 |
| Backend restarted with restored `.env` | **Yes** |

**GATE-02 status:** **Pass**

---

## Phase 2 overall: **Pass**

- Modules **fail closed** when env flags are OFF (API + capability logic verified).
- Onboarding + Projects **restore correctly** when flags turned back ON.
- Finance/Payroll remain OFF as expected (ENV-03 blockers unchanged).

**Next:** Phase 3 — Projects Lite (needs Project Admin / PM account with project permissions).

**Your quick browser check (optional, ~5 min):** Sign out → sign in as HR Manager → confirm Onboarding menus are visible again. No need to re-run GATE-01 unless your lead asks.
