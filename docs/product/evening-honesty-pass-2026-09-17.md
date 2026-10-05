# Evening honesty pass — 17 Sep 2026

**For:** Suji  
**Rule:** If the screen shows a field or action, the user must be able to complete it — or we hide it / guide the next step.

Tonight we did **not** audit the whole ERP. We fixed two concrete confusion points.

---

## Fixed tonight

### 1. Leave — Carry forward days editable (via Edit)

**How it works (two places):**

| Screen | What you set |
|--------|----------------|
| **Leave → Types** | Carry forward **allowed** = Yes/No only (no day count here) |
| **Leave → Policies → By leave type** | Carry forward **days** — click **Edit**, change number, **Save** |

- Saving days applies to **all roles** for that leave type in that branch
- Days per role still edit only in **Designation matrix**

**How to verify**

1. Open Leave → Policies → By leave type  
2. Click **Edit** on Carry forward for Casual Leave → set e.g. `5` → Save  
3. Refresh → value stays  

### 2. Projects — Client needs customer path

**Where:** Projects → New project → Type = Client

- If no customers: message + **Create customer** link  
- Link opens Office Finance → Business Parties (customer)  
- After create, returns to Projects with create dialog open (Client)  
- Toast: select the customer you just created  

**How to verify**

1. Projects → New project → Client  
2. If empty, click **Create customer**  
3. Create customer → returns to Projects  
4. Select customer → Create project  

---

## Still incomplete (not claimed done)

- Full page-by-page ERP honesty audit  
- Negative balance still display-only on By leave type (not editable there tonight)  
- Other empty states across Recruitment / Attendance / Payroll not covered tonight  

---

## Ongoing process (after tonight)

For each screen:

```text
List every visible field/button
  → Can the user finish it?
     Yes → OK
     No  → Fix it, hide it, or add “go create X / return”
```

Priority after this pass: Leave remainder → Projects → Recruitment → Attendance → Payroll.
