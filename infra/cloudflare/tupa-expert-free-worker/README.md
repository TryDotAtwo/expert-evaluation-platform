# tupa-expert-free-worker

entity_id=cloudflare_tupa_expert_free_worker; type=cloudflare_worker_free_hosting; state=deployable_after_auth

## Назначение

- target=Cloudflare_Workers_Free
- role=host_expert_platform_without_yandex_origin
- runtime=JavaScript_Worker+Static_Assets
- source_snapshot=local_FastAPI_file_runtime
- yandex_dependency=false
- persistence=Worker_isolate_memory_for_mutations
- durable_persistence_next=D1_or_KV_after_cloudflare_account_auth

## Команды

```powershell
python scripts/build_snapshot.py
npx.cmd wrangler deploy --dry-run --config wrangler.jsonc
npx.cmd wrangler deploy --config wrangler.jsonc
```

## Ограничения

- FastAPI container removed from runtime path because Cloudflare Containers are not part of the free hosting path.
- Worker implements the frontend-required REST surface and serves the current static UI bundle.
- Write actions are accepted in Worker memory for demo continuity; production persistence requires D1/KV binding and migration of the portable state store.
- Worker never proxies to `xn--80a3aie.xn--p1ai` and never calls Yandex APIs.

## Yandex removal checklist

- deploy `tupa-expert-free-worker`;
- attach custom domain in Cloudflare zone;
- move `тупа.рф` nameservers from Yandex DNS to Cloudflare DNS;
- verify `https://тупа.рф/` or chosen route against Cloudflare Worker;
- disable Yandex API Gateway route `/expert`;
- delete Yandex Serverless Container `expert-eval-platform`;
- delete Yandex Container Registry image repository when no rollback needed;
- delete Yandex Managed OpenSearch cluster `expert-eval-search`;
- delete Yandex YDB database `for-expert-eval` only after export/backup acceptance;
- delete Yandex Lockbox secret `expert-eval-app-secret`;
- remove Yandex DNS zone after Cloudflare DNS propagation.
