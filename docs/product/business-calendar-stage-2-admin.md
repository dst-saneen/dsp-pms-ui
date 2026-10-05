# Stage 2 — Calendar Administration and Tenant Security

**Work order:** `business-calendar-development-work-order.md` §13  
**Date:** 2026-08-07  
**Status:** COMPLETE

> Stage 2 adds admin APIs + Administration UI to create/list Company and Branch calendars.  
> Runtime stays **LEGACY**. Leave / Attendance / Holidays behaviour is **unchanged**.

---

## 1. What Stage 2 means (simple)

HR/Admin can now:

1. See Business Calendar under **Administration**.  
2. Create a **Company calendar** (idempotent by `scopeKey`).  
3. Create **Branch calendars** that inherit the company parent.  
4. Dry-run / apply **ensure** for all offices in a company.  
5. See configuration badges (Ready / Missing timezone / Missing location / Legacy / Shadow / Active).

No draft versions, events, publish, or Leave cutover yet (Stages 3–6).

---

## 2. Where to check

| What | Where |
|------|--------|
| This report | `docs/product/business-calendar-stage-2-admin.md` |
| Admin service | `backend/src/modules/business-calendar/business-calendar-admin.service.ts` |
| Controller | `backend/src/modules/business-calendar/business-calendar.controller.ts` |
| DTOs | `backend/src/modules/business-calendar/dto/business-calendar-admin.dto.ts` |
| Admin UI | `/administration/business-calendar` |
| Frontend feature | `frontend/features/business-calendar/` |
| Nav entry | Administration → Business Calendar (`calendar.business.read`) |
| Unit tests | `npx jest src/modules/business-calendar` |

---

## 3. APIs

| Method | Path | Permission |
|--------|------|------------|
| GET | `/business-calendars` | `calendar.business.read` |
| GET | `/business-calendars/:id` | `calendar.business.read` |
| POST | `/business-calendars/company` | `calendar.business.manage` |
| POST | `/business-calendars/branch` | `calendar.business.manage` |
| POST | `/business-calendars/ensure` | `calendar.business.manage` |
| PATCH | `/business-calendars/:id` | `calendar.business.manage` |

### Rules enforced

- Tenant scope via `EmployeeDomainScopeService` (company / branch isolation).  
- Company calendar: one active company-scope calendar per company (`scopeKey` = `COMPANY:<uuid>`).  
- Branch calendar requires valid branch IANA timezone + existing company parent.  
- Parent must be same company (no cross-company parent).  
- New calendars start in `LEGACY` runtime mode.  
- Mutations write audit + sanitized outbox in the same Prisma transaction.  
- Ensure supports `dryRun` (default **true**).

---

## 4. Frontend

- Navigation: **Administration → Business Calendar**.  
- Company filter → Company calendar card + Branch calendars list.  
- FormSheet for company calendar setup.  
- Branch provision from company-scoped branch lookup.  
- Dry-run ensure + Apply ensure actions.  
- Status badges from API `configurationStatus`.

---

## 5. Tests run

```text
npx jest src/modules/business-calendar --no-coverage
→ 3 suites, 13 tests passed
```

Covered:

- Idempotent company provision  
- Branch rejected when timezone invalid  
- Branch rejected when company calendar missing  
- Ensure dry-run plan  
- getOne not found  

Also: migration status on shared RDS = **up to date** (Stage 1 foundation migration applied).

---

## 6. Exit gate (work order §13)

| Gate | Result |
|------|--------|
| Every test office resolves to at most one Calendar | Enforced by unique `scopeKey` / company+BRANCH scope idempotency |
| Cross-tenant isolation | List/detail/provision use domain scope asserts |
| No invalid parent | Branch parent always loaded as same-company COMPANY calendar |
| Existing Company/Branch screens compatible | Additive only; no changes to company/branch masters |

---

## 7. What is intentionally not done

- Versions / working week / events (Stage 3)  
- Publish / amendments / runtime preview (Stage 4)  
- Legacy holiday backfill / shadow (Stage 5)  
- Leave/Attendance consumer switch (Stage 6)  

---

## 8. How to try it

1. Restart backend if it was running before Stage 2 routes were added.  
2. Log in as a user with `calendar.business.read` (and `.manage` to create).  
3. Open **Administration → Business Calendar**.  
4. Select pilot company (e.g. COM-000002), create company calendar, then branch calendar for Kowdiar, or use Dry-run / Apply ensure.

---

*Next:* say **Start Stage 3** for Versions, Working Week and Business Events.
