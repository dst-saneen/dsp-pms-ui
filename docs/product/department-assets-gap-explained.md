# Department-wise assets — what we have vs what is needed

Simple explanation for discussion. No click-by-click UI steps.

---

## 1. What is being asked (in one story)

Today we treat assets like a **company store cupboard**: fridge, AC, laptop — buy it, record warranty and cost, give it to an employee.

The product need is for assets to belong to a **department**, and still include those general items.

Think of each department having **its own asset list**:

| Department | Example assets | Extra details they care about |
|------------|----------------|-------------------------------|
| **General / Admin / Facilities** | Fridge, AC, furniture | Cost, warranty, location |
| **IT** | Computers, monitors, software licenses | Serial no, who has it, expiry / renewal, how many licenses |
| **HR** | ID cards, access cards, joining kits | Card details, who it was given to, expiry |
| **Finance / others** | Same idea | Whatever that department owns |

**Three simple rules:**

1. **Department owns the asset list** — IT manages IT things; HR manages cards; facilities manage fridge/AC. General assets are still there, under the right department.
2. **Each asset has full details** — not only name. Serial number, cost, warranty / expiry, who it is assigned to, status.
3. **An employee only sees what is assigned to them** — not the whole company register.

---

## 2. How it should feel (ideal flow)

```text
1. Each department has its asset types
   (Hardware, Software/License, Card, General equipment, …)

2. That department enters each item with full details
   (serial, purchase, warranty/expiry, quantity/seats for licenses, etc.)

3. Someone in the department (or Asset/HR as agreed) assigns the item
   to an employee

4. The employee opens My Workspace and sees only:
   “Laptop AST-00012 — assigned to me”
   “Office access card — assigned to me”

5. They do not see other people’s laptops, IT’s unused stock,
   or another department’s fridge
```

**IT example:**  
Software is an asset. IT records: product name, how many licenses, expiry, who it is assigned to. Hardware is also an asset: computer, serial number, assigned to whom.

**HR example:**  
A card given to a joiner is an asset. HR records the card details and who received it.

**General example:**  
Fridge / AC still exist — they sit under Facilities (or General), with cost and warranty, same as today.

---

## 3. What we ALREADY have (current product)

The app already has **Asset Management** under the left menu. It is live (frontend + backend), not a mock.

### Screens today

| Screen | What it is |
|--------|------------|
| **Asset Categories** | Simple grouping for the company (e.g. Electronics) |
| **Asset Types** | Sub-group under a category (e.g. Laptop) |
| **Assets** | The actual items (code like AST-00001, name, serial, maker, model, purchase cost, warranty date, location) |
| **Employee Assets** | Who currently has which item (assign from here) |
| **Employee profile → Assets tab** | Assign / Return / Lost / Damaged for that person |
| **My Workspace** | Employee can **see** a short list of items assigned to them (read only) |

### How an item is stored today

An asset is **one physical-style row**:

- Company + optional **branch** (not department)
- Category + type + name + code
- Optional serial, manufacturer, model
- Optional purchase date, cost, currency
- Optional **warranty expiry**
- Location (free text) + remarks
- Status: Available / Assigned / Repair / Lost / Disposed
- Assigned to **one employee at a time** (must return before giving to someone else)

This already covers **fridge, AC, laptop, cost, warranty** — the “plain / general asset” described in the request.

### Who can do what today

| Person | What they can do |
|--------|------------------|
| **Asset Manager / Company Admin / Owner** | Create items, assign, return |
| **HR Manager** | Can **look** at assets, cannot assign/return (API blocks it) |
| **Employee** | Sees **own** assigned items in My Workspace only. Cannot return or request. |
| **Department head** | **No such role** for assets. Lists are not filtered by department. |

Scope today is **company / branch**, not department.

---

## 4. What this is NOT yet

The current module is a **company/branch custody register**: buy item → give to employee → get it back.

It is **not** yet:

- A **department inventory** (“IT’s stock vs HR’s cards vs Facilities’ fridge”)
- A **software license** register (product, seats, vendor, renewal date)
- An **ID / access card** register (card number, issue/expiry)
- A place where **each department only works on its own list**
- Expiry **reminders** (warranty date is saved, but not shown as a grid alert)
- Employee **self-service** beyond viewing (no “request return” / “report lost”)

You *could* name a category “Software” today, but the form is still the same laptop-style fields. There is no license key, seat count, or software list.

---

## 5. The gap (easy table)

| Need | Today | Missing |
|------------------|-------|---------|
| Department owns assets | Asset has company + branch only | **Department on the asset** (and lists filtered by it) |
| General assets (fridge, AC) still included | Already supported as normal assets | Keep them; put them under a department (e.g. Facilities / Admin) |
| IT: computers + serial + who has it | Serial and assignment exist | Show serial/status clearly; department = IT |
| IT: software / licenses, how many, list | No license/seat fields | **Software/license asset kind** (or extra fields) |
| HR: cards given to people, full details | Same generic form | **Card kind** (or extra fields) + HR department |
| Expiry dates | Warranty date only, weak in the list | Expiry/renewal by kind + later reminders |
| Employee sees only assigned assets | My Workspace shows own items | Keep this. Do **not** give employees the full register |
| Department people manage their own list | Anyone with asset permission sees company/branch stock | Permission / filter: **my department’s assets** |

---

## 6. What we need to add (work list)

### Must-have (to match the idea)

1. **Department on every asset**  
   Fridge → Facilities. Laptop/license → IT. Card → HR.  
   Lists and dashboards filter by department.

2. **Keep general assets**  
   Same cost / warranty / location idea, just owned by a department instead of “the whole company pile”.

3. **Asset kinds (or types that behave differently)**  
   At least:
   - **General / equipment** (current form)
   - **Hardware** (serial, assigned person — mostly already there)
   - **Software / license** (product, how many seats, expiry, assigned users)
   - **Card** (card details, issue/expiry, assigned employee)

4. **Full details on entry**  
   Serial, purchase, warranty/expiry, assignment — required or shown by kind, not hidden.

5. **Employee view stays personal**  
   My Workspace (and later a simple “My assets” page) = **only assigned to me**.  
   Stock, unused licenses, other departments = not visible to the employee.

6. **Who assigns**  
   Product choice to lock:
   - Department staff assign their own items, **or**
   - Central Asset Manager still assigns, but list is department-wise.  
   Current code: Asset Manager assigns; HR cannot.

### Nice / later

7. Expiry / warranty reminders  
8. Employee request return / report lost  
9. Transfer without full return  
10. Return action on Employee Assets list (today only on employee profile)  
11. Hide Create/Assign buttons when the user only has **read** permission (API already blocks; UI still shows the button)

---

## 7. Summary

| Statement | True? |
|-----------|--------|
| We already have a working general asset register (item, cost, warranty, assign to employee) | **Yes** |
| Employee already sees only their assigned items in My Workspace | **Yes** (read only) |
| Assets are owned by **department** today | **No** — company/branch only |
| Software licenses and HR cards are first-class asset types today | **No** — one generic form |
| Main new work | **Department ownership + kinds (hardware / license / card / general) + richer details + department-scoped lists; keep employee view personal** |

---

## 8. Short status line

We already record company assets (fridge, AC, laptop) with cost, warranty, serial, and assignment to one employee. Employees already see only their own items. What is missing is **department-wise ownership** and **special details per kind** (IT software licenses, hardware assignment, HR cards), so each department manages its list and the employee still only sees what was given to them.
