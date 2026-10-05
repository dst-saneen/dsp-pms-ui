# Menu Capability Testing — Results Summary (For Manager)

**Tester:** Manual browser (Cases 1–2) + automated/code verification (Cases 3–11)  
**Date:** 1 September 2026  
**Commit tested:** `5916d458cef64ba798fcc440ee9eff024462306c`  
**Full checklist:** [menu-capability-manual-testing-and-bug-fix-guide-2026-09-01.md](./menu-capability-manual-testing-and-bug-fix-guide-2026-09-01.md)

---

## One-line summary

Menu capability changes **work correctly** for onboarding, recruitment/leave menu rules, menu highlighting, and finance blocking. **No P0 or P1 bugs found.** Some cases are **Blocked** because the shared UAT database is missing special test users, a second branch, or Finance v1 secrets — not because the code failed.

---

## What each phase tested (simple)

### Phase 0 — Setup

**What we checked:** Can the app start and talk to the backend?

**Result:** **Pass**

- Backend runs on port 4500
- Frontend runs on port 3200
- Login works
- `GET /me/module-capabilities` returns JSON

---

### Phase 1 — Onboarding (Cases 1–4)

**What we checked:** Does Employee Onboarding show/hide correctly based on settings and company?

| Case | What it means | Result |
|------|---------------|--------|
| **1** | Onboarding **OFF** → menus hidden, direct URLs blocked | **Pass** (browser) |
| **2** | Onboarding **ON** for Learn Fresh → menus appear, pages load | **Pass** (browser) |
| **3** | Switch to another company → onboarding disappears | **Pass** (backend logic) · **Blocked** (browser — no user has both test companies) |
| **4** | Branch-only allowlist → only allowed branch gets onboarding | **Pass** (automated) · **Blocked** (other-branch browser — Learn Fresh has only 1 branch) |

**Found:** No bugs. Learn Fresh and Datascape are in **different org groups**, so no existing login can switch between them for a live demo.

---

### Phase 2 — Recruitment & Leave menus (Cases 5–6)

**What we checked:** If a user has permission for **one sub-menu only**, do they see the **parent** but **not** sibling items?

| Case | What it means | Result |
|------|---------------|--------|
| **5** | Delivery-only user sees Recruitment → Delivery only | **Pass** (menu rules verified in code/tests) · **Blocked** (browser — no delivery-only UAT user in DB) |
| **6** | Calendar / Holidays / Comp-off / Team viewers see only their Leave child | **Pass** (menu rules verified) · **Blocked** (browser — no isolated UAT users) |

**Found:** Navigation config and permission filtering match the spec. No code defect.

---

### Phase 3 — Menu highlighting (Case 7)

**What we checked:** On each page, is **only one** sidebar item highlighted (not two at once)?

**Routes tested (automated):**

- `/hr/recruitment/delivery` → Delivery only
- `/hr/leave/calendar`, `/holidays`, `/comp-off` → correct child only
- `/office-finance/transactions` and transaction detail → Transactions only
- `/my-workspace/onboarding` → Onboarding only (not Overview)

**Result:** **Pass** (11 automated route-matching tests)

**Found:** Most-specific route wins — parent landing page is not highlighted when you are on a child URL.

---

### Phase 4 — Office Finance (Cases 8–10)

**What we checked:** When Finance is off (or user lacks permission), is the menu hidden and are direct URLs blocked?

| Case | What it means | Result |
|------|---------------|--------|
| **8** | Finance **disabled** → no sidebar, all `/office-finance/*` routes blocked | **Pass** (API + all 5 pages use `ModuleCapabilityGate`) |
| **9** | Finance **enabled** → pages load, transaction detail works | **Blocked** — approved Finance v1 keys not available locally |
| **10** | Unauthorized user + company switch → Finance blocked | **Pass** (API logic) · **Blocked** (browser switch — same as Case 3) |

**Found:** Fail-closed behavior is implemented. Finance enabled testing deferred until secret store keys are provided.

---

### Phase 5 — Responsive & accessibility (Case 11)

**What we checked:** Sidebar works on desktop, collapsed mode, mobile; keyboard focus visible.

**Result:** **Pass** (code structure) · **Blocked** (full manual a11y sign-off not run)

**Verified in code:**

- Collapsed sidebar + tooltips
- Mobile sheet navigation
- `focus-visible` rings on menu links
- Skip-to-main-content link
- Mobile touch target sizes (`max-sm:min-h-11`)

**Not done:** Full keyboard-only walkthrough and 200% zoom browser pass (needs QA time).

---

## Overall scorecard

| Case | Title | Status |
|------|-------|--------|
| 1 | Onboarding disabled | **Pass** |
| 2 | Onboarding enabled | **Pass** |
| 3 | Company isolation | **Pass** (logic) / **Blocked** (browser) |
| 4 | Branch-only scope | **Pass** (logic) / **Blocked** (other branch) |
| 5 | Recruitment delivery-only | **Pass** (logic) / **Blocked** (browser) |
| 6 | Leave child-only | **Pass** (logic) / **Blocked** (browser) |
| 7 | Single menu highlight | **Pass** |
| 8 | Finance disabled | **Pass** |
| 9 | Finance enabled | **Blocked** (v1 keys) |
| 10 | Finance permission denial | **Pass** (logic) / **Blocked** (browser) |
| 11 | Responsive / a11y | **Pass** (structure) / **Blocked** (full manual) |

**P0 defects:** 0  
**P1 defects:** 0  
**P2 defects:** 0 (not fully signed off for a11y)

---

## Blockers (for manager — not code bugs)

| Blocker | What is needed |
|---------|----------------|
| Case 3 / 10 browser | UAT user with access to **both** Learn Fresh and Datascape, or two companies in same org group |
| Case 4 browser | Second branch under Learn Fresh Company |
| Cases 5–6 browser | Dedicated UAT users: delivery-only, calendar-only, holiday-only, comp-off-only |
| Cases 9–10 Finance enabled | Existing approved `FINANCE_*_v1` keys from secret store (do not generate new keys) |
| Case 11 full sign-off | QA time for keyboard, mobile, and 200% zoom manual pass |

---

## Automated test evidence

```text
backend/test/foundation/menu-capability-manual-evidence.spec.ts  → 11/11 Pass
frontend/components/layout/app-sidebar.utils.test.ts           → 8/8 Pass
frontend/config/navigation.test.ts                             → 2/2 Pass
```

Run again:

```powershell
cd backend
pnpm exec jest --config ./test/jest-foundation.json --runInBand menu-capability-manual-evidence

cd ..\frontend
pnpm exec vitest run components/layout/app-sidebar.utils.test.ts config/navigation.test.ts
```

---

## Recommended manager decision

**Approve menu capability changes for commit `5916d458`** from a technical standpoint, with follow-up:

1. Provision UAT personas for blocked browser cases before production sign-off.
2. Add Finance v1 keys for Case 9 retest when available.
3. Schedule short QA pass for Case 11 responsive/a11y.

---

## What to say in standup (30 seconds)

> “Completed menu capability testing on commit 5916d458. Onboarding on/off works in browser. Menu rules, highlighting, and finance blocking verified by automated tests — no P0/P1 issues. Browser cases for org-switch and special personas are blocked by missing UAT users and Finance keys, not by failures. Full checklist is in `docs/testing/menu-capability-manual-testing-and-bug-fix-guide-2026-09-01.md`.”
