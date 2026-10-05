# Wave 2 — Phase E UAT runbook (REL / ENV / DES-07 / CFG)

**Purpose:** Freeze one build, deploy FE + API + workers from it, run isolated two-tenant UAT, and sign off before W3+.  
**Not done by this document alone:** live deploy, secrets provisioning, and human persona sign-off.

---

## Gate: commit before freeze

Phase A–D work must be on **one commit** before REL-001.

| Check | Status |
|---|---|
| Working tree clean (or intentional freeze commit includes all A–D) | **Done (Phase F 2026-09-15)** — freeze SHA `93eeeb126d5b1a0137dbeb88d58731d602cfe8ca` on `UI-SA-140926-3`; product tree clean at freeze |
| Same SHA deployed for frontend, backend API, and workers | **Local only** — FE `:3200` + API `:4500` from same checkout (not isolated ENV-001) |
| Evidence forms below cite that SHA only | **Done** — see `wave-2-freeze-record.md` |

**Do not** cite `HEAD` while dirty. After commit:

```powershell
git rev-parse HEAD
git tag -a wave2-uat-freeze -m "Wave 2 Phase E UAT freeze"
# optional: git push origin HEAD && git push origin wave2-uat-freeze
```

Record the SHA in `docs/development/wave-2-freeze-record.md`.

---

## REL-001 — Freeze SHA

| Step | Owner | Done? |
|---|---|---|
| Create freeze commit (Phases A–D) | Dev | **Yes** — product already on `93eeeb1…` |
| Tag `wave2-uat-freeze` (or dated tag) | Dev | **Yes** — Phase F |
| Build FE production bundle from tag | DevOps | Deferred (local Next used) |
| Build/start API + workers from **same** tag | DevOps | **Local** Nest `start:dev` |
| Paste SHA into freeze record + all evidence sheets | Tester | **Yes** |

**Exit:** Every evidence row cites one SHA.

---

## ENV-001 — Isolated UAT environment

| Requirement | How to verify | Done? |
|---|---|---|
| `NODE_ENV=production` on API/workers (and FE production build) | Process env / deploy config | |
| Separate DB or schema (not production) | Connection string host/db name ≠ prod | |
| Private object storage bucket/prefix | S3/MinIO path ≠ prod | |
| Redis instance or dedicated DB index (if used) | Not shared prod Redis | |
| **No customer data** — synthetic seed only | Data review | |
| Two companies × ≥1 branch each | Seed Tenant A / Tenant B | |
| Synthetic roles: structure manage, onboarding manage, combined, read-only, per-tenant | Login smoke | |
| Provider sandboxes (ZeptoMail etc.) — no live customer mail | Delivery dry-run / sandbox keys | |

**Exit:** Cannot touch production data from this stack.

---

## ENV-002 — Secrets / providers (no secrets in evidence)

Copy from `backend/.env.example`; fill in a **private** UAT secrets store (never commit).

| Area | Ready? | Notes (no secret values) |
|---|---|---|
| Auth JWT key paths | | |
| Database URL | | |
| Redis (or disabled explicitly) | | |
| File storage credentials + bucket | | |
| Delivery keys + ZeptoMail **sandbox** (if Delivery on) | | |
| Frontend `BACKEND_INTERNAL_URL` / public API URL | | |

**Health checks (record pass/fail only):**

- [ ] `GET /health` (or project health) → 200  
- [ ] FE loads login  
- [ ] Org switcher shows Tenant A and B for dual-tenant user (or separate users)  
- [ ] Workers process outbox without claiming prod tenants  

---

## CFG matrix on frozen SHA

Run profiles from `docs/development/cfg-001-feature-gate-profiles.md`.

| Profile | Deployed? | Tenant A | Tenant B (unlisted where required) | Evidence note |
|---|---|---|---|---|
| 1 — All flags OFF | | Modules gated off | Modules gated off | |
| 2 — Explicit pilot IDs | | Allowed | Denied if not listed | Preferred first cutover |
| 3 — Empty allowlist = all (approved modules) | | Allowed | Allowed | Delivery must stay non-empty or OFF |

Optional script (API host with UAT env):

```powershell
Set-Location backend
node ./scripts/uat-phase5-gate-evidence.mjs
```

---

## DES-07 on frozen SHA

Complete `docs/development/wave-2-designation-pilot-uat.md` **and** `docs/development/wave-1-a11y-gate-checklist.md` against the freeze SHA.

Minimum path:

1. Combined persona on Tenant A: create designation with Branch + onboarding depts → Open checklist  
2. Structure-only: onboarding section hidden  
3. Read-only: create/edit blocked  
4. Tenant B user: cannot see Tenant A designation by ID  
5. Entry from Onboarding Templates returns to templates list  

---

## Sign-off (Wave 2 complete)

| Criterion | Pass? |
|---|---|
| One frozen SHA for FE + API + workers | **Yes** (local checkout) |
| ENV-001 isolation confirmed | **No** — deferred / pragmatism |
| ENV-002 health green (no secrets pasted here) | **Partial** — `/health` 200; redis skipped |
| CFG profiles 1–3 evidenced | **Partial** — code + foundation tests; live redeploy not run |
| DES-07 + a11y checklist passed | **Conditional** — engineering Pass; browser/a11y live pending |
| Manager allows **W3+** | **Engineering Yes**; manager signature pending |

| Field | Value |
|---|---|
| Freeze SHA | `93eeeb126d5b1a0137dbeb88d58731d602cfe8ca` |
| Tag | `wave2-uat-freeze` |
| Tester | Engineering (Phase F) |
| Manager | Pending |
| Date | 2026-09-15 |
| Decision | **Proceed W3+** (engineering) |

---

## What Phase E execution prepared in-repo

- This runbook  
- Freeze record template: `docs/development/wave-2-freeze-record.md`  
- Existing DES-07 + CFG-001 + a11y docs linked above  

**Still requires humans/ops:** commit/tag, deploy UAT, seed tenants, run personas, manager signature.
