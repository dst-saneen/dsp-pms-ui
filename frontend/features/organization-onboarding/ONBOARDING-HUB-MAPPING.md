# Organization onboarding hub mapping

Frozen mapping for the organization onboarding hub vs the current ERP
implementation (original design mock lived under `frontend/design/` and was
removed for license provenance; this doc remains the source of truth for Phases 1–6).

**Scope:** readiness hub backed by the canonical organization-onboarding APIs.

**Route today:** `app/(onboarding)/onboarding/page.tsx`  
**Status API:** `GET /organization-onboarding` → `organizationOnboardingService.status()`  
**Gate:** `AuthenticatedApp` redirects incomplete org owners to `/onboarding`

---

## 1. Hub layout (target structure)

| Zone | Mock | Our approach |
|------|------|----------------|
| Header | Brand + “Organization setup” + “Need help?” | Reuse `BrandLockup` / `AppBrand`. “Need help?” optional / later. |
| Left | Marketing intro + bullets + script | Static copy; ERP-friendly, not pixel-copy script art unless asset exists. |
| Center | Progress + done / required / optional sections | Driven by status payload. |
| Right | Workspace summary + CTA | Same status; CTA → `complete()`. |
| Mobile | Stacked | Summary compact; CTA sticky or bottom. |

---

## 2. Item → data → API map

### Already set up (from registration)

| Hub card | Display from | Done when | Edit / action | Service |
|----------|--------------|-----------|---------------|---------|
| **Organization** | `status.companyGroup.groupName` (+ description) | Always present after register | Edit name/description | `CompanyGroupService.update(id, { groupName, description })` |
| **Owner account** | `useAuth().user.displayName` / `email`; prefer `status.ownerEmployee` first/last if present | Owner exists (registration) | Show only (no profile edit API in this flow). | Auth session + `ownerEmployee` on status |
| **Company profile** | `status.company.companyName` | `status.requirements.company` | Edit name, registrationNo, taxNumber | `CompanyService.update(id, …)` |

Notes:
- Internal codes (`groupCode`, `companyCode`) stay ERP-generated; show read-only like today.
- If `company` is somehow missing, treat Company as **required** (rare; registration usually creates it).

### Finish these items (required for workspace)

| Hub card | Display from | Done when | Primary action | Service |
|----------|--------------|-----------|----------------|---------|
| **Confirm main branch** | Suggestion copy; `counts.branches` | `requirements.branch` (`counts.branches >= 1`) | Confirm / create branch form | `BranchService.create({ companyId, branchName, … })` then refresh status |
| **Add first department** | Chips as **prefills only** | `requirements.department` (`counts.departments >= 1`) | Add department form with explicit branch selection | `DepartmentService.create({ companyId, branchId, departmentName })` |
| **Designation** | `counts.designations` | `requirements.designation` (`counts.designations >= 1`) | Create a designation for the owner to select | `DesignationService.create` |

Backend `POST /organization-onboarding/complete` requires active `companyId`, `branchId`, `departmentId`, and `designationId` selections. The records must belong to the active Company Group and form one consistent hierarchy.

### Additional setup

| Hub card | Display from | Done when (for checklist only) | Action | Service |
|----------|--------------|--------------------------------|-------------|---------|
| **Team members** | Informational | N/A (always “later” until admin) | Soft card / link copy only | None in onboarding complete path |
| **Shifts** | `counts.shifts` | `counts.shifts >= 1` | Optional short create | `ShiftService.create` |
| **Tax information** | `company.taxNumber` | taxNumber non-empty | Edit company tax field | `CompanyService.update` |

---

## 3. Required vs optional (product rules)

### Required to enable **Open my workspace**

```text
requirements.company === true
AND requirements.branch === true
AND requirements.department === true
AND requirements.designation === true
```

Then: collect the four IDs explicitly and call `organizationOnboardingService.complete(selection)` → redirect `/dashboard`.
(Same gate as `AuthenticatedApp` after status becomes `COMPLETED`.)

### Optional (hub may show; must not gate CTA)

- Team members  
- Shifts  
- Tax information  
- Organization / company description polish  
- Owner profile edit  

### Derived “completed” for summary checklist

| Checklist row | Green check when |
|---------------|------------------|
| Organization | `companyGroup.groupName` length ≥ 2 |
| Company | `requirements.company` |
| Main branch | `requirements.branch` |
| Department | `requirements.department` |
| Team members | always “Add later” (or link out later) |
| Designations | `requirements.designation` |
| Shifts | `counts.shifts > 0` else “Add later” |
| Tax information | Boolean(`company.taxNumber`) else “Add later” |

---

## 4. Progress model (hub, not step index)

Do **not** drive the hub primarily from `currentStep`.

Progress uses five core items:

1. Organization name
2. Company
3. Branch
4. Department
5. Designation

```text
completedCount = org + company + branch + department + designation
totalCore = 5
percent = round(100 * completedCount / 5)
remaining = 5 - completedCount
```

Owner is display-only and does not affect the percentage. Shifts, team members, and tax information remain optional and do not affect the CTA.

Time estimate pill: static copy (“About 2 minutes” when remaining > 0; “Ready” when 0) — no backend.

---

## 5. Role of `currentStep`

| Field | Today (old wizard) | Hub (final) |
|-------|--------------------|-------------|
| `currentStep` | Drove which form was shown | **Not used by hub UI** |
| `updateStep()` | Advanced wizard | Kept on service for API compatibility; hub does not call it |
| `status` `IN_PROGRESS` / `COMPLETED` | Gate + complete | **Keep** — CTA calls `complete()` |

Hub progress is derived from `requirements` + `counts` via `hub-progress.ts`.

---

## 6. Interaction pattern (frozen for later phases)

| Action | Pattern |
|--------|---------|
| Edit org / company | Modal or drawer (Phase 3) |
| Confirm branch / Add department | Modal or drawer with existing fields (Phase 4) |
| Optional cards | Soft modal or “later” dismissible (Phase 5) |
| Open my workspace | Enabled only when Company, Branch, Department, and Designation are complete → `complete()` (Phase 6) |

**Recommendation carried forward:** modal/drawer (hub stays stable).

---

## 7. Files to evolve (not implement in Phase 0)

| Area | Path |
|------|------|
| Page entry | `app/(onboarding)/onboarding/page.tsx` |
| New UI tree (proposed) | `components/organization-onboarding/` or `features/organization-onboarding/components/` |
| Types | `features/organization-onboarding/types.ts` |
| Service | `features/organization-onboarding/organization-onboarding-service.ts` |
| Gate | `components/auth/authenticated-app.tsx` (unchanged rules) |
| Mutations | existing CompanyGroup / Company / Branch / Department / Designation / Shift services |

---

## 8. Phase 0 exit checklist

- [x] Mock zones mapped to our layout  
- [x] Each hub item mapped to status fields + services  
- [x] Required vs optional frozen (company + branch + department + designation gate CTA)
- [x] Progress rule frozen (5-core %; owner display-only)
- [x] `currentStep` demoted for hub UI  
- [x] Edit/action pattern recommended (modal/drawer)  

**Next:** Phase 1 — shell & layout only (no real actions). ✅ Done  
**Next:** Phase 2 — progress + summary from live `status()`. ✅ Done  
**Next:** Phase 3 — “Already set up” cards + Edit. ✅ Done  
**Next:** Phase 4 — required branch + department actions. ✅ Done  
**Next:** Phase 5 — optional “Set up later” cards. ✅ Done  
**Next:** Phase 6 — Open my workspace CTA + cleanup. ✅ Done  

Hub is the only organization onboarding UX. Linear wizard UI retired.

