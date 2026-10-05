# Wave 2 — Freeze record (REL-001)

Filled for **Phase F** (2026-09-15). Product code freeze identity is the SHA below. Evidence docs may land in a later commit that **cites** this SHA.

---

## Freeze identity

| Field | Value |
|---|---|
| Branch | `UI-SA-140926-3` |
| Commit SHA (full) | `93eeeb126d5b1a0137dbeb88d58731d602cfe8ca` |
| Annotated tag | `wave2-uat-freeze` |
| Freeze date (UTC) | 2026-09-15 |
| Frozen by | Engineering (Phase F execution) |

### Capture commands

```powershell
git status
git rev-parse HEAD
git log -1 --format="%H %s"
git tag -a wave2-uat-freeze -m "Wave 2 Phase F UAT freeze"
```

**At freeze time:** Working tree had only untracked `docs/development/wave-2-to-wave-5-execution-plan.md` (planning for W3–W5). No dirty Phase A–D product files. Message on SHA: `design update 4`.

---

## Deploy matrix (same SHA)

| Component | Image / artifact / path | SHA verified | Deployed at |
|---|---|---|---|
| Frontend (Next) | Local `pnpm` / `:3200` (dev) | `93eeeb1…` via checkout | 2026-09-15 local |
| Backend API | Local `pnpm run start:dev` / `:4500` | `93eeeb1…` via checkout | 2026-09-15 local |
| Workers / schedulers | Same Nest process (workforce jobs logging) | Same | 2026-09-15 local |

**Note:** Full isolated production-like UAT stack (ENV-001) was **not** provisioned this session. Local/dev stack used under Wave 2→5 pragmatism note.

---

## Linked evidence

| Pack | Path | Result |
|---|---|---|
| Phase E runbook | `docs/development/wave-2-phase-e-uat-runbook.md` | Updated Phase F status |
| CFG-001 profiles | `docs/development/cfg-001-feature-gate-profiles.md` | Code + foundation tests; live 3-profile deploy not run |
| DES-07 | `docs/development/wave-2-designation-pilot-uat.md` | Engineering verification Pass; multi-persona browser pending |
| A11y | `docs/development/wave-1-a11y-gate-checklist.md` | Code-path review; live keyboard/zoom pending |

---

## Health / CFG smoke (this env)

| Check | Result |
|---|---|
| `GET http://localhost:4500/health` | **200** — `database: up`, `redis: skipped` |
| `GET http://localhost:3200/login` | **200** |
| `jest --config test/jest-foundation.json --testPathPatterns=environment` | **18 passed** |
| CFG-002 Delivery empty fail-closed | Present in `environment.ts` (boot throws) |
| CFG-003 Payroll ⊆ Finance | Present in `environment.ts` (boot throws) |
| Live Profile 1 / 2 / 3 redeploy | **Not run** (would require restart with alternate env) |

---

## Decision

| Field | Value |
|---|---|
| UAT result | **Conditional Pass** — engineering + local health; not full ENV-001 / multi-persona browser |
| Manager sign-off | **Pending** (browser DES-07 personas + a11y Must list) |
| Proceed to W3+ | **Yes (engineering)** — allowed under Phase F pragmatism; manager may still re-run DES-07 on isolated UAT |
| Hold reasons | None for engineering start of Wave 3. Remaining: ENV-001 isolation, Profile 1–3 live matrix, persona browser DES-07, a11y live Must |
