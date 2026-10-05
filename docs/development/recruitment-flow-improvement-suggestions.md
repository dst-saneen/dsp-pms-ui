# Recruitment flow — suggested improvements

Simple summary of feedback from the recruitment walkthrough.  
Use this for review and planning.

---

## How recruitment works today (short version)

```text
Candidate applies
    → Application list (HR sees all applications)
    → Screening → Interview → Manager review
    → Offer sent → Candidate accepts online
    → HR converts to employee (Hired)
```

**Navigation today**

| Page | What it shows |
|---|---|
| **Applications** | All applications with status filters |
| **Interviews** | Separate list of all interviews |
| **Offers** | Separate list of all offers |
| **Application detail** | One application — tabs for Overview, Interviews, Evaluations, Offer |
| **Candidate profile** | Candidate info + list of their applications (click opens application) |

So: **application detail already has interview and offer for that candidate.**  
The separate Interview and Offer menu pages show the same data in a global list view.

---

## Suggestion 1 — Shortlist step on the application list

### What was asked

Before moving candidates deep into the pipeline, HR should be able to **shortlist** or **remove** them from the application list — similar to:

- **Accept / shortlist** — keep this candidate, move to next step  
- **Reject / remove** — do not proceed with this candidate  

This should happen **early**, before full screening and interview work.

### Today

- New applications land as **Applied**
- HR uses **Start screening** or **Reject**
- There is **no dedicated “Shortlist”** step or filter

### Gap

| Need | Current |
|---|---|
| Clear shortlist action on list | Only “Start screening” or “Reject” |
| Shortlist filter / queue | Not available |
| Separate “maybe” vs “no” before screening | Not available |

### Proposed direction

Add a **Shortlist** stage (or actions) on the application list:

1. **Shortlist** — candidate moves to a shortlist queue  
2. **Reject** — candidate is removed  
3. Only shortlisted candidates go to screening / interview  

---

## Suggestion 2 — Interview panel: Teams calendar + email

### What was asked

When an interview is scheduled and **panel members** are selected:

1. Panel members should receive a **Microsoft Teams calendar invite**  
2. Panel members should also get an **email notification**  

### Today

| Channel | Panel members | Candidate |
|---|---|---|
| In-app notification | Yes | — |
| Email | No | Yes (schedule / update / cancel) |
| Teams / Outlook calendar invite | No | — |
| Meeting link | Manual text field (paste link yourself) | — |

### Gap

Panel members can miss interviews because they only see an in-app alert — no calendar block and no email.

### Proposed direction

When HR schedules or reschedules an interview:

1. Create a **calendar event** (Teams / Outlook) for all panel members  
2. Send **email** to panel with date, time, link, and candidate context  
3. Keep existing candidate email  

*Requires integration with Microsoft 365 / Graph API (or similar).*

---

## Suggestion 3 — Offer letter: sign, return, then admin verifies → Hired

### What was asked

Offer flow should be:

```text
HR sends offer
    → Candidate signs the offer letter and sends it back
    → Admin / HR verifies the signed offer
    → Only then mark as Hired
```

### Today

```text
HR sends offer
    → Candidate opens link and clicks Accept (name + checkbox)
    → Status becomes Offer Accepted automatically
    → HR clicks “Convert to employee” → Hired
```

| Step | Today |
|---|---|
| Candidate signs document | No — only online accept/decline |
| Upload signed PDF | No |
| Admin verifies signature before Hired | No — accept is automatic |
| Hired | HR converts after preflight checks |

### Gap

No formal **signed offer on file** and no **verification gate** before hiring.

### Proposed direction

1. Candidate **signs** offer (e-signature or upload signed PDF)  
2. Signed document stored and linked to application  
3. HR **reviews and approves** the signed offer  
4. **Then** allow Convert to employee / Hired  

---

## Suggestion 4 — Simplify navigation: use Application as the main place

### What was asked

Why have **separate Interview list** and **Offer list** pages when:

- Application detail already shows **Interviews** and **Offer** for that candidate  
- From **Candidate profile**, clicking an application opens that application  

**Suggestion:** Collapse or remove the separate list pages and work mainly from **Applications** (and candidate profile).

### Today

```text
Menu
├── Applications     ← main pipeline
├── Interviews       ← all interviews (duplicate view)
├── Offers           ← all offers (duplicate view)
└── Candidates       ← profile → click application → application detail
```

Application detail (`/hr/recruitment/applications/[id]`) already has:

- **Interviews** tab — schedule, panel, complete  
- **Offer** tab — draft, send, ready to hire  

### Why separate pages exist now

| Page | Useful when… |
|---|---|
| Interview list | HR wants all upcoming interviews across all jobs in one table |
| Offer list | HR wants all pending offers / ready-to-hire in one table |

### Proposed direction (simplify first)

**Phase A — Collapse navigation**

1. Keep **Applications** and **Candidates** as main entry points  
2. Hide or merge **Interviews** and **Offers** menu items  
3. Add filters on Applications list: *Has interview scheduled*, *Offer sent*, *Ready to hire*  
4. From candidate profile → application → use tabs for interview / offer  

**Phase B — Optional later**

- Keep one “Operations” view (interviews this week) as a dashboard widget, not a separate module  

---

## Visual: suggested target flow

```text
                    ┌─────────────────┐
                    │  Application    │
                    │  list           │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        Shortlist        Reject      (optional hold)
              │
              ▼
        Screening → Interview → Manager review
              │                    │
              │         Panel: Teams invite + email
              ▼
        Offer sent → Candidate signs & returns
              │
              ▼
        Admin verifies signed offer
              │
              ▼
           Hired
```

**One screen for HR:** Application detail (not separate interview/offer lists).

---

## Summary table

| # | Topic | Priority | Effort (rough) |
|---|---|---|---|
| 1 | Shortlist on application list | High | Medium — status + UI actions |
| 2 | Panel Teams calendar + email | High | High — M365 integration |
| 3 | Signed offer + admin verify → Hired | High | High — documents + workflow |
| 4 | Collapse interview/offer list pages | Medium | Low–Medium — nav + filters |

---

## Recommended order of work

1. **Simplify navigation** (Suggestion 4) — quick win, less confusion  
2. **Shortlist step** (Suggestion 1) — clearer pipeline for HR  
3. **Panel calendar + email** (Suggestion 2) — needs external integration plan  
4. **Signed offer workflow** (Suggestion 3) — legal/compliance sensitive; define with HR  

---

## Open questions for review

1. Shortlist: new status **Shortlisted**, or actions only on **Applied**?  
2. Offer signing: e-signature vendor, or upload signed PDF enough?  
3. Who verifies signed offer — HR only, or HR + hiring manager?  
4. After collapsing lists, do we still need a “Interviews this week” widget on the dashboard?  
5. Teams integration: company already on Microsoft 365 with admin consent for Graph API?

---

## Related code (for implementers)

| Area | Location |
|---|---|
| Application list | `frontend/features/recruitment/applications/` |
| Application detail (tabs) | `frontend/features/recruitment/applications/components/job-application-editor.tsx` |
| Interview list | `frontend/features/recruitment/interviews/components/interview-workspace.tsx` |
| Offer list | `frontend/features/recruitment/offers/components/offer-workspace.tsx` |
| Candidate profile | `frontend/features/recruitment/candidates/components/candidate-profile.tsx` |
| Schedule interview | `frontend/features/recruitment/interviews/dialogs/schedule-interview-dialog.tsx` |
| Offer response (candidate) | `frontend/features/recruitment/offer-response/` |
| Application statuses | `backend/prisma/schema.prisma` — `JobApplicationStatus` |

---

*Document created from recruitment walkthrough feedback — for review and prioritisation.*
