# REC-001 — Recruitment production flag matrix

**Wave 7 / Phase S**  
**Status:** Engineering complete — set live values in each deploy environment (ENV-002).

## Backend (Nest boot)

Validated in `assertRecruitmentFlagMatrix` during `validateEnvironment`.

| Flag | Default | Rule |
|---|---|---|
| `RECRUITMENT_ENABLED` | `false` | Master switch for internal recruitment API + menus |
| `PUBLIC_CAREERS_ENABLED` | `false` | Requires `RECRUITMENT_ENABLED=true` |
| `RECRUITMENT_SHORTLIST_ENABLED` | `false` | Requires `RECRUITMENT_ENABLED=true`; optional `RECRUITMENT_SHORTLIST_ALLOWLIST_JSON` |
| `RECRUITMENT_USE_MOCK` | — | **Always rejected** if truthy (mock is frontend-only) |
| `DELIVERY_V2_ENABLED` | `false` | In **production**, also requires `RECRUITMENT_ENABLED=true` when delivery is on |

Unsafe combinations fail process startup with `EnvironmentValidationError`.

## Frontend (Next)

Business and module availability is evaluated by backend capability APIs, rather
than by browser-build environment variables. Authenticated navigation uses
`GET /me/module-capabilities`; public careers uses `GET /auth/capabilities`.

| Setting | Default | Rule |
|---|---|---|
| `NEXT_PUBLIC_RECRUITMENT_USE_MOCK` | off | Development-only local data; forced **off** when `NODE_ENV=production` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | unset | Public, browser-visible Turnstile site key; required for production public applications |

## Recommended production matrix (first cutover)

```env
# Backend
RECRUITMENT_ENABLED=true
PUBLIC_CAREERS_ENABLED=true   # or false until careers go live
RECRUITMENT_SHORTLIST_ENABLED=false
DELIVERY_V2_ENABLED=false
# never set RECRUITMENT_USE_MOCK

# Frontend development only
NEXT_PUBLIC_RECRUITMENT_USE_MOCK=false
```

Enable shortlist / delivery only after allowlists, ZeptoMail, and S3/ClamAV are ready.

## Fail-closed UX

| Scope off | UI | API |
|---|---|---|
| Recruitment | Sidebar items hidden; feature gate empty states | `RecruitmentFeatureGuard` rejects |
| Public careers | `/careers` empty / not found | Public careers guard rejects |
| Shortlist | Shortlist button hidden | Shortlist gate / feature disabled codes |
| Delivery nav | Delivery menu hidden | Delivery still gated by `DELIVERY_V2_*` + permissions |
| Mock | Banner never shown in production builds | N/A on backend |

## Your deploy checklist

1. Set backend flags before starting Nest.
2. Rebuild frontend without module rollout values; it reads backend capabilities at runtime.
3. Confirm mock banner absent on production URL.
4. Confirm careers / shortlist / delivery match intended rollout stage.
