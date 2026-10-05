# Wave 5 — Exit record (Phase K)

Engineering exit gate for Waves **3–5** (Phases G–J), executed **2026-09-15**.  
Builds on Wave 2 freeze identity; W3–W5 product changes were verified in the working tree (not yet a single follow-on commit at gate time).

**Sources:** `docs/development/wave-2-to-wave-5-execution-plan.md`, `docs/development/wave-2-freeze-record.md`

---

## Identity

| Field | Value |
|---|---|
| Branch | `UI-SA-140926-3` |
| Wave 2 freeze SHA | `93eeeb126d5b1a0137dbeb88d58731d602cfe8ca` (`wave2-uat-freeze`) |
| Docs-only HEAD at gate start | `2267d7505d7e7bd303ff38434d91ff4a720d22ac` (Phase F evidence) |
| W3–W5 product SHA | **Pending commit** — working tree contains Phases G–J (AUTH/ORG/DASH/MY/ADM/SEC). After commit, record full SHA here and optionally tag `wave5-engineering-exit`. |
| Exit date (local) | 2026-09-15 |
| Filled by | Engineering (Phase K) |

### After commit (manager / follow-up)

```powershell
git rev-parse HEAD
git tag -a wave5-engineering-exit -m "Wave 5 engineering exit (W3-W5)"
# Then replace “Pending commit” above with the tagged SHA.
```

---

## Environment smoke (this session)

| Check | Result |
|---|---|
| `GET http://localhost:4500/health/ready` | **200** — `database: up`, `redis: skipped`, `objectStorage: up`, `clamav: skipped` |
| `GET http://localhost:4500/health/live` | **200** |
| `GET http://localhost:3200/login` | **200** |
| Frontend `tsc --noEmit` | **Pass** |
| Backend `tsc -p tsconfig.build.json --noEmit` | **Pass** |
| `vitest run lib/auth-next-path.test.ts` | **5/5 Pass** |
| Isolated ENV-001 / multi-persona browser | **Not run** (same pragmatism as Phase F) |

---

## Phase map covered

| Phase | Excel / plan IDs | Engineering status |
|---|---|---|
| F | DES-07 + freeze | Conditional Pass (prior) |
| G | AUTH-01, ORG-01…04 | Code done + checklist below |
| H | DASH-01/02, MY-01/02 | Code done + checklist below |
| I | ADM-01…04 | Code done + checklist below |
| J | SEC-01…03 | Code done + checklist below |
| K | Exit evidence | **This document** |

---

## AUTH-01 — Redirect matrix

| Scenario | Expected | Evidence |
|---|---|---|
| Empty / missing `next` | `/dashboard` | Unit: `resolveSafeNextPath(null)` → default |
| External absolute URL | Reject → `/dashboard` | Unit: `https://evil…` |
| Protocol-relative `//…` | Reject → `/dashboard` | Unit |
| Auth routes (`/login`, `/register`, …) | Reject → `/dashboard` | Unit + `BLOCKED_NEXT_PREFIXES` |
| Internal path + query | Preserved | Unit: `/hr/employees?tab=active` |
| sessionStorage remember → consume once | Path returned then cleared | Unit: `rememberAuthNext` / `consumePostAuthDestination` |
| Wired into login / change-password / AuthenticatedApp | Post-auth lands on safe `next` | Code: `frontend/lib/auth-next-path.ts`, login card, change-password, `authenticated-app.tsx` |

**Result:** **Pass (engineering / unit).** Browser click-through of full login→deep-link matrix: **pending manager**.

---

## ORG-01…04 — Org setup resume

| Check | Evidence | Result |
|---|---|---|
| Hub copy / level guide | Onboarding hub summary + required/optional sections | Code path Pass |
| Server `currentStep` sync | `organization-onboarding.service` updateStep + progress sync | Code path Pass |
| Create preflight / complete → session refresh | Complete flow refreshes session + capabilities then `consumePostAuthDestination()` | Code path Pass |
| Owner employee link states | `ownerEmployeeLink` + `POST …/repair-owner-employee` | Code path Pass |
| Mid-step failure resume | Step persisted server-side; hub resumes from `currentStep` | Engineering note Pass (forced mid-step browser fail: pending) |

**Result:** **Pass (engineering).** Forced mid-step browser failure UAT: **pending**.

---

## DASH-01 / DASH-02 — Dashboard honesty + links

| Check | Evidence | Result |
|---|---|---|
| Per-widget states `ok \| empty \| not_enabled \| not_authorized \| error` | `manager-dashboard/types.ts`, `dashboard-widget-shell.tsx`, data-provider | Code path Pass |
| Empty ≠ error | Types comment + shell rendering | Code path Pass |
| KPI / deep links | Widget CTAs + team timesheets `?status=` | Code path Pass |
| Persona hide when not authorized / not enabled | Shell + provider | Code path Pass |

**Result:** **Pass (engineering).** Screenshot UAT: **pending manager**.

---

## MY-01 / MY-02 — My Workspace

| Check | Evidence | Result |
|---|---|---|
| Slim Overview (Today + urgent + quick links) | `my-workspace.tsx` | Code path Pass |
| Owner link AWAITING_SETUP / NEEDS_REPAIR | Link status + repair CTA for owners only | Code path Pass |
| No fake repair for non-owners | Conditional repair UI | Code path Pass |

**Result:** **Pass (engineering).**

---

## ADM-01…04 — Admin masters smoke (DES-style)

| Route | Expect | Engineering check |
|---|---|---|
| Structure readiness panel | Group → Company → Branch → Department → Designation → Shift → Calendar | **Pass** — `AdminStructureReadiness` on company/branch/department/designation lists |
| `/administration/companies/new` + `[id]/edit` | Full page; cancel/unsaved; list navigates | **Pass** — routes + `CompanyEditor` |
| `/administration/branches/new` + `[id]/edit` | Full page; working-days post-create | **Pass** — `branchWorkingDaysHref` / `?workingDays=` |
| `/administration/departments/new` + `[id]/edit` | Company then Branch; company change clears branch | **Pass** — form reset + pages |
| Create/edit drawers removed from lists | Workspace uses `router.push` | **Pass** — dialogs unused by workspaces |

**Browser click-through:** pending manager (same pattern as DES-07).

---

## SEC-01…03 — Users / Roles / access summary

| Route / check | Expect | Engineering check |
|---|---|---|
| `/administration/security/new` + `[id]/edit` | Searchable permissions; system roles blocked | **Pass** — `RoleEditor` + `PermissionPicker` |
| Clone / activate on list | Stay on list (not full-page) | **Pass** — `SecurityRolesWorkspace` |
| `/administration/users/new` | Invite page + assignment editor + summary | **Pass** — `UserInviteEditor` |
| `/administration/users/[id]/access` | Access edit; `security.roles.manage` | **Pass** — gate matches API |
| Sessions | Sheet only | **Pass** — `UserSessionsSheet` |
| Effective-access summary | Role/scope lines, delta, session revoke warn | **Pass** — `EffectiveAccessSummary` |
| Audit before/after on assignment replace | Backend snapshots | **Pass** — `user-administration.service` `replaceAssignments` |

---

## Definition of “Wave 5 complete” (plan)

1. Wave 2 freeze identity + DES-07 result recorded — **Yes** (Phase F; conditional).  
2. AUTH-01 + ORG-01…04 acceptance — **Engineering yes**; browser pending.  
3. Dashboard/My Workspace empty vs error — **Engineering yes**.  
4. Companies / Branches / Departments dedicated pages — **Yes**.  
5. Users invite / Roles edit + effective-access preview — **Yes**.  
6. Phase K evidence pack — **This file**; W6+ not started.

---

## Decision

| Field | Value |
|---|---|
| Engineering W3–W5 result | **Conditional Pass** — typecheck, health, AUTH unit tests, code-path checklists |
| Manager browser / ENV-001 | **Pending** (AUTH matrix live, org mid-step fail, DASH screenshots, ADM/SEC click-through) |
| Proceed to W6+ | **Yes (engineering)** — open Employees / Recruitment / Attendance / Leave UI waves when product asks |
| Hold reasons | Uncommitted W3–W5 tree should be committed + SHA backfilled here; live persona UAT still open from Phase F |

---

## Linked artifacts

| Artifact | Path |
|---|---|
| Execution plan | `docs/development/wave-2-to-wave-5-execution-plan.md` |
| Wave 2 freeze | `docs/development/wave-2-freeze-record.md` |
| DES-07 | `docs/development/wave-2-designation-pilot-uat.md` |
| AUTH helper + tests | `frontend/lib/auth-next-path.ts`, `frontend/lib/auth-next-path.test.ts` |
