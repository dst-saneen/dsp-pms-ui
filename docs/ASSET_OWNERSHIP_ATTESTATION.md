# Asset ownership form (Phase C)

**Project:** Group ERP / DSP PMS
**Purpose:** Write down who owns each remaining image/SVG so the license audit can close those items.

**How to use (beginner):**

1. Designer or manager fills one row per file (or signs the whole list once).
2. Tick **Yes** only if the company owns it (made by employee / contractor for the company, or bought with a license).
3. If **No** / unsure → replace the file or remove it from the product.
4. Save this file (or print, sign, scan) and tell the team to update `docs/LICENSE_AUDIT.md`.

**Not a lawyer document** — just an internal checklist.

---

## Sign-off

| Field | Fill in |
|-------|---------|
| Company / product name | Group ERP / Datascapetek |
| Person confirming | ________________________ |
| Role (designer / manager / owner) | ________________________ |
| Date | ________________________ |
| I confirm the answers below are true to the best of my knowledge | ☐ Yes |

---

## Images that still need a “yes”

Git history shows these public images were first added by **Saneen** (`saneen.v@datascapetek.com`) on **2026-09-11** (“design update”). That is a helpful clue — still confirm officially below.

### A) Auth / marketing PNGs (used on login & register screens)

| # | File | Screen | Who made it? | Company owns it? | Notes (stock / AI / photo / original?) |
|---|------|--------|--------------|------------------|----------------------------------------|
| 1 | `frontend/public/images/erp-dashboard.png` | Login | ________ | ☐ Yes ☐ No ☐ Unsure | ________ |
| 2 | `frontend/public/images/organization-dashboard.png` | Register | ________ | ☐ Yes ☐ No ☐ Unsure | ________ |
| 3 | `frontend/public/images/email-verification.png` | Email verify | ________ | ☐ Yes ☐ No ☐ Unsure | ________ |
| 4 | `frontend/public/images/work-smarter.png` | Login | ________ | ☐ Yes ☐ No ☐ Unsure | ________ |

### B) Brand SVGs

| # | File | Screen | Who made it? | Company owns it? | Notes |
|---|------|--------|--------------|------------------|-------|
| 5 | `frontend/public/images/erp-logo.svg` | Logo everywhere | ________ | ☐ Yes ☐ No ☐ Unsure | ________ |
| 6 | `frontend/public/images/paper-plane.svg` | Email verify | ________ | ☐ Yes ☐ No ☐ Unsure | ________ |

---

## Already cleared in code (no form needed)

| File | Why OK |
|------|--------|
| `frontend/public/images/build-together.svg` | Text converted to paths (no system fonts) |
| `frontend/app/favicon.ico` + `app/icon.svg` | Rebuilt from `erp-logo.svg` (Phase B) |
| `frontend/design/*` mocks | Removed (unused) |
| Docs product screenshots | Our own app UI |

---

## After everyone says Yes

1. Change each row’s status in `docs/LICENSE_AUDIT.md` from “Ask designer” to **OK — company owned (see this form)**.
2. Keep this file in `docs/` (do not delete).

## If someone says No / Unsure

1. Do **not** ship that file as-is.
2. Replace with a company-made asset, **or** remove it from the auth UI.
3. Update the license audit again.

---

## One-line script for Slack / email

> Please confirm: the Group ERP auth images and logo SVGs listed in `docs/ASSET_OWNERSHIP_ATTESTATION.md` were created for Datascapetek / Group ERP (or we own the license). Reply Yes/No per file or sign the form.
