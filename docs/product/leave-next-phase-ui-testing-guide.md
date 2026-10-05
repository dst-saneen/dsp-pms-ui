# Leave next phase — UI testing steps

**App:** `http://localhost:3200`  
**API:** `http://localhost:4500` (must be running or every page will fail)  
**Pilot:** COM-000002 / Kowdiar (BR-000002), same as Business Calendar  
**Accounts:** reuse people from `business-calendar-manager-testing-guide.md`, plus a **Reporting Manager** who is **not** the HR person.

You need **three logins**:

| Who | Role | Used for |
|-----|------|----------|
| Employee | Employee, linked to an employee on Kowdiar, **manager = the manager employee** | My Workspace apply + calendar |
| Manager | User linked to that manager employee; can approve team leave (`hr.team.approve` or HR leave) | Leave → Requests → Manager review |
| HR | HR Manager on COM-000002 | Matrix, HR review, calendar, holidays |

If submit says **no eligible HR**, assign **HR Manager** on that company (or branch) to a **different** person than the employee and the manager.

---

## 0. Start both apps

Frontend is already `pnpm run dev` on **3200**. Backend is **not** up (`ECONNREFUSED 4500`).

In a **second** terminal:

```powershell
cd "D:\app shell\dsp-pms-app\backend"
pnpm run start:dev
```

Wait until it listens on **4500**. Refresh `http://localhost:3200/login`.

Do **not** click **Generate balances** (real apply) unless you intend to write missing rows. Matrix save and leave submit **do** write to the connected database.

---

## 1. Policy matrix (HR)

1. Log in as **HR**.
2. **Leave → Policies** (`/hr/leave/policies`).
3. Stay on **Matrix** (not List).
4. Pick company **COM-000002**, branch **Kowdiar**.
5. Grid: rows = designations, columns = leave types, cell = checkbox + days.
6. Change **one** cell (days or on/off). Unsaved warning appears.
7. **Save reason** (at least 3 characters) → **Save N changes**.
8. Banner: *Existing leave balances were not auto-updated.*

**Pass:** save works; balances page was not silently rewritten.

**Skip for now:** second-tab stale save (`409`) unless you want that extra check.

---

## 2. Balances (optional — skip unless apply failed for “no balance”)

1. **Leave → Balances** (`/hr/leave/balances`).
2. **Generate balances**.
3. Company + Kowdiar, year **2026**, keep **Dry run** on → run.
4. Read the preview (creates vs retain).
5. Only if HR asked: uncheck dry run and generate. Existing used/pending stay.

---

## 3. Personal calendar + apply (Employee)

1. Log in as **Employee**.
2. **My Workspace** (`/my-workspace`).
3. Calendar: tabs **Month | List | Balances**.
4. Click a **working day** (not weekend/holiday) → side panel (type / half-full / holiday / balance).
5. Holiday name should link toward Business Calendar if you have access.
6. **Apply leave** (panel or header).
7. Leave type, From = To = that day, leave **Half day** unchecked, keep **Submit for approval now** on → **Submit leave**.
8. Note **days** (usually `1`). On **Balances** tab, pending should go up.

**Pass:** request is submitted; calendar shows pending leave on that day.

**Half-day (second pass):** same type, one working day, **Half day** on → days = `0.5`.

---

## 4. Manager then HR (two logins)

### Manager

1. Log in as **Manager**.
2. **Leave → Requests** (`/hr/leave`).
3. **Manager review**.
4. Open the employee’s request → **Approve** (no “final HR” confirm yet).
5. Status stays submitted / stage **HR**. Days stay **pending**, not used.

**Pass:** Approve is only on **Manager review** for this user. It does **not** fully approve the leave.

### HR

1. Log in as **HR**.
2. **Leave → Requests** → **HR review**.
3. Same request → **Approve leave (HR)** → confirm.
4. Status **APPROVED**. Used up, pending down.

**Pass:** only HR final-approve consumes the balance.

### Reject (optional extra request)

Employee submits another day. Manager or HR **Reject** with a comment. Pending returns. Calendar does not stay approved.

---

## 5. Team / HR calendar (HR or Manager)

1. **Leave → Calendar** (`/hr/leave/calendar`).
2. Employee selector: pick the test employee. Filters (branch / department / search) only **narrow** the list.
3. Month grid: leave type + stage (Manager / HR) on team days. **No** reason / attachments.
4. Click a leave day → panel.

**Pass:** you see that employee’s leave; you do not see another company’s people.

---

## 6. Holidays (HR)

1. **Leave → Holidays** (`/hr/leave/holidays`).
2. Banner: offices labelled **LEGACY** vs **Business Calendar** (`SHADOW` / `ACTIVE`).
3. If Kowdiar is **LEGACY**: Add/Edit still works.
4. If it is **SHADOW** or **ACTIVE**: create/edit should be blocked; use **Open Business Calendar**.
5. From a calendar holiday name, the link should open Business Calendar (if you have `calendar.business.read`).

---

## 7. Quick “looks right” checks

- Shrink the window (desktop → tablet → phone): matrix, requests, calendars should scroll, not explode sideways.
- Employee must **not** see **Approve** on their own request.
- **Completed by me** on Requests shows what you already decided.

---

## If something fails

| What you see | Likely cause |
|--------------|----------------|
| Login / every page error, network fail | Backend not on **4500** |
| Matrix empty | No designations or leave types for that branch |
| Submit: insufficient balance | Generate **missing** balances (step 2) or raise matrix days then generate |
| Submit: no eligible HR | Assign HR Manager (not Super Admin) to another person on that company/branch |
| Manager queue empty | Employee’s `managerId` is not this manager, or you are looking at **HR review** |
| HR queue empty | Manager has not approved yet, or you are not the assigned HR |
| Holiday create blocked | Office already left LEGACY — use Business Calendar |
| Calendar 404 | Wrong employee / outside your company-branch scope |
