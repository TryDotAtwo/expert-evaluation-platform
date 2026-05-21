import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePublic = path.join(root, "public");
const targetPublic = path.join(root, "public_safe");

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDir(sourcePath, targetPath);
    if (entry.isFile()) fs.copyFileSync(sourcePath, targetPath);
  }
}

function completion(filled, expected) {
  return {
    filled,
    expected,
    percent: expected ? Math.round((filled / expected) * 100) : 0,
    is_complete: expected > 0 && filled >= expected,
  };
}

const projects = [
  {
    id: "demo-court",
    name: "Демонстрационная оценка ответов",
    summary: "Синтетические задания для проверки рубрик, комментариев и отправки результата.",
    status: "active",
    accent: "sunset",
    task_type: "rubric_scorecard",
    sensitivity: "synthetic",
    instructions: ["Проверить полноту ответа.", "Заполнить оценки и комментарии."],
  },
  {
    id: "demo-taxonomy",
    name: "Демонстрационная классификация",
    summary: "Синтетическая разметка обращений по категориям.",
    status: "active",
    accent: "ocean",
    task_type: "classification",
    sensitivity: "synthetic",
    instructions: ["Выбрать категорию.", "Указать уверенность."],
  },
  {
    id: "demo-arena",
    name: "Демонстрационное сравнение",
    summary: "Синтетическое парное сравнение ответов.",
    status: "pilot",
    accent: "gold",
    task_type: "pairwise_preference",
    sensitivity: "synthetic",
    instructions: ["Выбрать лучший вариант.", "Объяснить выбор."],
  },
  {
    id: "demo-triplets",
    name: "Демонстрационная близость смыслов",
    summary: "Синтетический выбор более близкого ответа.",
    status: "pilot",
    accent: "mint",
    task_type: "triplet_similarity",
    sensitivity: "synthetic",
    instructions: ["Сравнить варианты.", "Поставить уверенность."],
  },
];

const taskPayloads = {
  rubric_scorecard: {
    headline: "Оценка демонстрационного ответа",
    prompt: "Проверьте синтетический ответ на полноту, точность и полезность.",
    source_text: "Пользователь просит объяснить порядок подготовки отчета по качеству данных.",
    model_answer: "Отчет должен содержать цель проверки, список источников, метрики качества, найденные проблемы и план исправлений.",
    criteria: [
      { id: "accuracy", label: "Точность", scale: [1, 2, 3, 4, 5] },
      { id: "completeness", label: "Полнота", scale: [1, 2, 3, 4, 5] },
      { id: "clarity", label: "Ясность", scale: [1, 2, 3, 4, 5] },
    ],
  },
  classification: {
    headline: "Классификация демонстрационного обращения",
    prompt: "Определите категорию обращения и уверенность.",
    text: "Нужно понять, почему отчет не появился после отправки формы.",
    labels: ["ошибка интерфейса", "вопрос по доступу", "запрос функции", "прочее"],
    confidence_scale: [1, 2, 3, 4, 5],
  },
  pairwise_preference: {
    headline: "Сравнение двух демонстрационных ответов",
    prompt: "Выберите более полезный ответ.",
    question: "Как быстро проверить качество импортированных данных?",
    option_a: "Проверить только количество строк.",
    option_b: "Проверить количество строк, обязательные поля, дубликаты и распределение ключевых категорий.",
    confidence_scale: [1, 2, 3, 4, 5],
  },
  triplet_similarity: {
    headline: "Выбор более близкого демонстрационного ответа",
    prompt: "Определите, какой вариант ближе к исходному смыслу.",
    anchor: "Нужно оценить полноту и точность отчета перед публикацией.",
    positive: "Перед публикацией следует проверить точность, полноту и воспроизводимость отчета.",
    negative: "Перед публикацией следует изменить цвет кнопки на главной странице.",
    confidence_scale: [1, 2, 3, 4, 5],
  },
};

function assignment(id, project, index, status = "assigned", qaMode = "normal") {
  const taskType = project.task_type;
  const taskId = `task-${id}`;
  const now = `2026-05-21T0${index}:00:00Z`;
  const filled = status === "draft_saved" ? 2 : 0;
  const expected = taskType === "rubric_scorecard" ? 6 : 3;
  const card = {
    id,
    status,
    stored_status: status === "draft_saved" ? "in_progress" : "queued",
    qa_mode: qaMode,
    routing_mode: "push",
    revision: status === "draft_saved" ? 1 : 0,
    updated_at: now,
    project_id: project.id,
    project_name: project.name,
    task_id: taskId,
    task_instance_id: taskId,
    task_title: taskPayloads[taskType].headline,
    task_type: taskType,
    priority: index % 2 ? "high" : "normal",
    due_label: index % 2 ? "Сегодня" : "На этой неделе",
    completion: completion(filled, expected),
    review_queue_status: status === "submitted" ? "ready_for_review" : "not_reviewable",
    review_queue_label: status === "submitted" ? "Готово к проверке" : "Не для проверки",
    assignment_group_id: qaMode === "overlap" ? "demo-overlap-group" : null,
    peer_count: qaMode === "overlap" ? 1 : 0,
    is_gold: qaMode === "gold",
    open_case_count: 0,
    available_transitions: status === "submitted" ? [] : ["save_draft", "submit"],
  };
  const task = {
    id: taskId,
    project_id: project.id,
    title: taskPayloads[taskType].headline,
    description: project.summary,
    task_type: taskType,
    task_schema_id: `schema-${taskType}`,
    task_schema_version: 1,
    priority: card.priority,
    due_label: card.due_label,
    payload: taskPayloads[taskType],
  };
  return {
    card,
    detail: {
      assignment: {
        id,
        status: card.status,
        stored_status: card.stored_status,
        task_instance_id: taskId,
        available_transitions: card.available_transitions,
        routing_mode: "push",
        revision: card.revision,
        updated_at: now,
        submitted_at: status === "submitted" ? now : null,
        qa_mode: qaMode,
        draft: {},
        submitted_payload: null,
        completion: card.completion,
        latest_submission: null,
      },
      task,
      task_view: task,
      task_instance: { ...task, source_ref: null },
      task_schema: {
        id: `schema-${taskType}`,
        project_id: project.id,
        task_type: taskType,
        version: 1,
        status: "published",
        title: taskPayloads[taskType].headline,
        description: "Синтетическая схема для демонстрационного стенда Cloudflare.",
        config: { family: taskType, supports_note: true, confidence_scale: [1, 2, 3, 4, 5] },
        preview_payload: taskPayloads[taskType],
        created_at: now,
        published_at: now,
        created_by: "cloudflare-demo-generator",
      },
      project,
      assignment_group: null,
      peer_assignments: [],
      gold_benchmark: qaMode === "gold" ? { expected_label: "ошибка интерфейса", tolerance: "demo" } : null,
      workflow: {
        stored_status: card.stored_status,
        canonical_status: card.status,
        task_instance_id: taskId,
        draft_revision_count: status === "draft_saved" ? 1 : 0,
        submission_count: status === "submitted" ? 1 : 0,
        review_pass_count: 0,
        disagreement_case_count: 0,
        adjudication_pass_count: 0,
        audit_event_count: 1,
        available_transitions: card.available_transitions,
        is_rework_loop: false,
      },
      draft_revisions: [],
      submission_history: [],
      review_passes: [],
      disagreement_cases: [],
      adjudication_passes: [],
      quality_signals: [
        { id: `${id}-signal-1`, label: "Срок", value: "в норме", severity: "info" },
        { id: `${id}-signal-2`, label: "Качество", value: "демо", severity: "success" },
      ],
      audit_events: [{ id: `${id}-audit-1`, action: "demo_created", created_at: now }],
      review_workspace: {
        reviewer_id: "reviewer1",
        can_review: status === "submitted",
        can_adjudicate: false,
        latest_submission_sequence: status === "submitted" ? 1 : null,
        review_queue_status: card.review_queue_status,
        review_queue_label: card.review_queue_label,
        recommended_outcomes: ["approve", "needs_rework"],
        reviewer_checklist: ["Проверить заполненность.", "Проверить комментарии."],
        open_case_navigation: [],
        qa_drilldown: [],
      },
      help: [{ id: "demo-help", title: "Демонстрационный режим", body: "Все данные синтетические." }],
    },
  };
}

const assignmentEntries = [
  assignment("demo-assignment-001", projects[0], 1, "draft_saved"),
  assignment("demo-assignment-002", projects[1], 2, "assigned"),
  assignment("demo-assignment-003", projects[2], 3, "assigned", "overlap"),
  assignment("demo-assignment-004", projects[3], 4, "assigned"),
  assignment("demo-assignment-005", projects[1], 5, "assigned", "gold"),
];

const assignments = Object.fromEntries(assignmentEntries.map((entry) => [entry.card.id, entry.detail]));
const assignmentCards = assignmentEntries.map((entry) => entry.card);

function summary(cards) {
  const result = {
    available: 0,
    assigned: 0,
    claimed: 0,
    draft_saved: 0,
    submitted: 0,
    in_review: 0,
    needs_rework: 0,
    approved: 0,
    escalated_to_adjudication: 0,
    blocked: 0,
    archived: 0,
    open_support: 0,
  };
  for (const card of cards) result[card.status] = (result[card.status] || 0) + 1;
  return result;
}

function projectCards(cards) {
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    summary: project.summary,
    status: project.status,
    accent: project.accent,
    task_type: project.task_type,
    counts: summary(cards.filter((card) => card.project_id === project.id)),
  }));
}

function dashboard(user, cards) {
  return {
    user,
    role: user.role,
    summary: summary(cards),
    projects: projectCards(cards),
    assignments: cards,
    support_requests: [],
    schema_previews: projects.map((project) => ({ id: `schema-${project.task_type}`, project_id: project.id, title: project.name, status: "published" })),
    quality_summary: { global: [{ label: "Демо-стенд", value: "активен" }], projects: [] },
    reviewer_surface: { sections: [], counts: {} },
  };
}

const users = {
  admin1: { id: "admin-1", username: "admin1", display_name: "Демо-администратор", role: "admin", scopes: ["admin", "support", "analytics"] },
  expert1: { id: "expert-1", username: "expert1", display_name: "Демо-эксперт", role: "expert", scopes: ["score", "label", "triplets", "pairwise"] },
  reviewer1: { id: "reviewer-1", username: "reviewer1", display_name: "Демо-проверяющий", role: "reviewer", scopes: ["review", "qa"] },
};

const snapshot = {
  generated_for: "cloudflare-safe-r2-demo",
  users: {
    admin1: {
      user: users.admin1,
      dashboard: dashboard(users.admin1, assignmentCards),
      assignments,
      admin_control_plane: {
        projects,
        schemas: projects.map((project) => ({ id: `schema-${project.task_type}`, project_id: project.id, status: "published", version: 1 })),
        operators: Object.values(users),
      },
      admin_routing: {
        queues: [{ id: "demo-main-queue", name: "Основная очередь", size: assignmentCards.length }],
        policies: [{ id: "demo-policy", name: "Синтетическая маршрутизация", status: "active" }],
        routes: [{ domain: "тупа.рф", path: "/expert", worker: "tupa-expert-free-worker" }],
      },
      admin_quality_center: {
        checks: [{ id: "demo-check", title: "Проверка демонстрационного контура", status: "active" }],
        overlap_groups: [{ id: "demo-overlap-group", status: "open", assignment_count: 2 }],
        gold_sets: [{ id: "demo-gold-set", status: "active", assignment_count: 1 }],
      },
      admin_import_export: {
        imports: [],
        exports: [{ id: "demo-export", label: "Синтетический экспорт", status: "available" }],
      },
    },
    expert1: {
      user: users.expert1,
      dashboard: dashboard(users.expert1, assignmentCards),
      assignments,
    },
    reviewer1: {
      user: users.reviewer1,
      dashboard: dashboard(users.reviewer1, assignmentCards.filter((card) => card.status === "submitted")),
      assignments,
    },
  },
  help: [
    { id: "login", title: "Вход", body: "Введите admin1, expert1 или reviewer1 и любой непустой пароль." },
    { id: "cloudflare", title: "Cloudflare", body: "Стенд работает через Worker и R2 без Yandex origin." },
  ],
};

const compactCards = [
  {
    id: "demo-task-1",
    status: "assigned",
    stored_status: "queued",
    revision: 0,
    updated_at: "2026-05-21T09:00:00Z",
    project_id: "demo-court",
    project_name: "Демо-проект",
    task_id: "task-demo-1",
    task_instance_id: "task-demo-1",
    task_title: "Оценка ответа",
    task_type: "rubric_scorecard",
    priority: "high",
    due_label: "Сегодня",
    completion: completion(0, 3),
    available_transitions: ["save_draft", "submit"],
  },
  {
    id: "demo-task-2",
    status: "assigned",
    stored_status: "queued",
    revision: 0,
    updated_at: "2026-05-21T10:00:00Z",
    project_id: "demo-taxonomy",
    project_name: "Демо-классификация",
    task_id: "task-demo-2",
    task_instance_id: "task-demo-2",
    task_title: "Классификация обращения",
    task_type: "classification",
    priority: "normal",
    due_label: "На этой неделе",
    completion: completion(0, 2),
    available_transitions: ["save_draft", "submit"],
  },
];

function compactDetail(card, payload) {
  const task = {
    id: card.task_id,
    project_id: card.project_id,
    title: card.task_title,
    description: "Синтетическое демонстрационное задание.",
    task_type: card.task_type,
    task_schema_id: `schema-${card.task_type}`,
    task_schema_version: 1,
    priority: card.priority,
    due_label: card.due_label,
    payload,
  };
  return {
    assignment: {
      id: card.id,
      status: card.status,
      stored_status: card.stored_status,
      task_instance_id: card.task_instance_id,
      available_transitions: card.available_transitions,
      revision: card.revision,
      updated_at: card.updated_at,
      draft: {},
      submitted_payload: null,
      completion: card.completion,
    },
    task,
    task_view: task,
    task_instance: task,
    task_schema: { id: task.task_schema_id, task_type: card.task_type, version: 1, status: "published", config: { family: card.task_type } },
    project: projects.find((project) => project.id === card.project_id),
    workflow: { stored_status: card.stored_status, canonical_status: card.status, available_transitions: card.available_transitions },
    review_workspace: { can_review: false, can_adjudicate: false, reviewer_checklist: [] },
    help: [{ id: "demo", title: "Демо", body: "Данные синтетические." }],
  };
}

const compactAssignments = {
  "demo-task-1": compactDetail(compactCards[0], taskPayloads.rubric_scorecard),
  "demo-task-2": compactDetail(compactCards[1], taskPayloads.classification),
};

const compactSnapshot = {
  generated_for: "cloudflare-safe-r2-demo-compact",
  users: {
    admin1: {
      user: users.admin1,
      dashboard: dashboard(users.admin1, compactCards),
      assignments: compactAssignments,
      admin_control_plane: { projects, schemas: [], operators: Object.values(users) },
      admin_routing: { routes: [{ domain: "тупа.рф", path: "/expert" }], queues: [] },
      admin_quality_center: { checks: [{ id: "demo-check", title: "Демо-проверка", status: "active" }] },
      admin_import_export: { imports: [], exports: [] },
    },
    expert1: { user: users.expert1, dashboard: dashboard(users.expert1, compactCards), assignments: compactAssignments },
    reviewer1: { user: users.reviewer1, dashboard: dashboard(users.reviewer1, compactCards), assignments: compactAssignments },
  },
  help: [
    { id: "login", title: "Вход", body: "Логины: admin1, expert1, reviewer1. Пароль: любой непустой." },
    { id: "cloudflare", title: "Cloudflare", body: "Платформа работает на Cloudflare Worker и R2." },
  ],
};

const minimalRenderer = `const e=(v)=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const labels={available:"доступно",assigned:"назначено",claimed:"взято",draft_saved:"черновик",submitted:"отправлено",approved:"принято",needs_rework:"доработка",blocked:"заблокировано",open_support:"обращения",in_review:"проверка"};
const l=(k)=>labels[k]||k||"-";
const s=(d)=>Object.entries(d.summary||{}).filter(([,v])=>v).map(([k,v])=>\`<div class="summary-card"><strong>\${e(v)}</strong><span>\${e(l(k))}</span></div>\`).join("");
const p=(d)=>((d.projects||[]).map(x=>\`<button class="project-pill" data-assignment-id="\${e((d.assignments||[]).find(a=>a.project_id===x.id)?.id||"")}"><strong>\${e(x.name)}</strong><span>\${e(x.summary||"")}</span></button>\`).join(""));
const a=(d,id)=>((d.assignments||[]).map(x=>\`<button class="assignment-card \${x.id===id?"active":""}" data-assignment-id="\${e(x.id)}"><strong>\${e(x.task_title||x.id)}</strong><span>\${e(x.project_name||"")}</span><span class="status-chip">\${e(l(x.status))}</span></button>\`).join(""));
export function renderDashboardShell({dashboard,sessionRole,selectedAssignmentId}){const admin=sessionRole==="admin";return{summaryHtml:s(dashboard),projectsHtml:p(dashboard),assignmentsHtml:a(dashboard,selectedAssignmentId),adminVisible:admin,adminWorkspaceHtml:admin?'<div class="stack-item"><strong>Административный демо-стенд</strong><div class="subtle">Cloudflare Worker + R2, источник Yandex отключен</div></div>':"",adminSupportHtml:"",adminSchemaHtml:"",adminQualityHtml:"",adminControlHtml:""}}
export function wireDashboardSelection(c,onSelect){c?.querySelectorAll("[data-assignment-id]").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.assignmentId)onSelect(b.dataset.assignmentId)}))}
export function renderHelpPane(items,selectedHelpId){const first=selectedHelpId||items?.[0]?.id;const item=(items||[]).find(x=>x.id===first)||items?.[0]||{};return{nextSelectedHelpId:first,listHtml:(items||[]).map(x=>\`<button data-help-id="\${e(x.id)}">\${e(x.title)}</button>\`).join(""),articleHtml:\`<h3>\${e(item.title||"Справка")}</h3><p>\${e(item.body||"")}</p>\`}}
export function wireHelpSelection(c,onSelect){c?.querySelectorAll("[data-help-id]").forEach(b=>b.addEventListener("click",()=>onSelect(b.dataset.helpId)))}
export function renderReviewerPanel(){return '<div class="subtle">Проверка доступна после отправки задания.</div>'}
export function renderExecutionHistory(){return '<div class="subtle">История действий пуста.</div>'}
export function renderAgentLog(messages){const r={assistant:"Агент",user:"Вы"};return(messages||[]).map(m=>\`<div class="agent-message \${e(m.role)}"><strong>\${e(r[m.role]||m.role)}</strong><div>\${e(m.text)}</div></div>\`).join("")}`;

const ultraCard = {
  id: "demo-task-1",
  status: "assigned",
  stored_status: "queued",
  revision: 0,
  updated_at: "2026-05-21T09:00:00Z",
  project_id: "demo-project",
  project_name: "Демо-проект",
  task_id: "task-demo-1",
  task_instance_id: "task-demo-1",
  task_title: "Оценка ответа",
  task_type: "classification",
  priority: "high",
  due_label: "Сегодня",
  completion: completion(0, 2),
  available_transitions: ["save_draft", "submit"],
};
const ultraUsers = {
  admin1: { id: "admin-1", username: "admin1", display_name: "Демо-администратор", role: "admin", scopes: ["admin"] },
  expert1: { id: "expert-1", username: "expert1", display_name: "Демо-эксперт", role: "expert", scopes: ["score"] },
  reviewer1: { id: "reviewer-1", username: "reviewer1", display_name: "Демо-проверяющий", role: "reviewer", scopes: ["review"] },
};
const ultraProject = { id: "demo-project", name: "Демо-проект", summary: "Синтетический стенд.", status: "active", accent: "ocean", task_type: "classification" };
const ultraDashboard = (user) => ({
  user,
  role: user.role,
  summary: { assigned: 1, draft_saved: 0, submitted: 0, approved: 0 },
  projects: [{ ...ultraProject, counts: { assigned: 1 } }],
  assignments: [ultraCard],
  support_requests: [],
  schema_previews: [],
  quality_summary: { global: [], projects: [] },
  reviewer_surface: { sections: [], counts: {} },
});
const ultraAssignments = {
  "demo-task-1": {
    assignment: { id: "demo-task-1", status: "assigned", stored_status: "queued", task_instance_id: "task-demo-1", available_transitions: ["save_draft", "submit"], revision: 0, updated_at: "2026-05-21T09:00:00Z", draft: {}, completion: completion(0, 2) },
    task: { id: "task-demo-1", project_id: "demo-project", title: "Оценка ответа", description: "Синтетическое задание.", task_type: "classification", task_schema_id: "schema-demo", task_schema_version: 1, priority: "high", due_label: "Сегодня", payload: { headline: "Классификация обращения", text: "Демо-обращение: пользователь не видит отчет после отправки формы.", options: [{ id: "bug", title: "Ошибка", description: "Сбой продукта" }, { id: "question", title: "Вопрос", description: "Нужна консультация" }, { id: "idea", title: "Идея", description: "Запрос улучшения" }] } },
    task_view: { id: "task-demo-1", title: "Оценка ответа", description: "Синтетическое задание.", task_type: "classification", task_schema_id: "schema-demo", task_schema_version: 1, payload: { headline: "Классификация обращения", text: "Демо-обращение: пользователь не видит отчет после отправки формы.", options: [{ id: "bug", title: "Ошибка", description: "Сбой продукта" }, { id: "question", title: "Вопрос", description: "Нужна консультация" }, { id: "idea", title: "Идея", description: "Запрос улучшения" }] } },
    task_instance: { id: "task-demo-1", project_id: "demo-project", task_schema_id: "schema-demo", task_schema_version: 1, title: "Оценка ответа", description: "Синтетическое задание.", priority: "high", due_label: "Сегодня", payload: { headline: "Классификация обращения", text: "Демо-обращение: пользователь не видит отчет после отправки формы.", options: [{ id: "bug", title: "Ошибка", description: "Сбой продукта" }, { id: "question", title: "Вопрос", description: "Нужна консультация" }, { id: "idea", title: "Идея", description: "Запрос улучшения" }] }, source_ref: null },
    task_schema: { id: "schema-demo", project_id: "demo-project", task_type: "classification", version: 1, status: "published", title: "Классификация", description: "Синтетическая схема.", config: { family: "classification" }, preview_payload: { headline: "Классификация обращения", text: "Демо-обращение: пользователь не видит отчет после отправки формы.", options: [{ id: "bug", title: "Ошибка", description: "Сбой продукта" }, { id: "question", title: "Вопрос", description: "Нужна консультация" }, { id: "idea", title: "Идея", description: "Запрос улучшения" }] } },
    project: ultraProject,
    workflow: { stored_status: "queued", canonical_status: "assigned", available_transitions: ["save_draft", "submit"] },
    draft_revisions: [],
    submission_history: [],
    review_passes: [],
    disagreement_cases: [],
    adjudication_passes: [],
    quality_signals: [],
    audit_events: [],
    review_workspace: { can_review: false, can_adjudicate: false },
    help: [{ id: "demo", title: "Демо", body: "Данные синтетические." }],
  },
};
const ultraSnapshot = {
  generated_for: "cloudflare-ultra-safe-demo",
  users: {
    admin1: { user: ultraUsers.admin1, dashboard: ultraDashboard(ultraUsers.admin1), assignments: ultraAssignments, admin_control_plane: { projects: [ultraProject] }, admin_routing: { routes: [{ domain: "тупа.рф", path: "/expert" }] }, admin_quality_center: { checks: [] }, admin_import_export: { imports: [], exports: [] } },
    expert1: { user: ultraUsers.expert1, dashboard: ultraDashboard(ultraUsers.expert1), assignments: ultraAssignments },
    reviewer1: { user: ultraUsers.reviewer1, dashboard: ultraDashboard(ultraUsers.reviewer1), assignments: ultraAssignments },
  },
  help: [{ id: "login", title: "Вход", body: "Логины: admin1, expert1, reviewer1. Пароль любой." }],
};

fs.rmSync(targetPublic, { recursive: true, force: true });
fs.mkdirSync(targetPublic, { recursive: true });
fs.copyFileSync(path.join(sourcePublic, "index.html"), path.join(targetPublic, "index.html"));
copyDir(path.join(sourcePublic, "static"), path.join(targetPublic, "static"));
fs.writeFileSync(path.join(targetPublic, "static", "js", "ui_shell_renderers.js"), minimalRenderer, "utf8");
fs.writeFileSync(path.join(targetPublic, "snapshot.json"), JSON.stringify(ultraSnapshot), "utf8");
const embeddedModule = [
  "export const SAFE_SNAPSHOT = ",
  JSON.stringify(ultraSnapshot),
  ";\n\nexport const EMBEDDED_SAFE_ASSETS = ",
  JSON.stringify({
    "static/js/ui_shell_renderers.js": minimalRenderer,
  }),
  ";\n",
].join("");
fs.writeFileSync(path.join(root, "src", "embedded_safe_assets.js"), embeddedModule, "utf8");
console.log(`safe_bundle=${targetPublic}`);
