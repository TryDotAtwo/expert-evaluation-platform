# Expert Evaluation Platform Cloudflare Worker

Public deployment repository for the expert platform available at:

- https://тупа.рф/expert

The repository intentionally contains only the Cloudflare Worker deployment surface:

- `.github/workflows/cloudflare-worker.yml`
- `infra/cloudflare/tupa-expert-free-worker`

No Yandex resources, backend runtime state, private test history, browser logs, local Wrangler state, or project memory files are included.

## Deploy

Required GitHub Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The workflow builds the safe R2 bundle, uploads static assets to R2, and deploys the Worker.
