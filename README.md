# Sanad Waitlist API

Standalone pre-launch backend for the marketing site in `Waitlist/`.
Fully independent of `apps/api` — deploy this alone and the rest of the
platform code never runs.

## Endpoints

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/waitlist` | public (rate-limited, honeypot) | Email signup |
| `POST /api/waitlist/profile` | public (rate-limited) | Optional survey answers |
| `GET /api/cms/waitlist/stats` | admin | Dashboard statistics |
| `GET /api/cms/waitlist` | admin | Paginated entries + survey data |
| `PATCH /api/cms/waitlist/:id` | admin | Outreach status + notes |
| `DELETE /api/cms/waitlist/:id` | admin | Remove entry |
| `GET /api/auth/me` · `POST /api/auth/sync` | bearer | Dashboard admin gate |

Swagger: `/api/docs` (dev always; production only with `ENABLE_SWAGGER=true`).

## Run

```bash
pnpm install                              # from the repo root
pnpm --filter @sanad/waitlist-api dev     # local, port 3005
pnpm --filter @sanad/waitlist-api build && pnpm --filter @sanad/waitlist-api start
```

Copy `.env.example` → `.env` and fill it. Uses the same database and Supabase
project as the main platform, so the CMS dashboard at `/cms/waitlist` works
against this service by setting `NEXT_PUBLIC_API_URL` to its URL.

Point the marketing page at it via `window.WAITLIST_API_BASE` (or `API_BASE`
in `script.js`).

Notes:
- This service never creates users — admin sign-in works because the admin
  already exists in the shared database.
- The Prisma schema lives in `packages/database`; run `prisma generate` from
  the repo root if the client is missing.
