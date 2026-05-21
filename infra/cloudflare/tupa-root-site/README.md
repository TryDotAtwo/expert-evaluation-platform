# tupa-root-site

Минимальный статический корень `https://тупа.рф/`.

Cloudflare Worker `tupa-root-site` отдает только `/` и не обслуживает `/expert`, `/api` или `/static`.
Платформа экспертов остается в отдельном Worker `tupa-expert-free-worker`.
