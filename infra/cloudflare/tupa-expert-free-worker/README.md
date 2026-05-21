# tupa-expert-free-worker

entity_id=cloudflare_tupa_expert_worker; type=production_worker; state=D1_KV_R2_runtime

## Runtime

- target_url=`https://xn--80a3aie.xn--p1ai/expert`
- root_policy=`/` is reserved for another site and must not be handled by this Worker route.
- storage=`D1(EXPERT_DB)+KV(EXPERT_KV)+R2(SITE_BUCKET)`
- auth=`Email OTP through Resend`
- agent=`OpenRouter OpenAI-compatible chat`
- deploy=`GitHub Actions push to main`

## Required GitHub Secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `RESEND_API_KEY`
- `OPENROUTER_API_KEY`
- `SESSION_SECRET`
- `OTP_PEPPER`

## Commands

```powershell
npm install
npm run build:safe
npm run check:worker
npm run check:frontend
npm run migrate:remote
npx.cmd wrangler deploy --dry-run --config wrangler.jsonc
```

## Production Data

- D1 tables store users, profiles, projects, assignments, drafts, submissions, reviews, OTP, sessions, agent threads, admin requests, and audit events.
- R2 prefix `tupa-expert-site/` stores public static assets.
- R2 prefix `expert-documents/` stores uploaded diplomas, certificates, and credentials.
- KV stores OTP rate limits and session cache only.

## Safety

- Worker does not call Yandex origins.
- Agent cannot directly mutate scores, submit forms, change admin configuration, or cross project boundaries.
- Secrets are not committed; Worker secrets are synced from GitHub Actions.
