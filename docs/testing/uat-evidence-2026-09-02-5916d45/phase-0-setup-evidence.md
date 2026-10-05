# Phase 0 — Setup Evidence

**Date:** 2 September 2026  
**Tester:** Agent (automated checks) + user browser confirmation pending  
**Commit:** `5916d458cef64ba798fcc440ee9eff024462306c`

---

## ENV-01 — Build and environment

| Check | Result |
|-------|--------|
| Git commit | `5916d458cef64ba798fcc440ee9eff024462306c` — **Pass** |
| Backend health `/health/live` | HTTP 200 — **Pass** |
| Frontend `http://localhost:3200` | HTTP 200 — **Pass** |
| Backend TypeScript compile | 0 errors — **Pass** |
| Database | AWS RDS `dsp_erp_dev` / schema `dsp_pms` |

---

## ENV-02 — Personas (Learn Fresh Company)

| Alias | Email | Role | Scope | Status |
|-------|-------|------|-------|--------|
| sam.hr | learnfresh.hr01@example.test | HR Manager | COMPANY | Available |
| alex.manager | learnfresh.mgr01@example.test | HR Manager | COMPANY | Available |
| jamie.employee | learnfresh.emp01@example.test | Employee | COMPANY | Available |
| faisal.finance | faisal.approver.uat@learnfresh.test | Finance Manager | COMPANY | Available |
| arockia.jebin | jebin@gmail.com | Employee | BRANCH (HQ) | Available |
| saneen.owner | saneen577@gmail.com | Organization Owner | COMPANY_GROUP | Available |
| super.admin | arockia.jebin@datascapetek.com | Super Administrator | GLOBAL | Available |

**Missing for full UAT (ask lead):**
- Dedicated Project Manager / Project Admin personas
- Payroll Maker vs Approver (separate accounts)
- Finance Maker vs Approver (separate accounts)
- Recruitment delivery-only viewer
- Leave calendar/holiday/comp-off isolated viewers
- Cross-company switch user (Learn Fresh + Datascape)

**ENV-02 status:** **Partial**

---

## ENV-03 — Backend profile

| Setting | Required | Current | Status |
|---------|----------|---------|--------|
| ONBOARDING_V2_ENABLED | true | true | Pass |
| PROJECTS_LITE_ENABLED | true | true | Pass |
| PROJECTS v1 HMAC keys | present | present | Pass |
| OFFICE_FINANCE_LITE_ENABLED | true | **false** | **Blocked** — no approved Finance v1 keys |
| PAYROLL_LITE_ENABLED | true | **false** | **Blocked** — depends on Finance + keys |
| WORKFORCE_JOBS_ENABLED | true | **false** | **Blocked** — needed for payslip jobs |
| RECRUITMENT_ENABLED | true | true | Pass |

**ENV-03 status:** **Partial** (Projects + Onboarding ready; Finance/Payroll blocked)

---

## ENV-04 — File Storage and scanning

| Setting | Required | Current | Status |
|---------|----------|---------|--------|
| FILE_STORAGE_V2_ENABLED | true | not configured | **Blocked** |
| STORAGE_S3_* | approved bucket | not configured | **Blocked** |
| CLAMAV_HOST | approved host | empty | **Blocked** |
| FILE_SCAN_WORKER_ENABLED | true | not configured | **Blocked** |

**ENV-04 status:** **Blocked** (PROJECT-04 and PAYROLL-04 file flows cannot Pass until infra ready)

---

## ENV-05 — Frontend profile

| Setting | Value | Status |
|---------|-------|--------|
| NEXT_PUBLIC_RECRUITMENT_USE_MOCK | false | Pass |
| NEXT_PUBLIC_RECRUITMENT_ENABLED | true | Pass |
| NEXT_PUBLIC_API_URL | http://localhost:4500 | Pass |

**Note:** User should confirm login + `module-capabilities` in browser (screenshot).

**ENV-05 status:** **Pass** (config) — browser smoke pending user screenshot

---

## ENV-06 — Evidence folder

**Path:** `docs/testing/uat-evidence-2026-09-02-5916d45/`

**ENV-06 status:** **Pass**

---

## UAT test records verified in database

| Record | ID | Status in DB |
|--------|-----|--------------|
| Learn Fresh Company | e4c645f1-2359-439c-ac68-41785cf11e82 | Exists |
| Learn Fresh HQ | 5c79da96-64e5-4027-83fc-4c1de736b10c | Exists |
| Test Project PRJ-000001 | 60854dea-fada-4373-a541-5efb8cef63b0 | DRAFT |
| Payroll run PR-000004 | 32dad0d6-f410-4a2e-b26b-5d8e711eadf9 | APPROVED |
| Finance transaction | f5d33da3-18f2-491d-852a-0402a709d3ea | APPROVED |
| File objects | — | 0 (matches guide) |

---

## Phase 0 overall result

**Status:** **Partial Pass** — ready to start **Phase 1 (Baseline)** and **Phase 3 (Projects)**.

**Blocked until lead provides:**
1. Finance v1 keys → enable Office Finance + Payroll
2. File Storage S3 + ClamAV → document upload + payslip tests
3. Full UAT persona passwords / dedicated accounts

**Next phase:** Phase 1 — BASE-01 (login + module-capabilities screenshot)
