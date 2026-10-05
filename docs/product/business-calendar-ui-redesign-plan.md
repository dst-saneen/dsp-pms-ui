# Business Calendar — HR-Friendly UI Redesign Plan

**Status:** Phases A–D complete (2026-08-10)  
**Goal:** Make Business Calendar feel like an **HR / office tool**, not a developer console.  
**Requested by:** Boss feedback after demo  

---

## 1. Problem (what boss saw)

Current UI reads like backend docs:

| Today | Feels like |
|-------|------------|
| “Business Day Preview” | Technical |
| “Resolve working / non-working… layer trace” | Developer |
| `LEGACY_MODE` / `MISSING_LOCATION` / `scopeKey` style badges | System internals |
| “Dry-run ensure” / “Apply ensure” | Ops tooling |
| Single-date preview only | Incomplete for HR |

HR needs: **where is my office calendar, what do days look like, how do I change holidays, what needs follow-up.**

---

## 2. Design principles

1. **HR language first** — no permission codes, no “runtime”, no “materialize”, no “layer trace” in primary UI.  
2. **One job per tab** — clear purpose in the tab name + one short subtitle.  
3. **Calendar-first preview** — day / week / **proper month grid**.  
4. **Progressive detail** — simple result first; “Why this day?” behind a secondary control.  
5. **Keep backend APIs** — rename and reshape frontend; avoid large API rewrites unless preview range needs polish.  
6. **Reuse existing pieces** — version page already has list/week/month event views; My Workspace has month calendar patterns.

---

## 3. New information architecture (tabs)

| # | New tab name | Old name | Purpose in plain words |
|---|--------------|----------|------------------------|
| 1 | **Offices** | Offices | Pick company/branch calendars |
| 2 | **Calendar Preview** | Business Day Preview | See how days look (day / week / month) |
| 3 | **Import Holidays** | Imports | Bring in government / file holidays |
| 4 | **Review Changes** | Change Impacts | Follow-up after editing a published calendar |

Optional later (not in first pass): merge “Versions” into a clearer “Edit calendar” flow title.

Route can stay `/preview` internally; only **labels** must change to Calendar Preview (URL change optional).

---

## 4. Tab-by-tab plan

### Tab 1 — Offices

**Keep:** company select, company calendar, branch calendars, Open.

**Rewrite copy / controls:**

| Remove / hide from primary UI | Replace with |
|-------------------------------|--------------|
| Dry-run ensure / Apply ensure | Move under **Advanced** (or hide for HR) |
| `LEGACY_MODE`, `READY`, `MISSING_LOCATION` raw codes | Friendly labels: **Using old holidays**, **Ready**, **Location incomplete** |
| “Parent”, “branch override capable” jargon | **Company calendar**, **Branch calendar (can customize)** |
| New company calendar (code MAIN) | **Create company calendar** with plain fields |

**Page intro:**  
“Manage holiday calendars for each company and branch.”

---

### Tab 2 — Calendar Preview (main request)

**Rename everywhere:** tab, page title, empty states, permissions message.

**Filters (top bar):**
- Company (required)
- Branch (optional) — “All company rules” vs specific branch
- View toggle: **Day | Week | Month**
- Date / month navigator

**Views:**

#### Day
- Big result card: **Working day** / **Holiday** / **Week off** / **Half day**
- Short reason in normal English (“Independence Day — full day holiday”)
- Optional accordion: **Why this result?** (old resolution trace, humanized)

#### Week
- 7 columns (Sun–Sat or Mon–Sun — match product convention)
- Each cell: status color + short label
- Click a day → opens Day detail

#### Month (proper calendar)
- Classic month grid (like My Workspace / Google Calendar style)
- Color / badge per day type:
  - Working
  - Holiday
  - Week off
  - Half day
- Legend under the grid
- Click day → Day detail panel/sheet

**Data:**
- Day: existing `POST /business-calendar/runtime/preview`
- Week/Month: existing `GET` runtime range (or batch day preview) — confirm UX load limits (e.g. max ~42 days for month)

**Do not show by default:** `dayStatus`, `dayPortion` enums, `resolutionTrace` JSON.

---

### Tab 3 — Import Holidays

**Rename:** Imports → **Import Holidays**

**Sections:**
1. **Upload a file** (CSV / Excel / ICS) — “Add holidays from a spreadsheet or calendar file”  
2. **Government holidays** — “Load India / Middle East holiday packs”  
3. **Review batches** — Validate → Approve → Apply to draft  

**Rewrite:**
- “Apply to draft” stays (important safety) but explain: “Adds to draft calendar — does not publish yet”
- Hide sourceKind codes where possible; show “CSV file”, “Excel”, “Calendar file (ICS)”

---

### Tab 4 — Review Changes

**Rename:** Change Impacts → **Review Changes**

**Intro text:**  
“When a published calendar is edited, check leave or shift rows that may need HR follow-up.”

**List columns (plain):**
- Date
- What changed / type (Leave / Roster)
- Status (Needs review / Done)
- Action: Mark reviewed

Avoid: `impactCode`, `entityType` raw unless in details drawer.

---

### Calendar detail / Versions page (when Open is clicked)

Also softens language in the same pass:

| Today | New |
|-------|-----|
| New draft version | **Create draft** |
| Submit for review | **Send for review** |
| Edit published calendar | keep (already clear) |
| Acknowledge & publish | keep / “Confirm & publish” |
| Ready for review: Publish | **Ready to publish** |
| Working week / Business events | keep; short help text |

Event list/week/month already exists — align colors/labels with Calendar Preview.

---

## 5. Copy dictionary (examples)

| Backend / old | User-facing |
|---------------|-------------|
| Business Day Preview | Calendar Preview |
| resolution trace | Why this day? |
| LEGACY_MODE | Using old holiday list |
| SHADOW_MODE | Testing new calendar |
| ACTIVE_MODE | New calendar in use |
| MISSING_LOCATION | Add country / state on branch |
| Dry-run ensure | (Advanced) Check missing calendars |
| Apply ensure | (Advanced) Create missing calendars |
| Change Impacts | Review Changes |
| Imports | Import Holidays |
| NON_WORKING_DAY | Holiday / Non-working |
| FIRST_HALF_NON_WORKING | Morning half-day off |

---

## 6. Visual / UX direction

- Keep existing ERP shell (sidebar, orange primary) — **do not invent a new brand**.  
- Month preview: clear grid, weekday headers, today outline, legend.  
- Status colors consistent across Offices + Preview + Version events.  
- Mobile: filters stack; month grid remains usable (no horizontal page overflow).  
- Accessibility: keyboard through Day/Week/Month toggle; cells focusable.

---

## 7. Build phases (recommended)

### Phase A — Naming + copy (fast win)
- Rename tabs and page titles  
- Replace developer subtitles  
- Friendly mode/status badges on Offices  
- Hide/relabel ensure buttons  

### Phase B — Calendar Preview day/week/month
- View toggle  
- Month grid UI  
- Week strip  
- Day detail with human reason  
- Wire range API  

### Phase C — Imports + Review Changes polish
- Section titles and helper text  
- Friendlier batch/impact lists  

### Phase D — Version workspace language pass
- Buttons and empty states in HR language  
- Align event calendar styling with Preview  

**Suggest start order:** A → B → C → D (boss cares most about Preview rename + month calendar).

---

## 8. Out of scope (this redesign)

- Changing ACTIVE / SHADOW business rules  
- New permissions  
- Rebuilding Leave / My Workspace (only align holiday labels if needed)  
- Full visual rebrand of whole ERP  

---

## 9. Success criteria (boss check)

1. Tab says **Calendar Preview** (not Business Day Preview).  
2. Can switch **Day / Week / Month**.  
3. Month looks like a **real calendar** with holidays visible.  
4. Primary screens readable by HR with **no backend jargon**.  
5. Change Impacts explained as **Review Changes** follow-up list.  

---

## 10. Decision needed from you before coding

1. Confirm tab names: **Offices / Calendar Preview / Import Holidays / Review Changes**?  
2. Week start: **Sunday** or **Monday**?  
3. Phase A+B first (rename + preview calendar), then C+D?  
4. Keep URL `/preview` or also rename route to `/calendar-preview`?

---

## 11. Phase A status (2026-08-10)

**Done:** naming + HR copy pass (tabs, page headers, Offices badges, Preview day result, Import Holidays, Review Changes, key version actions).

## 12. Phase B status (2026-08-10)

**Done:** Calendar Preview Day / Week / Month views, proper month grid + legend, selected-day detail, range API fills gaps for incomplete materialization.

**Not in Phase B:** Import Holidays / Review Changes deeper polish (Phase C).

## 13. Phase C status (2026-08-10)

**Done:** Import Holidays step guide, draft-only version picker, jurisdiction country/state selects, friendly batch/row statuses, holiday name+date rows (no hash), select-all, clearer Add to draft copy. Review Changes company picker, column layout (Date / Type / What changed / Office / Status), friendly impact codes, details drawer, Mark reviewed toasts.

**Not in Phase C:** Version workspace language + event calendar styling (Phase D).

## 14. Phase D status (2026-08-10)

**Done:** Version workspace HR language (Create draft / Send for review / Ready to publish / Confirm & publish), checksum hidden, working-week jargon softened, quick day check aligned with Preview colors + Why this day?, holiday/event form uses friendly day effects, event month/week/list colors + legend match Calendar Preview.

**Redesign Phases A–D complete.**

