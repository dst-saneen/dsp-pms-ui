# Stage 8 — Complete Frontend Rollout

**Work order:** `business-calendar-development-work-order.md` §19  
**Date:** 2026-08-07  
**Status:** COMPLETE (UI wired to Stages 2–7 APIs; UAT remains Stage 9)

> Stage 8 delivers the Business Calendar admin experience in the existing shell:  
> Offices → Versions → Working Week / Events → Imports → Preview → Change Impacts.

---

## 1. Routes

| Route | Purpose |
|-------|---------|
| `/administration/business-calendar` | Offices (company parent + nested branches) |
| `/administration/business-calendar/[calendarId]` | Versions / week / events / publish / amend |
| `/administration/business-calendar/[calendarId]/versions/[versionId]` | Deep-link to a version |
| `/administration/business-calendar/preview` | Business day preview |
| `/administration/business-calendar/imports` | CSV/Excel/ICS + government packs |
| `/administration/business-calendar/impacts` | Amendment change impacts |

Holiday admin route is **unchanged** during transition.

---

## 2. Tabs (shell)

Offices · Business Day Preview · Imports · Change Impacts  

Calendar Versions / Working Week / Business Events live inside the calendar detail workspace (same flows as Stage 3–4, now route-linked).

---

## 3. Required UI behaviour

| Behaviour | Status |
|-----------|--------|
| Company calendar as parent; branches nested | ✅ |
| Inherited vs override labelling | ✅ (Inherited badge / Branch override capable) |
| **Edit published calendar** → amendment FormSheet | ✅ |
| Impact review before amendment publish | ✅ (existing Stage 4 sheet) |
| Month / week / list event views + type/source filters | ✅ |
| Branch timezone / date labels | ✅ |
| FormSheet for create flows | ✅ |
| Confirm for publish / reject import | ✅ |
| Loading / empty / error + retry | ✅ |
| No fake API data | ✅ |

---

## 4. Accessibility

- Tab nav with `aria-current` and focus rings  
- Month/week cells keyboard-focusable (`tabIndex={0}`) with event counts in `aria-label`  
- FormSheet drawers (existing focus containment)  
- Non-colour status via StatusBadge labels (Inherited / Parent / override)  
- `motion-reduce:transition-none` on tab transitions  
- `overflow-x-hidden` on workspaces to avoid horizontal body scroll  

---

## 5. Backend addition for Impacts tab

| Method | Path |
|--------|------|
| GET | `/business-calendar/impacts` |
| POST | `/business-calendar/impacts/:impactId/resolve` |

Service: `business-calendar-impact.service.ts`.

---

## 6. Key frontend files

```text
frontend/features/business-calendar/
  shell.tsx
  business-calendar-workspace.tsx
  version-workspace.tsx
  events-views.tsx
  imports-workspace.tsx
  preview-workspace.tsx
  impacts-workspace.tsx
  hooks.ts / service.ts / types.ts

frontend/app/(dashboard)/administration/business-calendar/
  page.tsx
  [calendarId]/page.tsx
  [calendarId]/versions/[versionId]/page.tsx
  preview/page.tsx
  imports/page.tsx
  impacts/page.tsx
```

---

## 7. Exit gate

| Gate | Status |
|------|--------|
| Draft → Publish and Published → Amendment UI complete | ✅ |
| Branch nested under company with inheritance cues | ✅ |
| Imports + preview + impacts screens | ✅ |
| Employee workforce calendar privacy untouched | ✅ (no change to privacy rules) |
| Formal UAT sign-off | ⏳ Stage 9 |

---

*Next:* say **Start Stage 9** for production-readiness testing and UAT.
