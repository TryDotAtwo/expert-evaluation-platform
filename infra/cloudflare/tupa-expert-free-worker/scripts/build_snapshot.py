from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / "infra" / "cloudflare" / "tupa-expert-free-worker" / "public"

import os

os.chdir(ROOT)
os.environ.setdefault(
    "RUNTIME_STATE_PATH",
    str(ROOT / "infra" / "cloudflare" / "tupa-expert-free-worker" / ".tmp-state.json"),
)
os.environ.setdefault(
    "SEARCH_INDEX_PATH",
    str(ROOT / "infra" / "cloudflare" / "tupa-expert-free-worker" / ".tmp-search.json"),
)
sys.path.insert(0, str(ROOT))

from app.main import admin_quality_service  # noqa: E402
from app.main import admin_service  # noqa: E402
from app.main import auth_service  # noqa: E402
from app.main import import_export_service  # noqa: E402
from app.main import platform_service  # noqa: E402
from app.main import repository  # noqa: E402
from app.main import routing_service  # noqa: E402
from app.main import templates  # noqa: E402


DEMO_PASSWORDS = {
    "admin1": "admin123!",
    "expert1": "expert123!",
    "expert2": "expert123!",
    "reviewer1": "reviewer123!",
    "ops1": "ops123!",
    "auditor1": "auditor123!",
}


def user_payload(user):
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "role": user.role.value,
        "scopes": user.scopes,
    }


def build_index() -> str:
    html = (ROOT / "app" / "templates" / "index.html").read_text(encoding="utf-8")
    html = html.replace("{{ app_name }}", "Платформа оценки экспертами")
    html = html.replace("{{ base_path }}/static/css/app.css?v={{ asset_version }}", "/static/css/app.css?v=cloudflare-free")
    html = html.replace("{{ base_path }}/static/js/app.js?v={{ asset_version }}", "/static/js/app.js?v=cloudflare-free")
    html = html.replace("{{ base_path|tojson }}", '""')
    return html


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "static").mkdir(parents=True)
    shutil.copytree(ROOT / "app" / "static" / "css", OUT / "static" / "css")
    shutil.copytree(ROOT / "app" / "static" / "js", OUT / "static" / "js")
    (OUT / "index.html").write_text(build_index(), encoding="utf-8")

    users = {}
    for username, password in DEMO_PASSWORDS.items():
        user = auth_service.authenticate(username=username, password=password)
        if user is None:
            continue
        item = {
            "user": user_payload(user),
            "dashboard": platform_service.dashboard_for(user),
            "assignments": {},
        }
        for card in item["dashboard"].get("assignments", []):
            try:
                item["assignments"][card["id"]] = platform_service.assignment_detail(user, card["id"])
            except Exception:
                pass
        if user.role.value == "admin":
            item["admin_control_plane"] = admin_service.control_plane_payload(user)
            item["admin_routing"] = routing_service.routing_payload(user)
            item["admin_quality_center"] = admin_quality_service.quality_center_payload(user)
            item["admin_import_export"] = import_export_service.payload(user)
        users[username] = item

    snapshot = {
        "generated_for": "cloudflare_free_worker",
        "users": users,
        "help": [item.model_dump(mode="json") for item in repository.search_help_articles("")],
    }
    (OUT / "snapshot.json").write_text(
        json.dumps(snapshot, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
