const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-cloudflare-hosting-mode": "free-worker",
  "x-yandex-origin": "disabled",
};

const ASSET_PREFIX = "tupa-expert-site";
const ASSET_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const LEGAL_AREAS = [
  "Гражданское право",
  "Арбитраж",
  "Трудовое право",
  "Семейное право",
  "Налоговое право",
  "Административное право",
  "Интеллектуальные права",
];

const SYNTHETIC_SNAPSHOT = {
  users: {
    "admin@example.com": {
      user: { id: "demo-admin", username: "admin@example.com", role: "admin", display_name: "Cloudflare Demo Admin" },
      dashboard: { assignments: [] },
      assignments: {},
      admin_control_plane: { hosting: "cloudflare_worker", origin: "yandex_disabled", mode: "synthetic_demo" },
      admin_routing: { routes: [{ domain: "xn--80a3aie.xn--p1ai", worker: "tupa-expert-free-worker" }] },
      admin_quality_center: { checks: [{ id: "cloudflare-health", status: "active" }] },
      admin_import_export: { exports: [], imports: [] },
    },
    "expert@example.com": {
      user: { id: "demo-expert", username: "expert@example.com", role: "expert", display_name: "Cloudflare Demo Expert" },
      dashboard: { assignments: [] },
      assignments: {},
    },
  },
  help: [{ id: "cloudflare-mode", title: "Cloudflare Worker mode", body: "Synthetic demo data only. Yandex origin disabled." }],
};

const FALLBACK_INDEX_HTML = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>тупа.рф | Cloudflare Worker</title>
  <style>
    body{margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#111827}
    main{max-width:920px;margin:0 auto;padding:56px 24px}
    h1{font-size:32px;line-height:1.2;margin:0 0 16px}
    p{font-size:16px;line-height:1.55;margin:0 0 12px}
    code{background:#e5e7eb;border-radius:4px;padding:2px 6px}
    .panel{border:1px solid #d1d5db;border-radius:8px;background:white;padding:20px;margin-top:24px}
  </style>
</head>
<body>
  <main>
    <h1>тупа.рф работает через Cloudflare Worker</h1>
    <p>Yandex origin disabled. Current mode: script-only safe interim deployment.</p>
    <p>Health endpoint: <code>/health</code>. Demo login API: <code>admin@example.com</code> or <code>expert@example.com</code> with any non-empty password.</p>
    <div class="panel">Next step: upload full demo snapshot/assets after explicit external-data approval or replace snapshot with non-sensitive generated data.</div>
  </main>
</body>
</html>`;

let boot;
const registeredAccounts = new Map();
const agentThreads = new Map();
const adminRequests = [];
const PROJECT_REQUIRED_AREAS = {
  "civil-law-review": LEGAL_AREAS[0],
  "tax-claims": LEGAL_AREAS[4],
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function notFound() {
  return json({ detail: "Маршрут не найден" }, 404);
}

function forbidden() {
  return json({ detail: "Доступ запрещен" }, 403);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canJoinProject(account, projectId) {
  const requiredArea = PROJECT_REQUIRED_AREAS[projectId];
  if (!requiredArea) return true;
  return new Set(account.profile?.legal_areas || []).has(requiredArea);
}

async function loadState(env) {
  if (boot) return boot;
  const snapshotObject = await env.SITE_BUCKET.get(`${ASSET_PREFIX}/snapshot.json`);
  const snapshot = snapshotObject ? await snapshotObject.json() : SYNTHETIC_SNAPSHOT;
  const byToken = new Map();
  const mutableAssignments = new Map();
  for (const [username, account] of Object.entries(snapshot.users)) {
    byToken.set(`demo-${account.user.id}`, username);
    for (const [assignmentId, detail] of Object.entries(account.assignments || {})) {
      if (!mutableAssignments.has(assignmentId)) {
        mutableAssignments.set(assignmentId, clone(detail.assignment));
      }
    }
  }
  boot = { snapshot, byToken, mutableAssignments };
  return boot;
}

function contentType(path) {
  const match = path.match(/\.[^.]+$/);
  return ASSET_TYPES[match?.[0] || ""] || "application/octet-stream";
}

async function serveStatic(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname === "/expert" || url.pathname === "/expert/"
    ? "/index.html"
    : url.pathname;
  const cleanPath = pathname.replace(/^\/+/, "");
  if (!cleanPath || cleanPath.includes("..")) return notFound();

  const object = await env.SITE_BUCKET.get(`${ASSET_PREFIX}/${cleanPath}`);
  if (!object && cleanPath === "index.html") {
    return new Response(FALLBACK_INDEX_HTML, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60",
        "x-cloudflare-hosting-mode": "free-worker-script-only",
        "x-yandex-origin": "disabled",
      },
    });
  }
  if (!object) return notFound();

  const cacheControl = cleanPath.startsWith("static/")
    ? "public, max-age=31536000, immutable"
    : "public, max-age=60";
  return new Response(object.body, {
    headers: {
      "content-type": contentType(cleanPath),
      "cache-control": cacheControl,
      "x-cloudflare-hosting-mode": "free-worker-r2",
      "x-yandex-origin": "disabled",
    },
  });
}

function accountFromRequest(state, request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (registeredAccounts.has(token)) return registeredAccounts.get(token);
  const username = state.byToken.get(token);
  return username ? state.snapshot.users[username] : null;
}

function publicUser(account) {
  return clone(account.user);
}

function syntheticDashboard(account) {
  const joinedProjects = new Set(account.profile?.joined_projects || ["demo-project"]);
  const legalAreas = new Set(account.profile?.legal_areas || []);
  return {
    user: account.user,
    role: account.mode || account.user.role,
    summary: { assigned: 1, draft_saved: 0, submitted: 0, approved: 0 },
    projects: [
      {
        id: "demo-project",
        name: "Демо-проект",
        summary: "Синтетический стенд для экспертной оценки.",
        status: joinedProjects.has("demo-project") ? "active" : "available",
        accent: "ocean",
        task_type: "classification",
        counts: { assigned: 1 },
        access: "granted",
      },
      {
        id: "civil-law-review",
        name: "Гражданско-правовые споры",
        summary: "Проект для экспертов с гражданско-правовой компетенцией.",
        status: legalAreas.has("Гражданское право") ? "available" : "locked",
        accent: "sunset",
        task_type: "rubric_scorecard",
        counts: {},
        access: legalAreas.has("Гражданское право") ? "eligible" : "requires_area",
      },
      {
        id: "tax-claims",
        name: "Налоговые споры",
        summary: "Проект для экспертов с налоговой специализацией.",
        status: legalAreas.has("Налоговое право") ? "available" : "locked",
        accent: "gold",
        task_type: "classification",
        counts: {},
        access: legalAreas.has("Налоговое право") ? "eligible" : "requires_area",
      },
    ],
    assignments: account.dashboard?.assignments || [],
    support_requests: adminRequests.filter((item) => item.user_id === account.user.id),
    schema_previews: [],
    quality_summary: { global: [], projects: [] },
    reviewer_surface: {
      sections: account.profile?.wants_reviewer ? [{ id: "review-mode", title: "Режим проверяющего доступен" }] : [],
      counts: {},
    },
  };
}

function assignmentPatch(state, assignmentId) {
  return state.mutableAssignments.get(assignmentId);
}

function patchedDetail(state, detail) {
  const result = clone(detail);
  const patch = assignmentPatch(state, result.assignment.id);
  if (patch) {
    result.assignment = { ...result.assignment, ...clone(patch) };
    result.workflow = {
      ...result.workflow,
      canonical_status: result.assignment.status,
      stored_status: result.assignment.stored_status || result.assignment.status,
      available_transitions: result.assignment.available_transitions || result.workflow?.available_transitions || [],
    };
  }
  return result;
}

function patchedDashboard(state, account) {
  const dashboard = clone(account.dashboard);
  dashboard.assignments = (dashboard.assignments || []).map((card) => {
    const patch = assignmentPatch(state, card.id);
    if (!patch) return card;
    return {
      ...card,
      status: patch.status,
      stored_status: patch.stored_status || patch.status,
      revision: patch.revision,
      updated_at: patch.updated_at,
      completion: patch.completion || card.completion,
      available_transitions: patch.available_transitions || card.available_transitions,
    };
  });
  return dashboard;
}

function setAssignmentState(state, detail, patch) {
  const current = assignmentPatch(state, detail.assignment.id) || clone(detail.assignment);
  const next = {
    ...current,
    ...patch,
    revision: (current.revision || 0) + 1,
    updated_at: new Date().toISOString(),
  };
  state.mutableAssignments.set(detail.assignment.id, next);
  return patchedDetail(state, { ...detail, assignment: next });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function handleAgent(account, requestBody) {
  const message = String(requestBody.message || "").trim();
  const assignmentId = requestBody.assignment_id || null;
  const text = [
    "Cloudflare free worker mode: помощник работает без внешней LLM и без доступа к Яндексу.",
    assignmentId ? `Контекст задания: ${assignmentId}.` : "Контекст задания не выбран.",
    message ? `Запрос принят: ${message}` : "Пустой запрос не требует действия.",
    "Оценки и административные настройки помощник не изменяет.",
  ].join(" ");
  return json({
    message: text,
    actions: [],
    user_role: account.user.role,
  });
}

function adminMutationOk(resource) {
  return json({
    id: resource.id || `cloudflare-${Date.now()}`,
    status: "accepted_in_free_worker_demo",
    persisted: "memory_only",
  });
}

function handleAgentV2(account, requestBody) {
  const message = String(requestBody.message || "").trim();
  const assignmentId = requestBody.assignment_id || null;
  const threadKey = account.user.id;
  const thread = agentThreads.get(threadKey) || [];
  const needsAdmin = /админ|поддерж|оператор|связ/i.test(message);
  thread.push({ role: "user", text: message, created_at: new Date().toISOString() });
  if (needsAdmin) {
    adminRequests.push({
      id: `admin-request-${Date.now()}`,
      user_id: account.user.id,
      status: "new",
      message,
      created_at: new Date().toISOString(),
    });
  }
  const text = [
    "Помощник работает в Cloudflare Worker: хранит краткую историю диалога, сжимает контекст до последних сообщений и готов к OpenAI Agents SDK через секрет OPENAI_API_KEY.",
    assignmentId ? `Контекст задания: ${assignmentId}.` : "Контекст задания не выбран.",
    message ? `Запрос принят: ${message}` : "Пустой запрос не требует действия.",
    needsAdmin ? "Обращение администратору создано." : "Помощник может объяснить задание, предложить следующий шаг, подготовить обращение администратору и подсказать поиск.",
  ].join(" ");
  thread.push({ role: "assistant", text, created_at: new Date().toISOString() });
  agentThreads.set(threadKey, thread.slice(-12));
  return json({
    message: text,
    memory: agentThreads.get(threadKey),
    actions: needsAdmin ? [{ type: "admin_request_created" }] : [],
    user_role: account.user.role,
  });
}

async function handleApi(request, env) {
  const state = await loadState(env);
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/health") return json({ status: "ok", hosting: "cloudflare_free_worker" });
  if (path === "/api/meta" && request.method === "GET") return json({ legal_areas: LEGAL_AREAS });
  if (path === "/api/register" && request.method === "POST") {
    const body = await readJson(request);
    const username = String(body.username || body.email || "").trim();
    if (!username || !String(body.password || "").trim()) return json({ detail: "Заполните логин и пароль" }, 400);
    const id = `expert-${Math.random().toString(36).slice(2, 10)}`;
    const seedAccount = state.snapshot.users.expert1 || SYNTHETIC_SNAPSHOT.users["expert@example.com"];
    const account = {
      user: {
        id,
        username,
        display_name: String(body.display_name || username).trim(),
        role: body.wants_reviewer ? "reviewer" : "expert",
        scopes: body.wants_reviewer ? ["score", "review"] : ["score"],
      },
      mode: body.wants_reviewer ? "reviewer" : "expert",
      profile: {
        email: String(body.email || username).trim(),
        credentials: String(body.credentials || "").trim(),
        certificates: String(body.certificates || "").trim(),
        legal_areas: Array.isArray(body.legal_areas) ? body.legal_areas : [],
        wants_reviewer: Boolean(body.wants_reviewer),
        joined_projects: ["demo-project"],
      },
      dashboard: { assignments: clone(seedAccount.dashboard?.assignments || []) },
      assignments: clone(seedAccount.assignments || {}),
    };
    const token = `demo-${id}`;
    registeredAccounts.set(token, account);
    return json({ token, user: publicUser(account), profile: account.profile });
  }
  if (path === "/api/auth/login" && request.method === "POST") {
    const body = await readJson(request);
    const username = String(body.username || "").trim();
    const account = state.snapshot.users[username];
    if (!account || !String(body.password || "").trim()) {
      return json({ detail: "Неверный логин или пароль" }, 401);
    }
    return json({ token: `demo-${account.user.id}`, user: publicUser(account) });
  }

  const account = accountFromRequest(state, request);
  if (!account) return json({ detail: "Missing bearer token" }, 401);

  if (path === "/api/session") return json({ user: publicUser(account) });
  if (path === "/api/dashboard") return json(account.profile ? syntheticDashboard(account) : patchedDashboard(state, account));
  if (path === "/api/expert/profile" && request.method === "GET") {
    return json({ profile: account.profile || { legal_areas: [], credentials: "", certificates: "", wants_reviewer: account.user.role === "reviewer", joined_projects: ["demo-project"] }, legal_areas: LEGAL_AREAS });
  }
  if (path === "/api/expert/profile" && request.method === "POST") {
    const body = await readJson(request);
    account.profile = { ...(account.profile || {}), ...body, legal_areas: Array.isArray(body.legal_areas) ? body.legal_areas : account.profile?.legal_areas || [] };
    if (typeof body.wants_reviewer === "boolean") {
      account.user.role = body.wants_reviewer ? "reviewer" : "expert";
      account.mode = account.user.role;
    }
    return json({ user: publicUser(account), profile: account.profile });
  }
  if (path === "/api/projects/join" && request.method === "POST") {
    const body = await readJson(request);
    const projectId = String(body.project_id || "").trim();
    if (!canJoinProject(account, projectId)) {
      return json({ detail: "Проект доступен только экспертам с подходящей областью права", project_id: projectId }, 403);
    }
    const joined = new Set(account.profile?.joined_projects || ["demo-project"]);
    joined.add(projectId);
    account.profile = { ...(account.profile || {}), joined_projects: Array.from(joined) };
    adminRequests.push({ id: `project-join-${Date.now()}`, user_id: account.user.id, status: "new", project_id: projectId, message: "Запрос подключения к проекту", created_at: new Date().toISOString() });
    return json({ status: "requested", project_id: projectId, profile: account.profile });
  }
  if (path === "/api/mode" && request.method === "POST") {
    const body = await readJson(request);
    const mode = body.mode === "reviewer" && (account.profile?.wants_reviewer || account.user.role === "reviewer") ? "reviewer" : "expert";
    account.mode = mode;
    return json({ mode });
  }
  if (path === "/api/admin/control-plane") return account.user.role === "admin" ? json(clone(account.admin_control_plane)) : forbidden();
  if (path === "/api/admin/routing") return account.user.role === "admin" ? json(clone(account.admin_routing)) : forbidden();
  if (path === "/api/admin/quality-center") return account.user.role === "admin" ? json(clone(account.admin_quality_center)) : forbidden();
  if (path === "/api/admin/import-export") return account.user.role === "admin" ? json(clone(account.admin_import_export)) : forbidden();
  if (path === "/api/agent/chat" && request.method === "POST") return handleAgentV2(account, await readJson(request));
  if (path === "/api/help") return json({ items: clone(state.snapshot.help || []) });
  if (path === "/api/help/search") {
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const items = (state.snapshot.help || []).filter((item) => JSON.stringify(item).toLowerCase().includes(q));
    return json({ items });
  }

  const assignmentMatch = path.match(/^\/api\/assignments\/([^/]+)(?:\/([^/]+))?$/);
  if (assignmentMatch) {
    const [, assignmentId, action] = assignmentMatch;
    const detail = account.assignments?.[assignmentId];
    if (!detail) return notFound();
    if (!action && request.method === "GET") return json(patchedDetail(state, detail));
    if (action === "claim" && request.method === "POST") {
      return json(setAssignmentState(state, detail, { status: "claimed", stored_status: "claimed", available_transitions: ["save_draft", "submit"] }));
    }
    if (action === "draft" && request.method === "POST") {
      const body = await readJson(request);
      return json(setAssignmentState(state, detail, { status: "draft_saved", stored_status: "draft_saved", draft: body.payload || {}, available_transitions: ["save_draft", "submit"] }));
    }
    if (action === "submit" && request.method === "POST") {
      const body = await readJson(request);
      return json(setAssignmentState(state, detail, { status: "submitted", stored_status: "submitted", draft: body.payload || {}, submitted_payload: body.payload || {}, submitted_at: new Date().toISOString(), available_transitions: [] }));
    }
    if (action === "review" && request.method === "POST") {
      const body = await readJson(request);
      const status = body.outcome === "needs_rework" ? "needs_rework" : "approved";
      return json(setAssignmentState(state, detail, { status, stored_status: status, available_transitions: [] }));
    }
    if (action === "adjudicate" && request.method === "POST") {
      return json(setAssignmentState(state, detail, { status: "approved", stored_status: "approved", available_transitions: [] }));
    }
  }

  if (path === "/api/assignments" && request.method === "GET") {
    return json({ items: patchedDashboard(state, account).assignments || [] });
  }

  if (account.user.role === "admin" && request.method === "POST" && path.startsWith("/api/admin/")) {
    return adminMutationOk(await readJson(request));
  }

  return notFound();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/Expert" || url.pathname === "/Expert/") return Response.redirect(`${url.origin}/expert`, 302);
    if (url.pathname.startsWith("/api/") || url.pathname === "/health") return handleApi(request, env);
    return serveStatic(request, env);
  },
};
