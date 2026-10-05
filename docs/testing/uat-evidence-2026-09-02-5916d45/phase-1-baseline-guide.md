# Phase 1 — Baseline Evidence

**Date:** 2 September 2026  
**Commit:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Company:** Learn Fresh Company 01 / Learn Fresh HQ 01

---

## What Phase 1 tests (simple)

**Question:** “When I log in to the **correct company**, does the app show the **right menus** and does the backend agree?”

No creating projects or expenses yet — just **login + look + API check**.

---

## BASE-01 — Login and allowed scope

### Steps you do in browser

1. Open `http://localhost:3200`
2. Log in as **HR Manager** (`learnfresh.hr01@example.test`)  
   *(Guide says Company Admin — HR Manager works if they have admin-like menus)*
3. Top bar → select **Learn Fresh Company 01** and **Learn Fresh HQ 01**
4. Press **Ctrl+Shift+R** (hard refresh)
5. Press **F12** → **Network** tab → refresh once
6. Click request **`module-capabilities`**
7. Screenshot the **Response** tab → save as `BASE-01-module-capabilities.png`

### Menus you should SEE (current env)

| Menu area | Visible? | Why |
|-----------|----------|-----|
| Human Resources → Onboarding | **Yes** | Onboarding ON for Learn Fresh |
| Project Management → Projects | **Yes** | Projects Lite ON |
| My Workspace → Projects / Timesheets | **Yes** | If user has project permissions |
| Office Finance | **No** | Finance OFF in `.env` |
| HR → Payroll | **No** | Payroll OFF in `.env` |

### Expected `module-capabilities` (current env)

```json
{
  "projectsLite": true,
  "officeFinanceLite": false,
  "payrollLite": false,
  "onboardingNav": true,
  "projectsNav": true or false,
  "officeFinanceNav": false,
  "payrollNav": false
}
```

- `onboardingNav: true` — only if user has onboarding permission (HR Manager should)
- No passwords or keys in the response
- Console should have **no red errors**

### BASE-01 checklist

| Check | Pass? | Your note |
|-------|-------|-----------|
| Login works | | |
| Learn Fresh company selected | | |
| `module-capabilities` returns JSON | | |
| `projectsLite: true` | | |
| `officeFinanceLite: false` | | |
| `payrollLite: false` | | |
| Onboarding menus visible | | |
| Finance/Payroll menus hidden | | |
| Screenshot saved | | |

**BASE-01 status:** _Fill after browser run_

---

## BASE-02 — Context switching

### What it tests

When you **change company**, menus for Learn Fresh modules should **disappear immediately** without refresh.

### Problem we already know

No single user has **both** Learn Fresh and Datascape in the database.

### What you CAN do

**Option A — Blocked (honest):** Mark BASE-02 **Blocked** — no cross-company switch persona.

**Option B — Partial test:** Log in as **Datascape user** separately (e.g. `leave.uat.hr@example.test` if you have password):
- Onboarding menus should **not** appear
- Open `/hr/employee-onboarding` directly → blocked message

### Steps if you have Datascape login

1. Login as Datascape HR user (separate session)
2. Confirm **no** Employee Onboarding in sidebar
3. Open `/hr/employee-onboarding` → “module is not enabled”
4. Check `module-capabilities` → `onboardingNav: false`

### BASE-02 status

| Check | Result |
|-------|--------|
| Browser org-switch (Learn Fresh → Datascape) | **Blocked** — no multi-company user |
| Out-of-scope direct URL blocked | Test with Datascape login if password available |

---

## Phase 1 overall

| Step | Expected status |
|------|-----------------|
| BASE-01 | **Pass** (after your browser run) |
| BASE-02 | **Blocked** or **Partial** |

**Next after Phase 1:** Phase 2 — turn all modules OFF and confirm everything blocked (GATE-01).
