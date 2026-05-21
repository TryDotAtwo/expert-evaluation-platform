import { EMBEDDED_SAFE_ASSETS } from "./embedded_safe_assets.js";

const ASSET_PREFIX = "tupa-expert-site";
const DOCUMENT_PREFIX = "expert-documents";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const OTP_TTL_SECONDS = 10 * 60;
const MAX_AGENT_MESSAGES = 12;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_ITERATIONS = 120000;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-cloudflare-hosting-mode": "production-worker-d1-r2-kv",
  "x-yandex-origin": "disabled",
};

const ASSET_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
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

const AGENT_POLICY = {
  base: "openrouter_openai_compatible_chat",
  memory: "d1_agent_threads_last_messages_plus_summary",
  allowed_actions: ["explain_task", "check_gaps", "prepare_admin_request", "search_public_web"],
  forbidden_actions: ["score_mutation", "admin_config_mutation", "silent_submit", "cross_project_data_access"],
};

function nowIso() {
  return new Date().toISOString();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function error(status, detail, extra = {}) {
  return json({ detail, ...extra }, status);
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function contentType(path) {
  const match = path.match(/\.[^.]+$/);
  return ASSET_TYPES[match?.[0] || ""] || "application/octet-stream";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function adminEmails(env) {
  return new Set(String(env.ADMIN_EMAILS || "").split(",").map(normalizeEmail).filter(Boolean));
}

function textEncoder() {
  return new TextEncoder();
}

function randomHex(bytes = 16) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

function randomDigits(length = 6) {
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => String(value % 10)).join("");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

async function otpHash(env, email, otp) {
  return sha256Hex(`${email}:${otp}:${env.OTP_PEPPER || "missing-otp-pepper"}`);
}

async function tokenHash(env, token) {
  return sha256Hex(`${token}:${env.SESSION_SECRET || "missing-session-secret"}`);
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const normalized = String(hex || "");
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function derivePassword(password, saltHex, iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder().encode(String(password || "")),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

async function passwordHash(password) {
  const salt = randomHex(16);
  const hash = await derivePassword(password, salt);
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

async function verifyPassword(password, storedHash) {
  const parts = String(storedHash || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations) || iterations < 10000) return false;
  const actual = await derivePassword(password, parts[2], iterations);
  return constantTimeEqual(actual, parts[3]);
}

async function readJson(request) {
  if (!request.body) return {};
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function audit(env, userId, action, entityType, entityId, metadata = {}) {
  await env.EXPERT_DB.prepare(
    "INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(randomHex(12), userId || null, action, entityType, entityId, JSON.stringify(metadata), nowIso()).run();
}

async function kvGet(env, key) {
  if (!env.EXPERT_KV) return null;
  return env.EXPERT_KV.get(key);
}

async function kvPut(env, key, value, expirationTtl) {
  if (!env.EXPERT_KV) return;
  await env.EXPERT_KV.put(key, value, { expirationTtl });
}

async function kvDelete(env, key) {
  if (!env.EXPERT_KV) return;
  await env.EXPERT_KV.delete(key);
}

function projectSeedRows() {
  return [
    ["civil-classification", "Классификация обращения", "Определение правовой области, категории риска и маршрута обработки.", "Гражданское право", "classification", "active", "teal"],
    ["rubric-legal-answer", "Оценка правового ответа", "Рубричная проверка полноты, точности и применимости правового анализа.", "Арбитраж", "rubric_scorecard", "active", "amber"],
    ["pairwise-analysis", "Сравнение двух заключений", "Выбор более качественного экспертного заключения с обоснованием.", "Налоговое право", "pairwise_preference", "active", "blue"],
    ["triplet-similarity", "Близость правовых позиций", "Определение текста, который ближе к эталонной правовой позиции.", "Интеллектуальные права", "triplet_similarity", "active", "violet"],
  ];
}

async function ensureProjects(env) {
  const first = await env.EXPERT_DB.prepare("SELECT id FROM projects LIMIT 1").first();
  if (first) return;
  const createdAt = nowIso();
  await env.EXPERT_DB.batch(projectSeedRows().map((row) => env.EXPERT_DB.prepare(
    "INSERT OR IGNORE INTO projects (id, name, summary, required_area, task_type, status, accent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(...row, createdAt)));
}

function taskPayloadFor(type) {
  if (type === "classification") {
    return {
      headline: "Классификация правового обращения",
      prompt: "Определите область права, категорию риска и маршрут дальнейшей обработки.",
      source_text: "Заявитель получил отказ в возврате аванса по договору оказания услуг. Исполнитель ссылается на внутренний регламент, но акт выполненных работ не подписан.",
      options: [
        { id: "civil_contract", title: "Гражданско-правовой договор", description: "Спор о договоре, оплате, возврате средств или качестве услуг." },
        { id: "consumer", title: "Защита прав потребителя", description: "Услуга приобреталась для личных целей, есть требование возврата." },
        { id: "administrative", title: "Административная жалоба", description: "Спор связан с государственным органом или публичной процедурой." },
      ],
      confidence_scale: [1, 2, 3, 4, 5],
    };
  }
  if (type === "rubric_scorecard") {
    return {
      headline: "Рубричная оценка правового ответа",
      prompt: "Оцените полноту и надежность ответа по критериям. Укажите доказательные фрагменты.",
      source_text: "В деле о взыскании неустойки суд снизил размер ответственности по статье 333 ГК РФ. Эксперт должен проверить, объяснен ли критерий несоразмерности и приведены ли факты дела.",
      model_answer: "Суд вправе снизить неустойку, если сумма явно несоразмерна последствиям нарушения. Нужно оценить период просрочки, поведение сторон, размер основного долга и доказательства убытков.",
      criteria: [
        { id: "law_accuracy", label: "Точность права", scale: [1, 2, 3, 4, 5] },
        { id: "fact_binding", label: "Связь с фактами", scale: [1, 2, 3, 4, 5] },
        { id: "actionability", label: "Практическая применимость", scale: [1, 2, 3, 4, 5] },
      ],
    };
  }
  if (type === "pairwise_preference") {
    return {
      headline: "Сравнение двух экспертных заключений",
      prompt: "Выберите заключение, которое лучше помогает эксперту принять решение.",
      question: "Какой ответ корректнее объясняет перспективу взыскания судебных расходов?",
      option_a: "Расходы можно взыскать всегда, если сторона выиграла дело. Суд не проверяет размер расходов.",
      option_b: "Расходы взыскиваются с проигравшей стороны, но суд оценивает разумность, связь расходов с делом и подтверждающие документы.",
      confidence_scale: [1, 2, 3, 4, 5],
    };
  }
  return {
    headline: "Близость правовых позиций",
    prompt: "Выберите текст, который ближе к исходной правовой позиции.",
    anchor: "Правообладатель может требовать компенсацию за незаконное использование товарного знака без доказывания размера убытков.",
    positive: "При нарушении исключительного права на товарный знак компенсация может взыскиваться как самостоятельная мера защиты без расчета убытков.",
    negative: "Компенсация выплачивается только после доказательства точного размера понесенных убытков по бухгалтерским документам.",
    confidence_scale: [1, 2, 3, 4, 5],
  };
}

function dueForIndex(index) {
  const date = new Date();
  date.setDate(date.getDate() + index);
  date.setHours(18, 0, 0, 0);
  return date.toISOString();
}

async function ensureUserAssignments(env, user) {
  await ensureProjects(env);
  const projects = await env.EXPERT_DB.prepare("SELECT * FROM projects ORDER BY created_at, id").all();
  const createdAt = nowIso();
  const statements = [];
  let index = 0;
  for (const project of projects.results || []) {
    index += 1;
    const id = `${user.id}-${project.id}`;
    const payload = taskPayloadFor(project.task_type);
    statements.push(env.EXPERT_DB.prepare(
      "INSERT OR IGNORE INTO assignments (id, user_id, project_id, task_type, task_title, status, stored_status, revision, due_at, priority, payload_json, draft_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      id,
      user.id,
      project.id,
      project.task_type,
      payload.headline,
      index === 2 ? "draft_saved" : "assigned",
      index === 2 ? "in_progress" : "queued",
      index === 2 ? 1 : 0,
      dueForIndex(index),
      index === 1 ? "high" : "normal",
      JSON.stringify(payload),
      index === 2 ? JSON.stringify({ note: "Черновик создан для проверки сохранения состояния." }) : "{}",
      createdAt,
      createdAt
    ));
    statements.push(env.EXPERT_DB.prepare(
      "INSERT OR IGNORE INTO project_memberships (user_id, project_id, status, created_at) VALUES (?, ?, ?, ?)"
    ).bind(user.id, project.id, "active", createdAt));
  }
  if (statements.length) await env.EXPERT_DB.batch(statements);
}

async function getUserByEmail(env, email) {
  return env.EXPERT_DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
}

async function getUserById(env, id) {
  return env.EXPERT_DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
}

async function getProfile(env, userId) {
  return env.EXPERT_DB.prepare("SELECT * FROM profiles WHERE user_id = ?").bind(userId).first();
}

async function getApplicationByEmail(env, email) {
  return env.EXPERT_DB.prepare("SELECT * FROM registration_applications WHERE email = ?").bind(email).first();
}

async function ensureProfileForUser(env, user, application = null) {
  const createdAt = nowIso();
  const legalAreas = application ? safeJsonParse(application.legal_areas_json, []) : LEGAL_AREAS;
  const wantsReviewer = application ? Boolean(application.wants_reviewer) : user.role === "reviewer";
  const coauthorConsent = application ? Boolean(application.coauthor_consent) : false;
  const adminCredentials = application?.admin_credentials_text || "";
  await env.EXPERT_DB.prepare(
    "INSERT INTO profiles (user_id, legal_areas_json, credentials_text, certificates_text, wants_reviewer, mode, created_at, updated_at, coauthor_consent, admin_credentials_text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET legal_areas_json = excluded.legal_areas_json, wants_reviewer = excluded.wants_reviewer, mode = excluded.mode, updated_at = excluded.updated_at, coauthor_consent = excluded.coauthor_consent, admin_credentials_text = excluded.admin_credentials_text"
  ).bind(
    user.id,
    JSON.stringify(legalAreas),
    "",
    "",
    wantsReviewer ? 1 : 0,
    "expert",
    createdAt,
    createdAt,
    coauthorConsent ? 1 : 0,
    adminCredentials
  ).run();
}

async function createUserFromApplication(env, application) {
  const existing = await getUserByEmail(env, application.email);
  const role = application.wants_reviewer ? "reviewer" : "expert";
  const updatedAt = nowIso();
  let user = existing;
  if (existing) {
    await env.EXPERT_DB.prepare(
      "UPDATE users SET display_name = ?, role = CASE WHEN role = 'admin' THEN 'admin' ELSE ? END, password_hash = ?, status = 'active', auth_provider = 'password', updated_at = ? WHERE id = ?"
    ).bind(application.display_name, role, application.password_hash, updatedAt, existing.id).run();
    user = await getUserById(env, existing.id);
  } else {
    const id = `user-${randomHex(8)}`;
    await env.EXPERT_DB.prepare(
      "INSERT INTO users (id, email, display_name, role, created_at, updated_at, password_hash, status, auth_provider) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, application.email, application.display_name, role, updatedAt, updatedAt, application.password_hash, "active", "password").run();
    user = await getUserById(env, id);
  }
  await ensureProfileForUser(env, user, application);
  await ensureUserAssignments(env, user);
  return user;
}

async function createUserIfMissing(env, email) {
  const existing = await getUserByEmail(env, email);
  if (existing) return existing;
  const approvedApplication = await getApplicationByEmail(env, email);
  if (approvedApplication?.status === "approved") return createUserFromApplication(env, approvedApplication);
  if (!adminEmails(env).has(email)) return null;
  const createdAt = nowIso();
  const id = `user-${randomHex(8)}`;
  const role = "admin";
  const displayName = email.split("@")[0] || "Эксперт";
  await env.EXPERT_DB.prepare(
    "INSERT INTO users (id, email, display_name, role, created_at, updated_at, status, auth_provider) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, email, displayName, role, createdAt, createdAt, "active", "otp").run();
  const user = await getUserById(env, id);
  await ensureProfileForUser(env, user);
  await ensureUserAssignments(env, user);
  await audit(env, id, "user.created", "user", id, { email, role });
  return user;
}

async function accountFromRequest(env, request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const hash = await tokenHash(env, token);
  const cachedUserId = await kvGet(env, `session:${hash}`);
  let session = null;
  if (cachedUserId) {
    session = await env.EXPERT_DB.prepare("SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?").bind(hash, nowIso()).first();
  } else {
    session = await env.EXPERT_DB.prepare("SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?").bind(hash, nowIso()).first();
    if (session) await kvPut(env, `session:${hash}`, session.user_id, SESSION_TTL_SECONDS);
  }
  if (!session) return null;
  await env.EXPERT_DB.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").bind(nowIso(), session.id).run();
  const user = await getUserById(env, session.user_id);
  if (!user) return null;
  if (user.status && user.status !== "active") return null;
  if (adminEmails(env).has(user.email) && user.role !== "admin") {
    user.role = "admin";
    await env.EXPERT_DB.prepare("UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?").bind(nowIso(), user.id).run();
  }
  const profile = await getProfile(env, user.id);
  return { user, profile, session, tokenHash: hash };
}

function publicUser(user, profile) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    mode: profile?.mode || "expert",
    wants_reviewer: Boolean(profile?.wants_reviewer),
    coauthor_consent: Boolean(profile?.coauthor_consent),
  };
}

async function sendEmail(env, { to, subject, text, html }) {
  if (env.ALLOW_DEV_OTP === "true") return { delivered: false, dev: true };
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY missing");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM || "Expert Platform <onboarding@resend.dev>",
      to: [to],
      subject,
      text,
      html,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`resend_failed:${response.status}:${detail.slice(0, 200)}`);
  }
  return { delivered: true };
}

async function sendOtpEmail(env, email, otp) {
  const result = await sendEmail(env, {
    to: email,
    subject: "Код входа в экспертную платформу",
    text: `Код входа: ${otp}. Код действует 10 минут.`,
    html: `<p>Код входа: <strong>${otp}</strong></p><p>Код действует 10 минут.</p>`,
  });
  return { ...result, ...(result.dev ? { dev_otp: otp } : {}) };
}

async function sendApplicationDecisionEmail(env, application, decision) {
  const approved = decision === "approved";
  const note = application.admin_note ? `\n\nКомментарий администратора: ${application.admin_note}` : "";
  const text = approved
    ? `Ваша заявка в экспертную платформу принята. Можно войти на ${env.PUBLIC_BASE_URL || "https://xn--80a3aie.xn--p1ai/expert"} через email и пароль.${note}`
    : `Ваша заявка в экспертную платформу отклонена.${note}`;
  return sendEmail(env, {
    to: application.email,
    subject: approved ? "Заявка принята" : "Заявка отклонена",
    text,
    html: `<p>${escapeHtml(text).replaceAll("\n", "<br />")}</p>`,
  });
}

async function requestOtp(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  if (!email || !email.includes("@")) return error(400, "Укажите корректный email.");
  const rateKey = `otp-rate:${email}`;
  const previous = await kvGet(env, rateKey);
  if (previous) return error(429, "Код уже отправлен. Повторите запрос позже.");
  const otp = randomDigits(6);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();
  await env.EXPERT_DB.prepare(
    "INSERT INTO otp_challenges (id, email, otp_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(randomHex(12), email, await otpHash(env, email, otp), expiresAt, createdAt).run();
  await kvPut(env, rateKey, "1", 60);
  const delivery = await sendOtpEmail(env, email, otp).catch((reason) => ({ delivered: false, error: String(reason?.message || reason) }));
  if (!delivery.delivered && env.ALLOW_DEV_OTP !== "true") return error(502, "Email-провайдер не отправил код.", { provider_error: delivery.error });
  return json({ status: "otp_sent", email, expires_in_seconds: OTP_TTL_SECONDS, ...(delivery.dev_otp ? { dev_otp: delivery.dev_otp } : {}) });
}

async function verifyOtp(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const otp = String(body.otp || "").trim();
  if (!email || !otp) return error(400, "Укажите email и код.");
  const challenge = await env.EXPERT_DB.prepare(
    "SELECT * FROM otp_challenges WHERE email = ? AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
  ).bind(email, nowIso()).first();
  if (!challenge) return error(401, "Код не найден или срок действия истек.");
  if (challenge.attempts >= 5) return error(429, "Слишком много попыток.");
  const actualHash = await otpHash(env, email, otp);
  if (!constantTimeEqual(actualHash, challenge.otp_hash)) {
    await env.EXPERT_DB.prepare("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?").bind(challenge.id).run();
    return error(401, "Код неверный.");
  }
  await env.EXPERT_DB.prepare("UPDATE otp_challenges SET consumed_at = ? WHERE id = ?").bind(nowIso(), challenge.id).run();
  const user = await createUserIfMissing(env, email);
  if (!user) return error(403, "Аккаунт не найден или заявка еще не одобрена.");
  return issueSession(env, user, "auth.otp_verified");
}

async function issueSession(env, user, auditAction = "auth.session_created") {
  const profile = await getProfile(env, user.id);
  const token = randomHex(32);
  const hash = await tokenHash(env, token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.EXPERT_DB.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(randomHex(12), user.id, hash, expiresAt, createdAt, createdAt).run();
  await kvPut(env, `session:${hash}`, user.id, SESSION_TTL_SECONDS);
  await audit(env, user.id, auditAction, "session", user.id, {});
  return json({ token, user: publicUser(user, profile), profile: serializeProfile(profile) });
}

async function passwordLogin(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!email || !password) return error(400, "Укажите email и пароль.");
  const user = await getUserByEmail(env, email);
  if (!user || (user.status && user.status !== "active") || !user.password_hash) {
    if (user && !user.password_hash) return error(428, "Для этого аккаунта нужно установить пароль через email-код.");
    return error(401, "Неверный email или пароль.");
  }
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return error(401, "Неверный email или пароль.");
  return issueSession(env, user, "auth.password_login");
}

async function requestPasswordSetup(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  if (!email || !email.includes("@")) return error(400, "Укажите корректный email.");
  const user = await getUserByEmail(env, email);
  const application = await getApplicationByEmail(env, email);
  const allowed = Boolean(user?.status === "active" || application?.status === "approved" || adminEmails(env).has(email));
  if (!allowed) return error(403, "Аккаунт не найден или заявка еще не одобрена.");
  return requestOtp(new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  }), env);
}

async function setupPassword(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const otp = String(body.otp || "").trim();
  const password = String(body.password || "");
  if (!email || !otp) return error(400, "Укажите email и код.");
  if (password.length < PASSWORD_MIN_LENGTH) return error(400, `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов.`);
  const challenge = await env.EXPERT_DB.prepare(
    "SELECT * FROM otp_challenges WHERE email = ? AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
  ).bind(email, nowIso()).first();
  if (!challenge) return error(401, "Код не найден или срок действия истек.");
  if (challenge.attempts >= 5) return error(429, "Слишком много попыток.");
  const actualHash = await otpHash(env, email, otp);
  if (!constantTimeEqual(actualHash, challenge.otp_hash)) {
    await env.EXPERT_DB.prepare("UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?").bind(challenge.id).run();
    return error(401, "Код неверный.");
  }
  await env.EXPERT_DB.prepare("UPDATE otp_challenges SET consumed_at = ? WHERE id = ?").bind(nowIso(), challenge.id).run();
  let user = await getUserByEmail(env, email);
  if (!user) {
    const application = await getApplicationByEmail(env, email);
    if (application?.status === "approved") user = await createUserFromApplication(env, application);
  }
  if (!user && adminEmails(env).has(email)) {
    user = await createUserIfMissing(env, email);
  }
  if (!user || (user.status && user.status !== "active")) return error(403, "Аккаунт не найден или заявка еще не одобрена.");
  const hashed = await passwordHash(password);
  const roleSql = adminEmails(env).has(email) ? ", role = 'admin'" : "";
  await env.EXPERT_DB.prepare(`UPDATE users SET password_hash = ?, auth_provider = 'password', updated_at = ?${roleSql} WHERE id = ?`)
    .bind(hashed, nowIso(), user.id).run();
  const updatedUser = await getUserById(env, user.id);
  await audit(env, user.id, "auth.password_setup", "user", user.id, {});
  return issueSession(env, updatedUser, "auth.password_setup_login");
}

async function registerApplication(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const displayName = String(body.display_name || "").trim().slice(0, 120);
  const contact = String(body.contact || "").trim().slice(0, 240);
  const legalAreas = Array.isArray(body.legal_areas) ? body.legal_areas.filter((area) => LEGAL_AREAS.includes(area)) : [];
  const wantsReviewer = Boolean(body.wants_reviewer);
  const coauthorConsent = Boolean(body.coauthor_consent);
  if (!email || !email.includes("@")) return error(400, "Укажите корректный email.");
  if (password.length < PASSWORD_MIN_LENGTH) return error(400, `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов.`);
  if (!displayName) return error(400, "Укажите никнейм.");
  if (!contact) return error(400, "Укажите Telegram или другой способ связи.");
  if (!legalAreas.length) return error(400, "Выберите хотя бы одну область права.");
  const existing = await getUserByEmail(env, email);
  if (existing?.status === "active") return error(409, "Аккаунт с этим email уже активен.");
  const hashed = await passwordHash(password);
  const createdAt = nowIso();
  await env.EXPERT_DB.prepare(
    "INSERT INTO registration_applications (id, email, password_hash, display_name, contact, legal_areas_json, wants_reviewer, coauthor_consent, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?) ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, display_name = excluded.display_name, contact = excluded.contact, legal_areas_json = excluded.legal_areas_json, wants_reviewer = excluded.wants_reviewer, coauthor_consent = excluded.coauthor_consent, status = 'pending', admin_note = '', admin_credentials_text = '', decided_by = NULL, decided_at = NULL, updated_at = excluded.updated_at"
  ).bind(
    randomHex(12),
    email,
    hashed,
    displayName,
    contact,
    JSON.stringify(legalAreas),
    wantsReviewer ? 1 : 0,
    coauthorConsent ? 1 : 0,
    createdAt,
    createdAt
  ).run();
  await audit(env, null, "registration.application_submitted", "registration_application", email, { legal_areas: legalAreas, wants_reviewer: wantsReviewer });
  return json({ status: "pending", message: "Заявка отправлена. Администратор свяжется по указанному контакту." });
}

async function logout(request, env, account) {
  await env.EXPERT_DB.prepare("DELETE FROM sessions WHERE id = ?").bind(account.session.id).run();
  await kvDelete(env, `session:${account.tokenHash}`);
  return json({ status: "logged_out" });
}

function serializeProfile(profile) {
  return {
    legal_areas: safeJsonParse(profile?.legal_areas_json, []),
    credentials: profile?.credentials_text || "",
    certificates: profile?.certificates_text || "",
    wants_reviewer: Boolean(profile?.wants_reviewer),
    coauthor_consent: Boolean(profile?.coauthor_consent),
    admin_credentials: profile?.admin_credentials_text || "",
    mode: profile?.mode || "expert",
  };
}

function completionForAssignment(assignment) {
  const draft = safeJsonParse(assignment.draft_json, {});
  const payload = safeJsonParse(assignment.payload_json, {});
  let expected = 3;
  let filled = Object.values(draft || {}).filter((value) => value !== "" && value !== null && value !== undefined).length;
  if (assignment.task_type === "rubric_scorecard") expected = (payload.criteria || []).length + 2;
  if (assignment.status === "submitted" || assignment.status === "approved") filled = expected;
  return { filled, expected, percent: Math.min(100, Math.round((filled / expected) * 100)), is_complete: filled >= expected };
}

function availableTransitions(assignment, user) {
  if (assignment.status === "submitted" && (user.role === "reviewer" || user.role === "admin")) return ["review"];
  if (assignment.status === "needs_rework") return ["save_draft", "submit"];
  if (assignment.status === "approved") return [];
  return ["claim", "save_draft", "submit"];
}

function assignmentCard(row, project) {
  return {
    id: row.id,
    project_id: row.project_id,
    project_name: project?.name || "",
    task_title: row.task_title,
    task_type: row.task_type,
    status: row.status,
    priority: row.priority,
    due_at: row.due_at,
    due_label: row.due_at ? new Date(row.due_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) : "без срока",
    revision: row.revision,
    completion: completionForAssignment(row),
  };
}

async function dashboard(env, account) {
  await ensureUserAssignments(env, account.user);
  const projectsResult = await env.EXPERT_DB.prepare("SELECT * FROM projects ORDER BY created_at, id").all();
  const membershipsResult = await env.EXPERT_DB.prepare("SELECT * FROM project_memberships WHERE user_id = ?").bind(account.user.id).all();
  const assignmentsResult = account.user.role === "admin"
    ? await env.EXPERT_DB.prepare("SELECT * FROM assignments ORDER BY due_at, created_at").all()
    : await env.EXPERT_DB.prepare("SELECT * FROM assignments WHERE user_id = ? ORDER BY due_at, created_at").bind(account.user.id).all();
  const profile = await getProfile(env, account.user.id);
  const legalAreas = new Set(safeJsonParse(profile?.legal_areas_json, []));
  const membershipMap = new Map((membershipsResult.results || []).map((item) => [item.project_id, item.status]));
  const projects = (projectsResult.results || []).map((project) => {
    const eligible = !project.required_area || legalAreas.has(project.required_area) || account.user.role === "admin";
    const status = membershipMap.get(project.id) || (eligible ? "available" : "locked");
    const count = (assignmentsResult.results || []).filter((assignment) => assignment.project_id === project.id).length;
    return {
      ...project,
      access: eligible ? "eligible" : "requires_area",
      membership_status: status,
      counts: { assigned: count },
    };
  });
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const assignments = (assignmentsResult.results || []).map((assignment) => assignmentCard(assignment, projectMap.get(assignment.project_id)));
  const summary = assignments.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  const adminRequests = account.user.role === "admin"
    ? (await env.EXPERT_DB.prepare("SELECT * FROM admin_requests ORDER BY created_at DESC LIMIT 30").all()).results || []
    : (await env.EXPERT_DB.prepare("SELECT * FROM admin_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 10").bind(account.user.id).all()).results || [];
  const applications = account.user.role === "admin"
    ? (await env.EXPERT_DB.prepare("SELECT id, email, display_name, contact, legal_areas_json, wants_reviewer, coauthor_consent, status, admin_note, admin_credentials_text, decided_by, decided_at, created_at, updated_at FROM registration_applications ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 100").all()).results || []
    : [];
  return json({
    user: publicUser(account.user, profile),
    role: account.user.role,
    mode: profile?.mode || "expert",
    summary,
    projects,
    assignments,
    support_requests: adminRequests,
    admin_surface: account.user.role === "admin" ? {
      requests: adminRequests,
      applications: applications.map((application) => ({
        ...application,
        legal_areas: safeJsonParse(application.legal_areas_json, []),
        wants_reviewer: Boolean(application.wants_reviewer),
        coauthor_consent: Boolean(application.coauthor_consent),
      })),
      routing: projects.map((project) => ({ project_id: project.id, required_area: project.required_area, status: project.status })),
      quality: { submitted: summary.submitted || 0, approved: summary.approved || 0, needs_rework: summary.needs_rework || 0 },
      import_export: { imports: [], exports: projects.map((project) => ({ project_id: project.id, name: project.name })) },
    } : null,
  });
}

async function assignmentDetail(env, account, assignmentId) {
  const row = account.user.role === "admin"
    ? await env.EXPERT_DB.prepare("SELECT * FROM assignments WHERE id = ?").bind(assignmentId).first()
    : await env.EXPERT_DB.prepare("SELECT * FROM assignments WHERE id = ? AND user_id = ?").bind(assignmentId, account.user.id).first();
  if (!row) return null;
  const project = await env.EXPERT_DB.prepare("SELECT * FROM projects WHERE id = ?").bind(row.project_id).first();
  const drafts = (await env.EXPERT_DB.prepare("SELECT * FROM assignment_drafts WHERE assignment_id = ? ORDER BY created_at DESC LIMIT 8").bind(row.id).all()).results || [];
  const submissions = (await env.EXPERT_DB.prepare("SELECT * FROM submissions WHERE assignment_id = ? ORDER BY created_at DESC LIMIT 8").bind(row.id).all()).results || [];
  const reviews = (await env.EXPERT_DB.prepare("SELECT * FROM reviews WHERE assignment_id = ? ORDER BY created_at DESC LIMIT 8").bind(row.id).all()).results || [];
  const comments = (await env.EXPERT_DB.prepare(
    "SELECT c.id, c.assignment_id, c.user_id, c.body, c.created_at, u.display_name, u.role FROM assignment_comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.assignment_id = ? ORDER BY c.created_at ASC LIMIT 80"
  ).bind(row.id).all()).results || [];
  const assignment = {
    ...assignmentCard(row, project),
    stored_status: row.stored_status,
    draft: safeJsonParse(row.draft_json, {}),
    submitted_payload: safeJsonParse(row.submission_json, null),
    review_payload: safeJsonParse(row.review_json, null),
    available_transitions: availableTransitions(row, account.user),
  };
  return {
    assignment,
    project,
    task: {
      id: row.id,
      title: row.task_title,
      task_type: row.task_type,
      payload: safeJsonParse(row.payload_json, {}),
    },
    task_view: {
      id: row.id,
      title: row.task_title,
      task_type: row.task_type,
      payload: safeJsonParse(row.payload_json, {}),
    },
    history: {
      drafts,
      submissions,
      reviews,
    },
    comments,
    security_policy: AGENT_POLICY,
  };
}

async function updateAssignment(env, account, assignmentId, action, request) {
  const detail = await assignmentDetail(env, account, assignmentId);
  if (!detail) return error(404, "Задание не найдено.");
  const body = await readJson(request);
  const payload = body.payload || {};
  const createdAt = nowIso();
  if (action === "claim") {
    await env.EXPERT_DB.prepare("UPDATE assignments SET status = ?, stored_status = ?, updated_at = ? WHERE id = ?")
      .bind("claimed", "claimed", createdAt, assignmentId).run();
    await audit(env, account.user.id, "assignment.claimed", "assignment", assignmentId, {});
  } else if (action === "draft") {
    await env.EXPERT_DB.batch([
      env.EXPERT_DB.prepare("UPDATE assignments SET status = ?, stored_status = ?, revision = revision + 1, draft_json = ?, updated_at = ? WHERE id = ?")
        .bind("draft_saved", "in_progress", JSON.stringify(payload), createdAt, assignmentId),
      env.EXPERT_DB.prepare("INSERT INTO assignment_drafts (id, assignment_id, user_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(randomHex(12), assignmentId, account.user.id, JSON.stringify(payload), createdAt),
    ]);
    await audit(env, account.user.id, "assignment.draft_saved", "assignment", assignmentId, {});
  } else if (action === "submit") {
    await env.EXPERT_DB.batch([
      env.EXPERT_DB.prepare("UPDATE assignments SET status = ?, stored_status = ?, revision = revision + 1, draft_json = ?, submission_json = ?, updated_at = ? WHERE id = ?")
        .bind("submitted", "submitted", JSON.stringify(payload), JSON.stringify(payload), createdAt, assignmentId),
      env.EXPERT_DB.prepare("INSERT INTO submissions (id, assignment_id, user_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(randomHex(12), assignmentId, account.user.id, JSON.stringify(payload), createdAt),
    ]);
    await audit(env, account.user.id, "assignment.submitted", "assignment", assignmentId, {});
  } else if (action === "review") {
    if (account.user.role !== "reviewer" && account.user.role !== "admin") return error(403, "Проверка доступна только проверяющему или администратору.");
    if (detail.assignment.status !== "submitted") return error(409, "Ревью доступно только после отправки результата экспертом.");
    const outcome = body.outcome === "needs_rework" ? "needs_rework" : "approved";
    const reviewerNote = String(payload.reviewer_note || "").trim();
    if (outcome === "needs_rework" && !reviewerNote) return error(400, "Причина отклонения обязательна.");
    const reviewPayload = { ...payload, reviewer_note: reviewerNote || "Проверка принята." };
    await env.EXPERT_DB.batch([
      env.EXPERT_DB.prepare("UPDATE assignments SET status = ?, stored_status = ?, review_json = ?, updated_at = ? WHERE id = ?")
        .bind(outcome, outcome, JSON.stringify(reviewPayload), createdAt, assignmentId),
      env.EXPERT_DB.prepare("INSERT INTO reviews (id, assignment_id, reviewer_id, outcome, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(randomHex(12), assignmentId, account.user.id, outcome, JSON.stringify(reviewPayload), createdAt),
    ]);
    await audit(env, account.user.id, "assignment.reviewed", "assignment", assignmentId, { outcome });
  } else if (action === "comment") {
    const message = String(body.message || "").trim();
    if (!message) return error(400, "Сообщение не должно быть пустым.");
    await env.EXPERT_DB.prepare("INSERT INTO assignment_comments (id, assignment_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(randomHex(12), assignmentId, account.user.id, message, createdAt).run();
    await audit(env, account.user.id, "assignment.comment_added", "assignment", assignmentId, {});
  } else {
    return error(404, "Действие задания не найдено.");
  }
  return json(await assignmentDetail(env, account, assignmentId));
}

async function updateProfile(request, env, account) {
  const body = await readJson(request);
  const legalAreas = Array.isArray(body.legal_areas)
    ? body.legal_areas.filter((area) => LEGAL_AREAS.includes(area))
    : serializeProfile(account.profile).legal_areas;
  const wantsReviewer = Boolean(body.wants_reviewer);
  const canReview = account.user.role === "reviewer" || account.user.role === "admin";
  const mode = canReview && body.mode === "reviewer" ? "reviewer" : "expert";
  const coauthorConsent = Boolean(body.coauthor_consent);
  const displayName = String(body.display_name || account.user.display_name || account.user.email).trim();
  const updatedAt = nowIso();
  await env.EXPERT_DB.batch([
    env.EXPERT_DB.prepare("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?")
      .bind(displayName, updatedAt, account.user.id),
    env.EXPERT_DB.prepare("UPDATE profiles SET legal_areas_json = ?, wants_reviewer = ?, mode = ?, updated_at = ?, coauthor_consent = ? WHERE user_id = ?")
      .bind(JSON.stringify(legalAreas), wantsReviewer ? 1 : 0, mode, updatedAt, coauthorConsent ? 1 : 0, account.user.id),
  ]);
  await audit(env, account.user.id, "profile.updated", "profile", account.user.id, { legal_areas: legalAreas, wants_reviewer: wantsReviewer, coauthor_consent: coauthorConsent });
  const user = await getUserById(env, account.user.id);
  const profile = await getProfile(env, account.user.id);
  return json({ user: publicUser(user, profile), profile: serializeProfile(profile), legal_areas: LEGAL_AREAS });
}

async function uploadCredential(request, env, account) {
  const body = await readJson(request);
  const fileName = String(body.file_name || "credential.txt").replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 120);
  const contentType = String(body.content_type || "application/octet-stream").slice(0, 120);
  const label = String(body.label || "Документ").trim().slice(0, 120);
  const base64 = String(body.data_base64 || "").replace(/^data:[^,]+,/, "");
  if (!base64) return error(400, "Файл не передан.");
  const binary = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  if (binary.byteLength > 5 * 1024 * 1024) return error(413, "Файл больше 5 МБ.");
  const key = `${DOCUMENT_PREFIX}/${account.user.id}/${randomHex(8)}-${fileName}`;
  await env.SITE_BUCKET.put(key, binary, { httpMetadata: { contentType } });
  const id = randomHex(12);
  await env.EXPERT_DB.prepare(
    "INSERT INTO credentials (id, user_id, label, file_name, content_type, object_key, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, account.user.id, label, fileName, contentType, key, binary.byteLength, nowIso()).run();
  await audit(env, account.user.id, "credential.uploaded", "credential", id, { file_name: fileName, size: binary.byteLength });
  return json({ id, label, file_name: fileName, content_type: contentType, size: binary.byteLength });
}

async function joinProject(request, env, account) {
  const body = await readJson(request);
  const projectId = String(body.project_id || "").trim();
  const project = await env.EXPERT_DB.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
  if (!project) return error(404, "Проект не найден.");
  const profile = await getProfile(env, account.user.id);
  const legalAreas = new Set(safeJsonParse(profile?.legal_areas_json, []));
  if (project.required_area && !legalAreas.has(project.required_area) && account.user.role !== "admin") {
    return error(403, "Для проекта нужна соответствующая область права.", { required_area: project.required_area });
  }
  const createdAt = nowIso();
  await env.EXPERT_DB.prepare(
    "INSERT OR REPLACE INTO project_memberships (user_id, project_id, status, created_at) VALUES (?, ?, ?, ?)"
  ).bind(account.user.id, projectId, "requested", createdAt).run();
  await env.EXPERT_DB.prepare(
    "INSERT INTO admin_requests (id, user_id, assignment_id, status, message, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(randomHex(12), account.user.id, null, "new", `Запрос подключения к проекту: ${project.name}`, createdAt).run();
  await audit(env, account.user.id, "project.join_requested", "project", projectId, {});
  return json({ status: "requested", project_id: projectId });
}

async function switchMode(request, env, account) {
  const body = await readJson(request);
  const requested = body.mode === "reviewer" ? "reviewer" : "expert";
  const profile = await getProfile(env, account.user.id);
  const allowed = requested === "expert" || account.user.role === "reviewer" || account.user.role === "admin";
  if (!allowed) return error(403, "Режим ревьювера доступен только после одобрения администратором.");
  await env.EXPERT_DB.prepare("UPDATE profiles SET mode = ?, updated_at = ? WHERE user_id = ?").bind(requested, nowIso(), account.user.id).run();
  await audit(env, account.user.id, "profile.mode_changed", "profile", account.user.id, { mode: requested });
  return json({ mode: requested });
}

function requireAdmin(account) {
  return account?.user?.role === "admin";
}

async function listApplications(env) {
  const rows = (await env.EXPERT_DB.prepare(
    "SELECT id, email, display_name, contact, legal_areas_json, wants_reviewer, coauthor_consent, status, admin_note, admin_credentials_text, decided_by, decided_at, created_at, updated_at FROM registration_applications ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 200"
  ).all()).results || [];
  return rows.map((application) => ({
    ...application,
    legal_areas: safeJsonParse(application.legal_areas_json, []),
    wants_reviewer: Boolean(application.wants_reviewer),
    coauthor_consent: Boolean(application.coauthor_consent),
  }));
}

async function decideApplication(request, env, account, applicationId) {
  if (!requireAdmin(account)) return error(403, "Доступно только администратору.");
  const body = await readJson(request);
  const decision = body.decision === "approved" ? "approved" : body.decision === "rejected" ? "rejected" : "";
  if (!decision) return error(400, "Укажите решение: approved или rejected.");
  const application = await env.EXPERT_DB.prepare("SELECT * FROM registration_applications WHERE id = ?").bind(applicationId).first();
  if (!application) return error(404, "Заявка не найдена.");
  const adminNote = String(body.admin_note || "").trim().slice(0, 1000);
  const adminCredentials = String(body.admin_credentials || "").trim().slice(0, 2000);
  const decidedAt = nowIso();
  await env.EXPERT_DB.prepare(
    "UPDATE registration_applications SET status = ?, admin_note = ?, admin_credentials_text = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?"
  ).bind(decision, adminNote, adminCredentials, account.user.id, decidedAt, decidedAt, applicationId).run();
  const decidedApplication = await env.EXPERT_DB.prepare("SELECT * FROM registration_applications WHERE id = ?").bind(applicationId).first();
  let user = null;
  if (decision === "approved") {
    user = await createUserFromApplication(env, decidedApplication);
  }
  const delivery = await sendApplicationDecisionEmail(env, decidedApplication, decision).catch((reason) => ({
    delivered: false,
    error: String(reason?.message || reason),
  }));
  await audit(env, account.user.id, `registration.application_${decision}`, "registration_application", applicationId, {
    email: application.email,
    email_delivered: Boolean(delivery.delivered),
  });
  return json({
    application: {
      ...decidedApplication,
      password_hash: undefined,
      legal_areas: safeJsonParse(decidedApplication.legal_areas_json, []),
      wants_reviewer: Boolean(decidedApplication.wants_reviewer),
      coauthor_consent: Boolean(decidedApplication.coauthor_consent),
    },
    user: user ? publicUser(user, await getProfile(env, user.id)) : null,
    email: delivery,
  });
}

async function exportProjectResults(request, env, account) {
  if (!requireAdmin(account)) return error(403, "Доступно только администратору.");
  const url = new URL(request.url);
  const projectId = String(url.searchParams.get("project_id") || "").trim();
  const assignmentId = String(url.searchParams.get("assignment_id") || "").trim();
  if (!projectId) return error(400, "Укажите project_id.");
  const project = await env.EXPERT_DB.prepare("SELECT * FROM projects WHERE id = ?").bind(projectId).first();
  if (!project) return error(404, "Проект не найден.");
  const assignmentsSql = assignmentId
    ? "SELECT a.*, u.email, u.display_name, u.role FROM assignments a LEFT JOIN users u ON u.id = a.user_id WHERE a.project_id = ? AND a.id = ? ORDER BY a.created_at"
    : "SELECT a.*, u.email, u.display_name, u.role FROM assignments a LEFT JOIN users u ON u.id = a.user_id WHERE a.project_id = ? ORDER BY a.created_at";
  const assignmentsQuery = assignmentId
    ? env.EXPERT_DB.prepare(assignmentsSql).bind(projectId, assignmentId)
    : env.EXPERT_DB.prepare(assignmentsSql).bind(projectId);
  const assignments = (await assignmentsQuery.all()).results || [];
  const exportedAssignments = [];
  for (const assignment of assignments) {
    const [drafts, submissions, reviews, comments] = await Promise.all([
      env.EXPERT_DB.prepare("SELECT id, user_id, payload_json, created_at FROM assignment_drafts WHERE assignment_id = ? ORDER BY created_at").bind(assignment.id).all(),
      env.EXPERT_DB.prepare("SELECT id, user_id, payload_json, created_at FROM submissions WHERE assignment_id = ? ORDER BY created_at").bind(assignment.id).all(),
      env.EXPERT_DB.prepare("SELECT id, reviewer_id, outcome, payload_json, created_at FROM reviews WHERE assignment_id = ? ORDER BY created_at").bind(assignment.id).all(),
      env.EXPERT_DB.prepare("SELECT c.id, c.user_id, c.body, c.created_at, u.display_name, u.role FROM assignment_comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.assignment_id = ? ORDER BY c.created_at").bind(assignment.id).all(),
    ]);
    exportedAssignments.push({
      id: assignment.id,
      expert: { user_id: assignment.user_id, email: assignment.email, display_name: assignment.display_name, role: assignment.role },
      task_type: assignment.task_type,
      task_title: assignment.task_title,
      status: assignment.status,
      stored_status: assignment.stored_status,
      revision: assignment.revision,
      due_at: assignment.due_at,
      priority: assignment.priority,
      payload: safeJsonParse(assignment.payload_json, {}),
      draft: safeJsonParse(assignment.draft_json, {}),
      submission: safeJsonParse(assignment.submission_json, null),
      review: safeJsonParse(assignment.review_json, null),
      drafts: (drafts.results || []).map((item) => ({ ...item, payload: safeJsonParse(item.payload_json, {}) })),
      submissions: (submissions.results || []).map((item) => ({ ...item, payload: safeJsonParse(item.payload_json, {}) })),
      reviews: (reviews.results || []).map((item) => ({ ...item, payload: safeJsonParse(item.payload_json, {}) })),
      comments: comments.results || [],
      created_at: assignment.created_at,
      updated_at: assignment.updated_at,
    });
  }
  const payload = {
    exported_at: nowIso(),
    project: {
      id: project.id,
      name: project.name,
      summary: project.summary,
      required_area: project.required_area,
      task_type: project.task_type,
      status: project.status,
    },
    assignment_filter: assignmentId || null,
    assignments: exportedAssignments,
  };
  const fileName = assignmentId ? `${projectId}-${assignmentId}.json` : `${projectId}-results.json`;
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      ...JSON_HEADERS,
      "content-disposition": `attachment; filename="${fileName.replace(/[^a-zA-Z0-9_.-]+/g, "_")}"`,
    },
  });
}

function detectAgentIntent(message) {
  const text = String(message || "").toLowerCase();
  if (/админ|администратор|поддержк|связ/.test(text)) return "admin";
  if (/провер|пропуск|ошиб|риск/.test(text)) return "check";
  if (/найди|поиск|гугл|закон|практик/.test(text)) return "search";
  if (/объясн|критер|что делать|задан/.test(text)) return "explain";
  return "general";
}

function compressMessages(messages) {
  const kept = messages.slice(-MAX_AGENT_MESSAGES);
  const dropped = messages.length - kept.length;
  return {
    messages: kept,
    summary: dropped > 0 ? `Сжато сообщений: ${dropped}. Последний контекст сохранен в D1.` : "",
  };
}

async function callOpenRouter(env, { account, assignment, messages, intent }) {
  if (!env.OPENROUTER_API_KEY) return null;
  const baseUrl = String(env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
  const context = assignment ? `Задание: ${assignment.assignment.task_title}; тип: ${assignment.assignment.task_type}; статус: ${assignment.assignment.status}.` : "Задание не выбрано.";
  const chatMessages = [
    {
      role: "system",
      content: [
        "Ты агент экспертной платформы.",
        "Отвечай по-русски, кратко, предметно.",
        "Не изменяй оценки, не отправляй формы, не меняй административные настройки.",
        "Разрешено объяснять задание, проверять пропуски, готовить обращение администратору, искать публичную информацию.",
        `Политика безопасности: ${JSON.stringify(AGENT_POLICY)}.`,
        `Пользователь: ${account.user.email}; роль: ${account.user.role}; intent: ${intent}; ${context}`,
      ].join("\n"),
    },
    ...messages.map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: item.text })),
  ];
  const body = {
    model: env.OPENROUTER_MODEL || "openrouter/auto",
    messages: chatMessages,
    temperature: 0.2,
  };
  if (env.OPENROUTER_ENABLE_WEB_SEARCH === "true" && intent === "search") {
    body.plugins = [{ id: "web", max_results: 3 }];
    body.tools = [{ type: "openrouter:web_search" }];
  }
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "http-referer": env.PUBLIC_BASE_URL || "https://xn--80a3aie.xn--p1ai/expert",
      "x-title": "tupa expert platform",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data?.choices?.[0]?.message?.content || null;
}

function deterministicAgent({ message, assignment, intent, needsAdmin }) {
  const title = assignment?.assignment?.task_title || "задание не выбрано";
  const base = {
    explain: `Контекст: ${title}. Сначала прочитайте материалы, затем заполните обязательные поля, сохраните черновик и отправьте результат после самопроверки.`,
    check: `Проверка: ${title}. Убедитесь, что выбран основной вариант, указана уверенность и заполнено обоснование. Агент не отправляет форму напрямую.`,
    search: "Поиск через OpenRouter сейчас недоступен или не дал ответа. Сформируйте точный поисковый запрос по норме права, фактам и юрисдикции.",
    admin: "Обращение администратору создано. Статус будет виден в панели обращений.",
    general: "Доступные действия: объяснить задание, проверить пропуски, подготовить обращение администратору, предложить следующий шаг.",
  };
  return [
    base[intent] || base.general,
    message ? `Запрос: ${message}` : "",
    needsAdmin ? "Администратор получит обращение в production D1." : "",
    "Граница безопасности: оценки и административные настройки не изменяются агентом напрямую.",
  ].filter(Boolean).join(" ");
}

async function agentChat(request, env, account) {
  const body = await readJson(request);
  const message = String(body.message || "").trim();
  const assignmentId = String(body.assignment_id || "").trim();
  if (!message) return error(400, "Сообщение пустое.");
  const intent = detectAgentIntent(message);
  const needsAdmin = intent === "admin";
  const thread = await env.EXPERT_DB.prepare("SELECT * FROM agent_threads WHERE user_id = ?").bind(account.user.id).first();
  const currentMessages = safeJsonParse(thread?.messages_json, []);
  currentMessages.push({ role: "user", text: message, created_at: nowIso() });
  const assignment = assignmentId ? await assignmentDetail(env, account, assignmentId) : null;
  if (needsAdmin) {
    await env.EXPERT_DB.prepare(
      "INSERT INTO admin_requests (id, user_id, assignment_id, status, message, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(randomHex(12), account.user.id, assignmentId || null, "new", message, nowIso()).run();
  }
  const compressedBefore = compressMessages(currentMessages);
  const modelText = await callOpenRouter(env, { account, assignment, messages: compressedBefore.messages, intent }).catch(() => null);
  const text = modelText || deterministicAgent({ message, assignment, intent, needsAdmin });
  compressedBefore.messages.push({ role: "assistant", text, created_at: nowIso() });
  const compressedAfter = compressMessages(compressedBefore.messages);
  await env.EXPERT_DB.prepare(
    "INSERT INTO agent_threads (user_id, summary, messages_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET summary = excluded.summary, messages_json = excluded.messages_json, updated_at = excluded.updated_at"
  ).bind(account.user.id, compressedAfter.summary, JSON.stringify(compressedAfter.messages), nowIso()).run();
  await audit(env, account.user.id, "agent.chat", "agent_thread", account.user.id, { intent, model_used: Boolean(modelText), needs_admin: needsAdmin });
  return json({
    message: text,
    memory: compressedAfter.messages,
    memory_policy: "d1_last_messages_plus_summary",
    security_policy: AGENT_POLICY,
    actions: needsAdmin ? [{ type: "admin_request_created" }] : [],
  });
}

function googleEnabled(env) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

async function googleStart(request, env) {
  if (!googleEnabled(env)) return error(501, "Google вход не настроен. Нужны GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.");
  const url = new URL(request.url);
  const redirectUri = env.GOOGLE_REDIRECT_URI || `${url.origin}/api/auth/google/callback`;
  const state = randomHex(16);
  await kvPut(env, `google-oauth:${state}`, redirectUri, 600);
  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleUrl.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
  googleUrl.searchParams.set("redirect_uri", redirectUri);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("state", state);
  googleUrl.searchParams.set("prompt", "select_account");
  return Response.redirect(googleUrl.toString(), 302);
}

async function googleCallback(request, env) {
  if (!googleEnabled(env)) return error(501, "Google вход не настроен.");
  const url = new URL(request.url);
  const state = String(url.searchParams.get("state") || "");
  const code = String(url.searchParams.get("code") || "");
  const redirectUri = await kvGet(env, `google-oauth:${state}`);
  if (!state || !code || !redirectUri) return error(400, "Google вход не подтвержден.");
  await kvDelete(env, `google-oauth:${state}`);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenResponse.ok) return error(502, "Google не выдал токен.");
  const tokenData = await tokenResponse.json();
  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userResponse.ok) return error(502, "Google не вернул профиль.");
  const googleUser = await userResponse.json();
  const email = normalizeEmail(googleUser.email);
  if (!email || googleUser.email_verified === false) return error(403, "Google email не подтвержден.");
  let user = await getUserByEmail(env, email);
  if (!user) {
    const application = await getApplicationByEmail(env, email);
    if (application?.status === "approved") user = await createUserFromApplication(env, application);
  }
  if (!user || (user.status && user.status !== "active")) return error(403, "Аккаунт не найден или заявка еще не одобрена.");
  const sessionResponse = await issueSession(env, user, "auth.google_login");
  const session = await sessionResponse.json();
  const html = `<!doctype html><meta charset="utf-8"><script>localStorage.setItem("expert_platform_token", ${JSON.stringify(session.token)}); location.replace("/expert");</script>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

async function serveStatic(request, env) {
  const url = new URL(request.url);
  const pathname = url.pathname === "/expert" || url.pathname === "/expert/"
    ? "/index.html"
    : url.pathname;
  const cleanPath = pathname.replace(/^\/+/, "");
  if (!cleanPath || cleanPath.includes("..")) return error(404, "Маршрут не найден.");
  const key = `${ASSET_PREFIX}/${cleanPath}`;
  const object = await env.SITE_BUCKET.get(key).catch(() => null);
  if (object) {
    return new Response(object.body, {
      headers: {
        "content-type": contentType(cleanPath),
        "cache-control": cleanPath.startsWith("static/") ? "public, max-age=31536000, immutable" : "public, max-age=60",
        "x-cloudflare-hosting-mode": "production-worker-r2",
        "x-yandex-origin": "disabled",
      },
    });
  }
  const embedded = EMBEDDED_SAFE_ASSETS[cleanPath] || (cleanPath === "index.html" ? EMBEDDED_SAFE_ASSETS["index.html"] : null);
  if (!embedded) return error(404, "Файл не найден.");
  return new Response(embedded, {
    headers: {
      "content-type": contentType(cleanPath),
      "cache-control": cleanPath.startsWith("static/") ? "public, max-age=300" : "public, max-age=60",
      "x-cloudflare-hosting-mode": "production-worker-embedded",
      "x-yandex-origin": "disabled",
    },
  });
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === "/health") return json({ status: "ok", hosting: "cloudflare_worker_d1_r2_kv", root_policy: "reserved" });
  if (path === "/api/meta") return json({ legal_areas: LEGAL_AREAS, agent_policy: AGENT_POLICY, google_auth_enabled: googleEnabled(env) });
  if (path === "/api/auth/otp/request" && request.method === "POST") return requestOtp(request, env);
  if (path === "/api/auth/otp/verify" && request.method === "POST") return verifyOtp(request, env);
  if (path === "/api/auth/password/login" && request.method === "POST") return passwordLogin(request, env);
  if (path === "/api/auth/password/setup/request" && request.method === "POST") return requestPasswordSetup(request, env);
  if (path === "/api/auth/password/setup/verify" && request.method === "POST") return setupPassword(request, env);
  if (path === "/api/auth/register" && request.method === "POST") return registerApplication(request, env);
  if (path === "/api/auth/google/start") return googleStart(request, env);
  if (path === "/api/auth/google/callback") return googleCallback(request, env);
  const account = await accountFromRequest(env, request);
  if (!account) return error(401, "Требуется вход.");
  if (path === "/api/auth/logout" && request.method === "POST") return logout(request, env, account);
  if (path === "/api/session") return json({ user: publicUser(account.user, account.profile), profile: serializeProfile(account.profile) });
  if (path === "/api/register" && request.method === "POST") return updateProfile(request, env, account);
  if (path === "/api/dashboard") return dashboard(env, account);
  if (path === "/api/expert/profile" && request.method === "GET") {
    const credentials = (await env.EXPERT_DB.prepare("SELECT id, label, file_name, content_type, size, created_at FROM credentials WHERE user_id = ? ORDER BY created_at DESC").bind(account.user.id).all()).results || [];
    return json({ profile: serializeProfile(account.profile), legal_areas: LEGAL_AREAS, credentials });
  }
  if (path === "/api/expert/profile" && request.method === "POST") return updateProfile(request, env, account);
  if (path === "/api/expert/credentials/upload" && request.method === "POST") return uploadCredential(request, env, account);
  if (path === "/api/projects/join" && request.method === "POST") return joinProject(request, env, account);
  if (path === "/api/mode" && request.method === "POST") return switchMode(request, env, account);
  if (path === "/api/agent/chat" && request.method === "POST") return agentChat(request, env, account);
  if (path === "/api/admin/applications" && request.method === "GET") {
    if (!requireAdmin(account)) return error(403, "Доступно только администратору.");
    return json({ applications: await listApplications(env) });
  }
  const applicationDecisionMatch = path.match(/^\/api\/admin\/applications\/([^/]+)\/decision$/);
  if (applicationDecisionMatch && request.method === "POST") return decideApplication(request, env, account, applicationDecisionMatch[1]);
  if (path === "/api/admin/export" && request.method === "GET") return exportProjectResults(request, env, account);
  const assignmentMatch = path.match(/^\/api\/assignments\/([^/]+)(?:\/([^/]+))?$/);
  if (assignmentMatch) {
    const [, assignmentId, action] = assignmentMatch;
    if (!action && request.method === "GET") {
      const detail = await assignmentDetail(env, account, assignmentId);
      return detail ? json(detail) : error(404, "Задание не найдено.");
    }
    if (request.method === "POST") return updateAssignment(env, account, assignmentId, action, request);
  }
  if (path === "/api/admin/requests" && account.user.role === "admin") {
    const requests = (await env.EXPERT_DB.prepare("SELECT * FROM admin_requests ORDER BY created_at DESC LIMIT 100").all()).results || [];
    return json({ requests });
  }
  return error(404, "Маршрут не найден.");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: JSON_HEADERS });
    if (url.pathname === "/Expert" || url.pathname === "/Expert/") return Response.redirect(`${url.origin}/expert`, 302);
    if (url.pathname === "/" || url.pathname === "/favicon.ico") return error(404, "Корень домена зарезервирован для другого сайта.");
    if (url.pathname.startsWith("/api/") || url.pathname === "/health") return handleApi(request, env);
    if (url.pathname === "/expert" || url.pathname === "/expert/" || url.pathname.startsWith("/static/")) return serveStatic(request, env);
    return error(404, "Маршрут не найден.");
  },
};
