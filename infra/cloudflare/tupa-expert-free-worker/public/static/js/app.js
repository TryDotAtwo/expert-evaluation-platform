const state = {
  token: localStorage.getItem("expert_platform_token") || "",
  email: "",
  meta: { legal_areas: [] },
  session: null,
  dashboard: null,
  selectedAssignmentId: "",
  selectedAssignment: null,
  selectedProjectId: localStorage.getItem("expert_platform_project") || "",
  selectedAdminProjectId: localStorage.getItem("expert_platform_admin_project") || "",
  selectedAdminAssignmentId: localStorage.getItem("expert_platform_admin_assignment") || "",
  selectedAdminUserId: localStorage.getItem("expert_platform_admin_user") || "",
  adminActiveTab: localStorage.getItem("expert_platform_admin_tab") || "summary",
  menuCollapsed: localStorage.getItem("expert_platform_menu_collapsed") === "1",
  search: "",
  agentMessages: [
    { role: "assistant", text: "Чат готов. Напишите вопрос по выбранному заданию." },
  ],
};

const els = {
  authScreen: document.getElementById("auth-screen"),
  workspace: document.getElementById("workspace"),
  menuToggle: document.getElementById("menu-toggle"),
  authTabs: document.getElementById("auth-tabs"),
  passwordLoginForm: document.getElementById("password-login-form"),
  loginEmail: document.getElementById("login-email"),
  loginPassword: document.getElementById("login-password"),
  googleLoginButton: document.getElementById("google-login-button"),
  passwordSetupOpen: document.getElementById("password-setup-open"),
  passwordSetupForm: document.getElementById("password-setup-form"),
  passwordSetupRequest: document.getElementById("password-setup-request"),
  setupEmail: document.getElementById("setup-email"),
  setupPassword: document.getElementById("setup-password"),
  setupCode: document.getElementById("setup-code"),
  registrationForm: document.getElementById("registration-form"),
  registerEmail: document.getElementById("register-email"),
  registerPassword: document.getElementById("register-password"),
  registerDisplayName: document.getElementById("register-display-name"),
  registerContact: document.getElementById("register-contact"),
  registerCoauthorConsent: document.getElementById("register-coauthor-consent"),
  registerWantsReviewer: document.getElementById("register-wants-reviewer"),
  registrationAreaGrid: document.getElementById("registration-area-grid"),
  authNote: document.getElementById("auth-note"),
  syncStatus: document.getElementById("sync-status"),
  profileButton: document.getElementById("profile-button"),
  logoutButton: document.getElementById("logout-button"),
  modeSwitch: document.getElementById("mode-switch"),
  assignmentSearch: document.getElementById("assignment-search"),
  assignmentList: document.getElementById("assignment-list"),
  compactProjectList: document.getElementById("compact-project-list"),
  taskCard: document.getElementById("task-card"),
  adminSurface: document.getElementById("admin-surface"),
  refreshButton: document.getElementById("refresh-button"),
  agentLog: document.getElementById("agent-log"),
  agentForm: document.getElementById("agent-form"),
  agentInput: document.getElementById("agent-input"),
  drawerBackdrop: document.getElementById("drawer-backdrop"),
  profileDrawer: document.getElementById("profile-drawer"),
  drawerClose: document.getElementById("drawer-close"),
  profileForm: document.getElementById("profile-form"),
  profileDisplayName: document.getElementById("profile-display-name"),
  profileCoauthorConsent: document.getElementById("profile-coauthor-consent"),
  profileWantsReviewer: document.getElementById("profile-wants-reviewer"),
  legalAreaGrid: document.getElementById("legal-area-grid"),
  toastStack: document.getElementById("toast-stack"),
};

const labels = {
  assigned: "назначено",
  claimed: "взято",
  draft_saved: "черновик",
  submitted: "отправлено",
  approved: "принято",
  needs_rework: "доработка",
  pending: "ожидает",
  rejected: "отклонено",
  classification: "классификация",
  rubric_scorecard: "рубрика",
  pairwise_preference: "сравнение",
  triplet_similarity: "близость",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setSync(value) {
  els.syncStatus.textContent = value;
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  els.toastStack.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function syncMenuState() {
  els.workspace.classList.toggle("menu-collapsed", state.menuCollapsed);
  els.menuToggle?.setAttribute("aria-expanded", String(!state.menuCollapsed));
  els.menuToggle?.setAttribute("aria-label", state.menuCollapsed ? "Развернуть меню" : "Свернуть меню");
  localStorage.setItem("expert_platform_menu_collapsed", state.menuCollapsed ? "1" : "0");
}

function toggleMenu() {
  state.menuCollapsed = !state.menuCollapsed;
  syncMenuState();
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers["content-type"] = "application/json";
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const type = response.headers.get("content-type") || "";
  const body = type.includes("application/json") ? await response.json() : await response.text();
  if (response.status === 401 && !path.startsWith("/api/auth/")) {
    hardLogout();
    throw new Error("Требуется вход.");
  }
  if (!response.ok) {
    const detail = body?.detail || body?.provider_error || body || "Ошибка запроса.";
    throw new Error(detail);
  }
  return body;
}

function hardLogout() {
  state.token = "";
  state.session = null;
  state.dashboard = null;
  state.selectedAssignmentId = "";
  state.selectedAssignment = null;
  localStorage.removeItem("expert_platform_token");
  els.authScreen.classList.remove("hidden");
  els.workspace.classList.add("hidden");
  els.profileButton.classList.add("hidden");
  els.logoutButton.classList.add("hidden");
  els.modeSwitch.classList.add("hidden");
  closeDrawer();
}

async function loadMeta() {
  state.meta = await api("/api/meta").catch(() => ({ legal_areas: [] }));
  renderRegistrationAreas();
  if (els.googleLoginButton) {
    els.googleLoginButton.title = state.meta.google_auth_enabled ? "Google вход" : "Google вход будет активен после добавления GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.";
  }
}

function renderRegistrationAreas() {
  if (!els.registrationAreaGrid) return;
  els.registrationAreaGrid.innerHTML = (state.meta.legal_areas || []).map((area) => `
    <label class="area-check"><input type="checkbox" name="legal_area" value="${escapeHtml(area)}" />${escapeHtml(area)}</label>
  `).join("");
}

async function loadSession() {
  const data = await api("/api/session");
  state.session = data.user;
  renderChrome();
}

async function loadDashboard(preferredAssignmentId = "") {
  setSync("загрузка");
  const dashboard = await api("/api/dashboard");
  state.dashboard = dashboard;
  const nextAssignmentId = preferredAssignmentId || state.selectedAssignmentId || dashboard.assignments?.[0]?.id || "";
  renderDashboard();
  if (nextAssignmentId) await selectAssignment(nextAssignmentId);
  setSync("готово");
}

function renderChrome() {
  els.authScreen.classList.add("hidden");
  els.workspace.classList.remove("hidden");
  els.profileButton.classList.remove("hidden");
  els.logoutButton.classList.remove("hidden");
  els.modeSwitch.classList.remove("hidden");
  syncMenuState();
  const mode = state.session?.mode || "expert";
  els.modeSwitch.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
}

function statusChip(status) {
  return `<span class="chip ${escapeHtml(status)}">${escapeHtml(labels[status] || status || "-")}</span>`;
}

function renderDashboard() {
  const dashboard = state.dashboard || { assignments: [], projects: [], summary: {} };
  const projects = dashboard.projects || [];
  const assignments = dashboard.assignments || [];
  const totalAssignments = assignments.length;
  const projectButtons = projects.map((project) => {
    const membership = project.membership_status || project.access || "available";
    const isActive = membership === "active";
    const isRequested = membership === "requested";
    const isLocked = membership === "locked";
    const count = assignments.filter((assignment) => assignment.project_id === project.id).length;
    const actionLabel = isActive ? "доступ" : isRequested ? "запрошено" : isLocked ? "закрыто" : "подключить";
    return `
      <article class="project-menu-item">
        <button class="project-menu-button ${project.id === state.selectedProjectId ? "active" : ""}" type="button" data-project-filter="${escapeHtml(project.id)}">
          <span>
            <strong>${escapeHtml(project.name)}</strong>
            <small>${escapeHtml(labels[project.task_type] || project.task_type)} · ${escapeHtml(project.required_area || "область не задана")}</small>
          </span>
          <em>${escapeHtml(count)}</em>
        </button>
        <button class="project-access-action" type="button" data-join-project="${escapeHtml(project.id)}" ${isActive || isRequested || isLocked ? "disabled" : ""}>${escapeHtml(actionLabel)}</button>
      </article>
    `;
  }).join("");
  els.compactProjectList.innerHTML = `
    <button class="project-menu-button all-projects ${state.selectedProjectId ? "" : "active"}" type="button" data-project-filter="">
      <span><strong>Все проекты</strong><small>Полная рабочая очередь</small></span>
      <em>${escapeHtml(totalAssignments)}</em>
    </button>
    ${projectButtons || `<div class="empty-inline">Проекты не найдены.</div>`}
  `;

  const query = state.search.toLowerCase();
  const items = assignments.filter((item) => {
    const byProject = !state.selectedProjectId || item.project_id === state.selectedProjectId;
    const haystack = `${item.task_title} ${item.project_name} ${item.task_type} ${item.status}`.toLowerCase();
    return byProject && (!query || haystack.includes(query));
  });
  els.assignmentList.innerHTML = items.map((item) => `
    <button class="assignment-card ${item.id === state.selectedAssignmentId ? "active" : ""}" type="button" data-assignment-id="${escapeHtml(item.id)}">
      <div class="row">
        <strong>${escapeHtml(item.task_title)}</strong>
        ${statusChip(item.status)}
      </div>
      <div class="assignment-meta">
        <span class="task-type-chip ${escapeHtml(item.task_type)}">${escapeHtml(labels[item.task_type] || item.task_type)}</span>
        <small>${escapeHtml(item.project_name)} · ${escapeHtml(item.due_label)}</small>
      </div>
    </button>
  `).join("") || `<div class="empty-state"><p>Задания не найдены.</p></div>`;

  els.assignmentList.querySelectorAll("[data-assignment-id]").forEach((button) => {
    button.addEventListener("click", () => selectAssignment(button.dataset.assignmentId));
  });
  els.compactProjectList.querySelectorAll("[data-project-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedProjectId = button.dataset.projectFilter || "";
      localStorage.setItem("expert_platform_project", state.selectedProjectId);
      renderDashboard();
    });
  });
  els.compactProjectList.querySelectorAll("[data-join-project]").forEach((button) => {
    button.addEventListener("click", () => joinProject(button.dataset.joinProject));
  });
  renderAdminSurface();
}

function renderAdminSurfaceLegacy() {
  const admin = state.dashboard?.admin_surface;
  if (!admin) {
    els.adminSurface.classList.add("hidden");
    return;
  }
  const applications = admin.applications || [];
  const pendingCount = applications.filter((item) => item.status === "pending").length;
  const exports = admin.import_export?.exports || [];
  els.adminSurface.classList.remove("hidden");
  els.adminSurface.innerHTML = `
    <div class="rail-header">
      <div><span class="eyebrow">Администрирование</span><h2>Контроль платформы</h2></div>
    </div>
    <div class="admin-grid">
      <div class="admin-item"><strong>Заявки</strong><p>${escapeHtml(pendingCount)} ожидают решения</p></div>
      <div class="admin-item"><strong>Качество</strong><p>Отправлено: ${escapeHtml(admin.quality?.submitted || 0)}, принято: ${escapeHtml(admin.quality?.approved || 0)}</p></div>
      <div class="admin-item"><strong>Маршрутизация</strong><p>${escapeHtml(admin.routing?.length || 0)} активных проектов</p></div>
      <div class="admin-item"><strong>Экспорт</strong><p>${escapeHtml(exports.length)} проектов доступны в JSON</p></div>
    </div>
    <section class="admin-section">
      <div class="admin-section-head"><div><span class="eyebrow">Заявки</span><h3>Регистрация экспертов</h3></div></div>
      <div class="application-list">
        ${applications.map((application) => `
          <article class="application-card" data-application-id="${escapeHtml(application.id)}">
            <header>
              <div>
                <strong>${escapeHtml(application.display_name)}</strong>
                <small>${escapeHtml(application.email)} · ${escapeHtml(application.contact)}</small>
              </div>
              ${statusChip(application.status)}
            </header>
            <div class="application-meta">
              ${(application.legal_areas || []).map((area) => `<span class="chip">${escapeHtml(area)}</span>`).join("")}
              ${application.wants_reviewer ? `<span class="chip">хочет ревью</span>` : ""}
              ${application.coauthor_consent ? `<span class="chip">можно упоминать</span>` : ""}
            </div>
            <div class="application-decision">
              <label>Комментарий<textarea name="admin_note" rows="2" placeholder="виден в письме"></textarea></label>
              <label>Регалии<textarea name="admin_credentials" rows="2" placeholder="админ заполняет при необходимости"></textarea></label>
              <button class="primary-button" type="button" data-application-decision="approved">Принять</button>
              <button class="danger-button" type="button" data-application-decision="rejected">Отклонить</button>
            </div>
          </article>
        `).join("") || `<div class="empty-inline">Заявок нет.</div>`}
      </div>
    </section>
    <section class="admin-section">
      <div class="admin-section-head"><div><span class="eyebrow">Экспорт</span><h3>Результаты по проектам</h3></div></div>
      <div class="export-list">
        ${exports.map((item) => `
          <div class="export-row">
            <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.project_id)}</small></div>
            <button class="secondary-button" type="button" data-export-project="${escapeHtml(item.project_id)}">Скачать JSON</button>
          </div>
        `).join("") || `<div class="empty-inline">Проекты не найдены.</div>`}
      </div>
    </section>
  `;
  els.adminSurface.querySelectorAll("[data-application-decision]").forEach((button) => {
    button.addEventListener("click", () => decideApplication(button).catch((error) => toast(error.message)));
  });
  els.adminSurface.querySelectorAll("[data-export-project]").forEach((button) => {
    button.addEventListener("click", () => downloadProjectExport(button.dataset.exportProject).catch((error) => toast(error.message)));
  });
}

const adminTabs = [
  ["summary", "Сводка"],
  ["applications", "Заявки"],
  ["experts", "Эксперты"],
  ["projects", "Проекты"],
  ["assignments", "Задания"],
  ["create", "Создать"],
  ["export", "Экспорт"],
];

const taskTypeOptions = [
  ["classification", "Классификация"],
  ["rubric_scorecard", "Рубрика"],
  ["pairwise_preference", "Сравнение"],
  ["triplet_similarity", "Близость"],
];

const roleLabels = { admin: "админ", expert: "эксперт", reviewer: "ревьювер" };

function displayDate(value) {
  return value ? new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";
}

function adminContext(admin) {
  const projects = state.dashboard?.projects || [];
  const assignments = state.dashboard?.assignments || [];
  const experts = admin.experts || [];
  const applications = admin.applications || [];
  const exports = admin.import_export?.exports || [];
  if (!state.selectedAdminProjectId && projects[0]) state.selectedAdminProjectId = projects[0].id;
  if (!state.selectedAdminAssignmentId && assignments[0]) state.selectedAdminAssignmentId = assignments[0].id;
  if (!state.selectedAdminUserId && experts[0]) state.selectedAdminUserId = experts[0].id;
  const selectedProject = projects.find((item) => item.id === state.selectedAdminProjectId) || projects[0] || null;
  const selectedAssignment = assignments.find((item) => item.id === state.selectedAdminAssignmentId) || assignments[0] || null;
  const selectedUser = experts.find((item) => item.id === state.selectedAdminUserId) || experts[0] || null;
  if (selectedProject) state.selectedAdminProjectId = selectedProject.id;
  if (selectedAssignment) state.selectedAdminAssignmentId = selectedAssignment.id;
  if (selectedUser) state.selectedAdminUserId = selectedUser.id;
  return { projects, assignments, experts, applications, exports, selectedProject, selectedAssignment, selectedUser };
}

function metricCard(label, value, note = "") {
  return `<div class="admin-item"><strong>${escapeHtml(value)}</strong><p>${escapeHtml(label)}${note ? ` · ${escapeHtml(note)}` : ""}</p></div>`;
}

function adminTabNav() {
  return `
    <nav class="admin-tabs" aria-label="Администрирование">
      ${adminTabs.map(([id, label]) => `
        <button class="${state.adminActiveTab === id ? "active" : ""}" type="button" data-admin-tab="${escapeHtml(id)}">${escapeHtml(label)}</button>
      `).join("")}
    </nav>
  `;
}

function adminPills(items = []) {
  return items.length ? items.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("") : `<span class="chip">не задано</span>`;
}

function renderAdminSummary(admin, ctx) {
  const pendingCount = ctx.applications.filter((item) => item.status === "pending").length;
  const reviewerCount = ctx.experts.filter((item) => item.role === "reviewer" || item.wants_reviewer).length;
  const submitted = admin.quality?.submitted || 0;
  const approved = admin.quality?.approved || 0;
  return `
    <section class="admin-section">
      <div class="admin-grid">
        ${metricCard("заявки ждут решения", pendingCount)}
        ${metricCard("профили в системе", ctx.experts.length, `${reviewerCount} ревью`)}
        ${metricCard("активные проекты", ctx.projects.length)}
        ${metricCard("экспертизы", submitted, `${approved} принято`)}
      </div>
    </section>
    <section class="admin-section admin-two-column">
      <div>
        <div class="admin-section-head"><div><span class="eyebrow">Фокус</span><h3>Ближайшие решения</h3></div></div>
        <div class="application-list compact">
          ${ctx.applications.slice(0, 4).map(renderApplicationCard).join("") || `<div class="empty-inline">Заявок нет.</div>`}
        </div>
      </div>
      <div>
        <div class="admin-section-head"><div><span class="eyebrow">Работа</span><h3>Последние задания</h3></div></div>
        <div class="admin-list">
          ${ctx.assignments.slice(0, 6).map(renderAdminAssignmentRow).join("") || `<div class="empty-inline">Заданий нет.</div>`}
        </div>
      </div>
    </section>
  `;
}

function renderApplicationCard(application) {
  const decided = application.status !== "pending";
  return `
    <article class="application-card" data-application-id="${escapeHtml(application.id)}">
      <header>
        <div>
          <strong>${escapeHtml(application.display_name)}</strong>
          <small>${escapeHtml(application.email)} · ${escapeHtml(application.contact)}</small>
        </div>
        ${statusChip(application.status)}
      </header>
      <div class="application-meta">
        ${adminPills(application.legal_areas || [])}
        ${application.wants_reviewer ? `<span class="chip">хочет ревью</span>` : ""}
        ${application.coauthor_consent ? `<span class="chip">можно упоминать</span>` : ""}
      </div>
      ${decided ? `
        <div class="admin-note-row">
          <span>решено ${escapeHtml(displayDate(application.decided_at))}</span>
          <strong>${escapeHtml(application.admin_note || "без комментария")}</strong>
        </div>
      ` : `
        <div class="application-decision">
          <label>Комментарий<textarea name="admin_note" rows="2" placeholder="виден в письме"></textarea></label>
          <label>Регалии<textarea name="admin_credentials" rows="2" placeholder="заполнит админ при необходимости"></textarea></label>
          <button class="primary-button" type="button" data-application-decision="approved">Принять</button>
          <button class="danger-button" type="button" data-application-decision="rejected">Отклонить</button>
        </div>
      `}
    </article>
  `;
}

function renderAdminApplications(ctx) {
  const pending = ctx.applications.filter((item) => item.status === "pending");
  const processed = ctx.applications.filter((item) => item.status !== "pending");
  return `
    <section class="admin-section">
      <div class="admin-section-head"><div><span class="eyebrow">Разбор заявок</span><h3>Новые кандидаты</h3></div></div>
      <div class="application-list">${pending.map(renderApplicationCard).join("") || `<div class="empty-inline">Новых заявок нет.</div>`}</div>
    </section>
    <section class="admin-section">
      <div class="admin-section-head"><div><span class="eyebrow">История</span><h3>Обработанные заявки</h3></div></div>
      <div class="application-list compact">${processed.map(renderApplicationCard).join("") || `<div class="empty-inline">История пуста.</div>`}</div>
    </section>
  `;
}

function renderExpertProfileCard(expert) {
  return `
    <article class="expert-profile-card ${expert.id === state.selectedAdminUserId ? "active" : ""}" data-admin-user="${escapeHtml(expert.id)}">
      <header>
        <div><strong>${escapeHtml(expert.display_name)}</strong><small>${escapeHtml(expert.email)}</small></div>
        <span class="chip">${escapeHtml(roleLabels[expert.role] || expert.role)}</span>
      </header>
      <div class="application-meta">
        ${adminPills(expert.legal_areas || [])}
        ${expert.coauthor_consent ? `<span class="chip">соавторство ок</span>` : ""}
        ${expert.wants_reviewer ? `<span class="chip">ревью ок</span>` : ""}
      </div>
    </article>
  `;
}

function renderAdminExperts(ctx) {
  const selected = ctx.selectedUser;
  return `
    <section class="admin-section admin-two-column wide-left">
      <div>
        <div class="admin-section-head"><div><span class="eyebrow">Профили экспертов</span><h3>Люди и доступы</h3></div></div>
        <div class="expert-grid">${ctx.experts.map(renderExpertProfileCard).join("") || `<div class="empty-inline">Профилей нет.</div>`}</div>
      </div>
      <aside class="admin-detail-panel">
        <span class="eyebrow">Профиль</span>
        ${selected ? `
          <h3>${escapeHtml(selected.display_name)}</h3>
          <div class="detail-table">
            <div><span>Email</span><strong>${escapeHtml(selected.email)}</strong></div>
            <div><span>Роль</span><strong>${escapeHtml(roleLabels[selected.role] || selected.role)}</strong></div>
            <div><span>Статус</span><strong>${escapeHtml(selected.status || "active")}</strong></div>
            <div><span>Режим</span><strong>${escapeHtml(selected.mode || "expert")}</strong></div>
            <div><span>Создан</span><strong>${escapeHtml(displayDate(selected.created_at))}</strong></div>
          </div>
          <div class="application-meta">${adminPills(selected.legal_areas || [])}</div>
          <div class="admin-note-row"><span>Регалии</span><strong>${escapeHtml(selected.admin_credentials || "не заполнены")}</strong></div>
        ` : `<div class="empty-inline">Выберите профиль.</div>`}
      </aside>
    </section>
  `;
}

function renderProjectCard(project, assignments) {
  const count = assignments.filter((item) => item.project_id === project.id).length;
  return `
    <article class="admin-select-card ${project.id === state.selectedAdminProjectId ? "active" : ""}" data-admin-project="${escapeHtml(project.id)}">
      <header><strong>${escapeHtml(project.name)}</strong><span class="chip">${escapeHtml(labels[project.task_type] || project.task_type)}</span></header>
      <p>${escapeHtml(project.summary || "Описание не задано.")}</p>
      <div class="application-meta">
        <span class="chip">${escapeHtml(project.required_area || "область не задана")}</span>
        <span class="chip">${escapeHtml(count)} заданий</span>
      </div>
    </article>
  `;
}

function renderAdminProjects(ctx) {
  const selected = ctx.selectedProject;
  const projectAssignments = selected ? ctx.assignments.filter((item) => item.project_id === selected.id) : [];
  return `
    <section class="admin-section admin-two-column wide-left">
      <div>
        <div class="admin-section-head"><div><span class="eyebrow">Профиль проекта</span><h3>Проекты платформы</h3></div></div>
        <div class="project-admin-grid">${ctx.projects.map((project) => renderProjectCard(project, ctx.assignments)).join("") || `<div class="empty-inline">Проектов нет.</div>`}</div>
      </div>
      <aside class="admin-detail-panel">
        <span class="eyebrow">Проект</span>
        ${selected ? `
          <h3>${escapeHtml(selected.name)}</h3>
          <p>${escapeHtml(selected.summary || "")}</p>
          <div class="detail-table">
            <div><span>ID</span><strong>${escapeHtml(selected.id)}</strong></div>
            <div><span>Тип</span><strong>${escapeHtml(labels[selected.task_type] || selected.task_type)}</strong></div>
            <div><span>Область</span><strong>${escapeHtml(selected.required_area || "не задана")}</strong></div>
            <div><span>Статус</span><strong>${escapeHtml(selected.status || "active")}</strong></div>
            <div><span>Задания</span><strong>${escapeHtml(projectAssignments.length)}</strong></div>
          </div>
          <button class="secondary-button" type="button" data-export-project="${escapeHtml(selected.id)}">Скачать JSON проекта</button>
        ` : `<div class="empty-inline">Выберите проект.</div>`}
      </aside>
    </section>
  `;
}

function renderAdminAssignmentRow(assignment) {
  return `
    <article class="admin-assignment-row ${assignment.id === state.selectedAdminAssignmentId ? "active" : ""}" data-admin-assignment="${escapeHtml(assignment.id)}">
      <div>
        <strong>${escapeHtml(assignment.task_title)}</strong>
        <small>${escapeHtml(assignment.project_name)} · ${escapeHtml(labels[assignment.task_type] || assignment.task_type)}</small>
      </div>
      <div class="application-meta">
        ${statusChip(assignment.status)}
        <span class="chip">${escapeHtml(assignment.due_label || "без срока")}</span>
      </div>
    </article>
  `;
}

function renderAdminAssignments(ctx) {
  const selected = ctx.selectedAssignment;
  const selectedProject = selected ? ctx.projects.find((item) => item.id === selected.project_id) : null;
  return `
    <section class="admin-section admin-two-column wide-left">
      <div>
        <div class="admin-section-head"><div><span class="eyebrow">Профиль задания</span><h3>Очередь и состояние</h3></div></div>
        <div class="admin-list">${ctx.assignments.map(renderAdminAssignmentRow).join("") || `<div class="empty-inline">Заданий нет.</div>`}</div>
      </div>
      <aside class="admin-detail-panel">
        <span class="eyebrow">Задание</span>
        ${selected ? `
          <h3>${escapeHtml(selected.task_title)}</h3>
          <div class="detail-table">
            <div><span>ID</span><strong>${escapeHtml(selected.id)}</strong></div>
            <div><span>Проект</span><strong>${escapeHtml(selected.project_name)}</strong></div>
            <div><span>Тип</span><strong>${escapeHtml(labels[selected.task_type] || selected.task_type)}</strong></div>
            <div><span>Статус</span><strong>${escapeHtml(labels[selected.status] || selected.status)}</strong></div>
            <div><span>Готовность</span><strong>${escapeHtml(selected.completion?.percent || 0)}%</strong></div>
          </div>
          <div class="admin-actions-row">
            <button class="secondary-button" type="button" data-admin-open-assignment="${escapeHtml(selected.id)}">Открыть задание</button>
            ${selectedProject ? `<button class="secondary-button" type="button" data-export-project="${escapeHtml(selectedProject.id)}" data-export-assignment="${escapeHtml(selected.id)}">Скачать JSON задания</button>` : ""}
          </div>
        ` : `<div class="empty-inline">Выберите задание.</div>`}
      </aside>
    </section>
  `;
}

function choiceButtons(items, inputId, selectedValue = "") {
  return `
    <div class="admin-choice-grid" data-choice-group="${escapeHtml(inputId)}">
      ${items.map(([value, label, meta = ""]) => `
        <button class="admin-choice ${String(selectedValue) === String(value) ? "selected" : ""}" type="button" data-admin-choice="${escapeHtml(value)}" data-choice-target="${escapeHtml(inputId)}" ${meta ? `data-choice-meta="${escapeHtml(meta)}"` : ""}>${escapeHtml(label)}</button>
      `).join("")}
    </div>
  `;
}

function renderAdminCreate(ctx) {
  const areaItems = (state.meta.legal_areas || []).map((area) => [area, area]);
  const projectItems = ctx.projects.map((project) => [project.id, project.name, project.task_type]);
  const expertItems = ctx.experts.map((expert) => [expert.id, `${expert.display_name} · ${roleLabels[expert.role] || expert.role}`]);
  const defaultProject = ctx.selectedProject || ctx.projects[0] || {};
  const defaultUser = ctx.selectedUser || ctx.experts[0] || {};
  return `
    <section class="admin-section admin-two-column">
      <form class="admin-form-panel" id="admin-project-create-form">
        <div class="admin-section-head"><div><span class="eyebrow">Создать проект</span><h3>Новый поток заданий</h3></div></div>
        <label>ID проекта<input name="id" placeholder="латиница, можно пустым" /></label>
        <label>Название<input name="name" placeholder="например: Проверка договоров" required /></label>
        <label>Описание<textarea name="summary" rows="4" placeholder="что собираем и для чего" required></textarea></label>
        <input id="admin-project-required-area" name="required_area" type="hidden" value="${escapeHtml(areaItems[0]?.[0] || "")}" />
        <div><span class="form-label">Область права</span>${choiceButtons(areaItems, "admin-project-required-area", areaItems[0]?.[0] || "")}</div>
        <input id="admin-project-task-type" name="task_type" type="hidden" value="classification" />
        <div><span class="form-label">Тип задания</span>${choiceButtons(taskTypeOptions, "admin-project-task-type", "classification")}</div>
        <button class="primary-button" type="submit">Создать проект</button>
      </form>
      <form class="admin-form-panel" id="admin-assignment-create-form">
        <div class="admin-section-head"><div><span class="eyebrow">Создать задание</span><h3>Назначить работу</h3></div></div>
        <input id="admin-assignment-project" name="project_id" type="hidden" value="${escapeHtml(defaultProject.id || "")}" />
        <input id="admin-assignment-task-type" name="task_type" type="hidden" value="${escapeHtml(defaultProject.task_type || "classification")}" />
        <div><span class="form-label">Проект</span>${choiceButtons(projectItems, "admin-assignment-project", defaultProject.id || "")}</div>
        <input id="admin-assignment-user" name="user_id" type="hidden" value="${escapeHtml(defaultUser.id || "")}" />
        <div><span class="form-label">Кому назначить</span>${choiceButtons(expertItems, "admin-assignment-user", defaultUser.id || "")}</div>
        <label>Название задания<input name="task_title" placeholder="короткое рабочее название" required /></label>
        <label>Материал<textarea name="source_text" rows="6" placeholder="текст обращения, вопрос, исходный фрагмент или описание пары" required></textarea></label>
        <label>Дополнительный ответ / вариант A<textarea name="option_a" rows="3" placeholder="опционально"></textarea></label>
        <label>Вариант B<textarea name="option_b" rows="3" placeholder="опционально"></textarea></label>
        <label>Срок<input name="due_at" type="datetime-local" /></label>
        <button class="primary-button" type="submit">Создать задание</button>
      </form>
    </section>
  `;
}

function renderAdminExport(ctx) {
  return `
    <section class="admin-section">
      <div class="admin-section-head"><div><span class="eyebrow">Экспорт</span><h3>JSON по проектам и заданиям</h3></div></div>
      <div class="export-list">
        ${ctx.exports.map((item) => `
          <div class="export-row">
            <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.project_id)}</small></div>
            <button class="secondary-button" type="button" data-export-project="${escapeHtml(item.project_id)}">Скачать JSON</button>
          </div>
        `).join("") || `<div class="empty-inline">Проекты не найдены.</div>`}
      </div>
    </section>
  `;
}

function renderAdminActiveTab(admin, ctx) {
  if (state.adminActiveTab === "applications") return renderAdminApplications(ctx);
  if (state.adminActiveTab === "experts") return renderAdminExperts(ctx);
  if (state.adminActiveTab === "projects") return renderAdminProjects(ctx);
  if (state.adminActiveTab === "assignments") return renderAdminAssignments(ctx);
  if (state.adminActiveTab === "create") return renderAdminCreate(ctx);
  if (state.adminActiveTab === "export") return renderAdminExport(ctx);
  return renderAdminSummary(admin, ctx);
}

function renderAdminSurface() {
  const admin = state.dashboard?.admin_surface;
  if (!admin) {
    els.adminSurface.classList.add("hidden");
    return;
  }
  const ctx = adminContext(admin);
  els.adminSurface.classList.remove("hidden");
  els.adminSurface.innerHTML = `
    <div class="admin-header">
      <div><span class="eyebrow">Администрирование</span><h2>Контроль платформы</h2></div>
      ${adminTabNav()}
    </div>
    <div class="admin-content">${renderAdminActiveTab(admin, ctx)}</div>
  `;
  bindAdminSurface();
}

async function decideApplication(button) {
  const card = button.closest("[data-application-id]");
  if (!card) return;
  const decision = button.dataset.applicationDecision;
  const adminNote = card.querySelector('[name="admin_note"]')?.value || "";
  const adminCredentials = card.querySelector('[name="admin_credentials"]')?.value || "";
  const result = await api(`/api/admin/applications/${encodeURIComponent(card.dataset.applicationId)}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, admin_note: adminNote, admin_credentials: adminCredentials }),
  });
  const mail = result.email?.delivered || result.email?.dev ? "письмо обработано" : "письмо не отправлено";
  toast(`${decision === "approved" ? "Заявка принята" : "Заявка отклонена"}, ${mail}`);
  await loadDashboard(state.selectedAssignmentId);
}

async function downloadProjectExport(projectId, assignmentId = "") {
  const params = new URLSearchParams({ project_id: projectId });
  if (assignmentId) params.set("assignment_id", assignmentId);
  const response = await fetch(`/api/admin/export?${params.toString()}`, {
    headers: { authorization: `Bearer ${state.token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "Экспорт не создан.");
  }
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = assignmentId ? `${projectId}-${assignmentId}.json` : `${projectId}-results.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

function bindAdminSurface() {
  els.adminSurface.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.adminActiveTab = button.dataset.adminTab || "summary";
      localStorage.setItem("expert_platform_admin_tab", state.adminActiveTab);
      renderAdminSurface();
    });
  });
  els.adminSurface.querySelectorAll("[data-admin-project]").forEach((node) => {
    node.addEventListener("click", () => {
      state.selectedAdminProjectId = node.dataset.adminProject || "";
      localStorage.setItem("expert_platform_admin_project", state.selectedAdminProjectId);
      renderAdminSurface();
    });
  });
  els.adminSurface.querySelectorAll("[data-admin-assignment]").forEach((node) => {
    node.addEventListener("click", () => {
      state.selectedAdminAssignmentId = node.dataset.adminAssignment || "";
      localStorage.setItem("expert_platform_admin_assignment", state.selectedAdminAssignmentId);
      renderAdminSurface();
    });
  });
  els.adminSurface.querySelectorAll("[data-admin-user]").forEach((node) => {
    node.addEventListener("click", () => {
      state.selectedAdminUserId = node.dataset.adminUser || "";
      localStorage.setItem("expert_platform_admin_user", state.selectedAdminUserId);
      renderAdminSurface();
    });
  });
  els.adminSurface.querySelectorAll("[data-admin-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.choiceTarget);
      if (input) input.value = button.dataset.adminChoice || "";
      button.closest("[data-choice-group]")?.querySelectorAll("[data-admin-choice]").forEach((node) => node.classList.remove("selected"));
      button.classList.add("selected");
      if (button.dataset.choiceTarget === "admin-assignment-project") {
        const taskTypeInput = document.getElementById("admin-assignment-task-type");
        if (taskTypeInput && button.dataset.choiceMeta) taskTypeInput.value = button.dataset.choiceMeta;
      }
    });
  });
  els.adminSurface.querySelectorAll("[data-application-decision]").forEach((button) => {
    button.addEventListener("click", () => decideApplication(button).catch((error) => toast(error.message)));
  });
  els.adminSurface.querySelectorAll("[data-export-project]").forEach((button) => {
    button.addEventListener("click", () => downloadProjectExport(button.dataset.exportProject, button.dataset.exportAssignment || "").catch((error) => toast(error.message)));
  });
  els.adminSurface.querySelectorAll("[data-admin-open-assignment]").forEach((button) => {
    button.addEventListener("click", () => selectAssignment(button.dataset.adminOpenAssignment).catch((error) => toast(error.message)));
  });
  els.adminSurface.querySelector("#admin-project-create-form")?.addEventListener("submit", (event) => {
    adminCreateProject(event).catch((error) => toast(error.message));
  });
  els.adminSurface.querySelector("#admin-assignment-create-form")?.addEventListener("submit", (event) => {
    adminCreateAssignment(event).catch((error) => toast(error.message));
  });
}

async function adminCreateProject(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  const response = await api("/api/admin/projects", { method: "POST", body: JSON.stringify(payload) });
  state.selectedAdminProjectId = response.project?.id || state.selectedAdminProjectId;
  state.adminActiveTab = "projects";
  localStorage.setItem("expert_platform_admin_project", state.selectedAdminProjectId);
  localStorage.setItem("expert_platform_admin_tab", state.adminActiveTab);
  form.reset();
  toast("Проект создан");
  await loadDashboard(state.selectedAssignmentId);
}

async function adminCreateAssignment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  const response = await api("/api/admin/assignments", { method: "POST", body: JSON.stringify(payload) });
  state.selectedAdminAssignmentId = response.assignment?.id || state.selectedAdminAssignmentId;
  state.adminActiveTab = "assignments";
  localStorage.setItem("expert_platform_admin_assignment", state.selectedAdminAssignmentId);
  localStorage.setItem("expert_platform_admin_tab", state.adminActiveTab);
  form.reset();
  toast("Задание создано");
  await loadDashboard(response.assignment?.id || state.selectedAssignmentId);
}

async function selectAssignment(id) {
  if (!id) return;
  setSync("задание");
  state.selectedAssignmentId = id;
  const detail = await api(`/api/assignments/${encodeURIComponent(id)}`);
  state.selectedAssignment = detail;
  renderDashboard();
  renderTask(detail);
  setSync("готово");
}

function stepper() {
  return `
    <div class="stepper">
      <div class="step active">1. Материалы</div>
      <div class="step active">2. Оценка</div>
      <div class="step">3. Проверка</div>
      <div class="step">4. Отправка</div>
    </div>
  `;
}

function renderTask(detail) {
  const { assignment, project, task } = detail;
  const payload = task.payload || {};
  const reviewMode = state.session?.mode === "reviewer";
  els.taskCard.innerHTML = `
    <div class="task-head">
      <div class="task-title">
        <span class="eyebrow">${escapeHtml(project?.name || "проект")}</span>
        <h1>${escapeHtml(assignment.task_title)}</h1>
        <div class="task-meta">
          ${statusChip(assignment.status)}
          <span class="chip">${escapeHtml(labels[assignment.task_type] || assignment.task_type)}</span>
          <span class="chip">срок ${escapeHtml(assignment.due_label || "без срока")}</span>
          <span class="chip">готовность ${escapeHtml(assignment.completion?.percent || 0)}%</span>
        </div>
      </div>
    </div>
    ${reviewMode ? renderReviewWorkspace(detail) : renderExpertWorkspace(detail)}
    <section class="history-box">
      <span class="eyebrow">История</span>
      ${renderHistory(detail.history)}
    </section>
    ${renderAssignmentChat(detail)}
  `;
  els.taskCard.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleTaskAction(button.dataset.action));
  });
  els.taskCard.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.choiceName;
      els.taskCard.querySelectorAll(`[data-choice-name="${name}"]`).forEach((node) => node.classList.remove("selected"));
      button.classList.add("selected");
      const input = els.taskCard.querySelector(`[name="${name}"]`);
      if (input) input.value = button.dataset.choice;
    });
  });
  const chatForm = els.taskCard.querySelector("#assignment-comment-form");
  chatForm?.addEventListener("submit", (event) => addAssignmentComment(event).catch((error) => toast(error.message)));
  const chatLog = els.taskCard.querySelector(".assignment-chat-log");
  if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
}

function renderMaterialBox(assignment, payload) {
  return `
    <section class="source-box">
      <span class="eyebrow">Материалы</span>
      <h3>${escapeHtml(payload.headline || assignment.task_title)}</h3>
      <p>${escapeHtml(payload.source_text || payload.text || payload.question || payload.anchor || "")}</p>
      ${payload.model_answer ? `<h3>Исходный ответ</h3><p>${escapeHtml(payload.model_answer)}</p>` : ""}
      ${payload.option_a ? `<h3>Вариант A</h3><p>${escapeHtml(payload.option_a)}</p>` : ""}
      ${payload.option_b ? `<h3>Вариант B</h3><p>${escapeHtml(payload.option_b)}</p>` : ""}
      ${payload.reference ? `<h3>Эталон</h3><p>${escapeHtml(payload.reference)}</p>` : ""}
      ${payload.positive ? `<h3>Текст 1</h3><p>${escapeHtml(payload.positive)}</p>` : ""}
      ${payload.negative ? `<h3>Текст 2</h3><p>${escapeHtml(payload.negative)}</p>` : ""}
    </section>
  `;
}

function renderExpertWorkspace(detail) {
  const { assignment, task } = detail;
  const payload = task.payload || {};
  return `
    <div class="content-grid">
      ${renderMaterialBox(assignment, payload)}
      <section class="editor-box">
        <span class="eyebrow">Работа эксперта</span>
        ${renderEditor(assignment.task_type, payload, assignment.draft || {})}
      </section>
    </div>
    <div class="task-actions">
      <button class="secondary-button" type="button" data-action="draft">Сохранить</button>
      <button class="primary-button" type="button" data-action="submit">Отправить экспертизу</button>
    </div>
  `;
}

function renderReviewWorkspace(detail) {
  const { assignment, task } = detail;
  const payload = task.payload || {};
  const hasSubmittedAnswer = Boolean(assignment.submitted_payload && Object.keys(assignment.submitted_payload).length);
  return `
    <div class="review-grid">
      ${renderMaterialBox(assignment, payload)}
      <section class="expert-result-box">
        <span class="eyebrow">Что отметил эксперт</span>
        ${renderSubmittedAnswer(assignment.task_type, payload, assignment.submitted_payload || {})}
      </section>
    </div>
    ${hasSubmittedAnswer ? `<form class="review-form" id="task-form">
      <label>Причина отклонения<textarea name="reviewer_note" rows="4" placeholder="Обязательно, если результат эксперта отклоняется."></textarea></label>
      <div class="task-actions">
        <button class="primary-button" type="button" data-action="review-approve">Принять</button>
        <button class="danger-button" type="button" data-action="review-reject">Отклонить</button>
      </div>
    </form>` : `<div class="empty-inline">Ревью начнется после отправки результата экспертом.</div>`}
  `;
}

function valueRow(label, value) {
  return `<div class="answer-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "не заполнено")}</strong></div>`;
}

function renderSubmittedAnswer(type, payload, answer) {
  if (!answer || !Object.keys(answer).length) {
    return `<div class="empty-inline">Эксперт еще не отправил результат.</div>`;
  }
  if (type === "classification") {
    const option = (payload.options || []).find((item) => item.id === answer.classification_choice);
    return `
      <div class="answer-stack">
        ${valueRow("Выбор", option?.title || answer.classification_choice)}
        ${valueRow("Уверенность", answer.confidence)}
        ${valueRow("Аргументы", answer.rationale)}
      </div>
    `;
  }
  if (type === "rubric_scorecard") {
    const scores = (payload.criteria || []).map((criterion) => valueRow(criterion.label, answer[`score_${criterion.id}`])).join("");
    return `
      <div class="answer-stack">
        ${scores}
        ${valueRow("Доказательства", answer.evidence)}
        ${valueRow("Итог", answer.rationale)}
      </div>
    `;
  }
  if (type === "pairwise_preference") {
    const variants = { a: "Вариант A", b: "Вариант B", tie: "Ничья" };
    return `
      <div class="answer-stack">
        ${valueRow("Выбор", variants[answer.preference] || answer.preference)}
        ${valueRow("Уверенность", answer.confidence)}
        ${valueRow("Аргументы", answer.rationale)}
      </div>
    `;
  }
  const variants = { positive: "Текст 1", negative: "Текст 2" };
  return `
    <div class="answer-stack">
      ${valueRow("Ближе к эталону", variants[answer.closest] || answer.closest)}
      ${valueRow("Уверенность", answer.confidence)}
      ${valueRow("Комментарий", answer.rationale)}
    </div>
  `;
}

function renderAssignmentChat(detail) {
  const comments = detail.comments || [];
  return `
    <section class="assignment-chat">
      <div class="assignment-chat-head">
        <div><span class="eyebrow">Чат по заданию</span><h3>Быстрое уточнение</h3></div>
      </div>
      <div class="assignment-chat-log">
        ${comments.map((item) => `
          <div class="assignment-comment">
            <div><strong>${escapeHtml(item.display_name || "Участник")}</strong><time>${escapeHtml(formatDate(item.created_at))}</time></div>
            <p>${escapeHtml(item.body)}</p>
          </div>
        `).join("") || `<div class="empty-inline">Сообщений пока нет.</div>`}
      </div>
      <form class="assignment-comment-form" id="assignment-comment-form">
        <textarea name="message" rows="2" placeholder="Сообщение эксперту или ревьюверу"></textarea>
        <button class="secondary-button" type="submit">Отправить</button>
      </form>
    </section>
  `;
}

function renderEditor(type, payload, draft) {
  if (type === "classification") {
    return `
      <form id="task-form">
        <input type="hidden" name="classification_choice" value="${escapeHtml(draft.classification_choice || "")}" />
        <div class="option-grid">
          ${(payload.options || []).map((option) => `
            <button class="option-button ${draft.classification_choice === option.id ? "selected" : ""}" type="button" data-choice-name="classification_choice" data-choice="${escapeHtml(option.id)}">
              <strong>${escapeHtml(option.title)}</strong><p>${escapeHtml(option.description)}</p>
            </button>
          `).join("")}
        </div>
        ${scaleButtons("confidence", payload.confidence_scale, draft.confidence, "Уверенность")}
        <label>Обоснование<textarea name="rationale" rows="5">${escapeHtml(draft.rationale || "")}</textarea></label>
      </form>
    `;
  }
  if (type === "rubric_scorecard") {
    return `
      <form id="task-form">
        <div class="score-grid">
          ${(payload.criteria || []).map((criterion) => `
            <div class="score-card">
              <strong>${escapeHtml(criterion.label)}</strong>
              ${scaleButtons(`score_${criterion.id}`, criterion.scale, draft[`score_${criterion.id}`], "Балл")}
            </div>
          `).join("")}
        </div>
        <label>Доказательные фрагменты<textarea name="evidence" rows="4">${escapeHtml(draft.evidence || "")}</textarea></label>
        <label>Итоговый комментарий<textarea name="rationale" rows="5">${escapeHtml(draft.rationale || "")}</textarea></label>
      </form>
    `;
  }
  if (type === "pairwise_preference") {
    return `
      <form id="task-form">
        <input type="hidden" name="preference" value="${escapeHtml(draft.preference || "")}" />
        <div class="comparison-grid">
          <button class="comparison-box ${draft.preference === "a" ? "selected" : ""}" type="button" data-choice-name="preference" data-choice="a"><strong>Вариант A</strong><p>${escapeHtml(payload.option_a)}</p></button>
          <button class="comparison-box ${draft.preference === "b" ? "selected" : ""}" type="button" data-choice-name="preference" data-choice="b"><strong>Вариант B</strong><p>${escapeHtml(payload.option_b)}</p></button>
          <button class="comparison-box ${draft.preference === "tie" ? "selected" : ""}" type="button" data-choice-name="preference" data-choice="tie"><strong>Ничья</strong><p>Качество вариантов сопоставимо.</p></button>
        </div>
        ${scaleButtons("confidence", payload.confidence_scale, draft.confidence, "Уверенность")}
        <label>Обоснование<textarea name="rationale" rows="5">${escapeHtml(draft.rationale || "")}</textarea></label>
      </form>
    `;
  }
  return `
    <form id="task-form">
      <input type="hidden" name="closest" value="${escapeHtml(draft.closest || "")}" />
      <div class="comparison-grid">
        <button class="comparison-box ${draft.closest === "positive" ? "selected" : ""}" type="button" data-choice-name="closest" data-choice="positive"><strong>Текст 1</strong><p>${escapeHtml(payload.positive)}</p></button>
        <button class="comparison-box ${draft.closest === "negative" ? "selected" : ""}" type="button" data-choice-name="closest" data-choice="negative"><strong>Текст 2</strong><p>${escapeHtml(payload.negative)}</p></button>
      </div>
      ${scaleButtons("confidence", payload.confidence_scale, draft.confidence, "Уверенность")}
      <label>Комментарий<textarea name="rationale" rows="5">${escapeHtml(draft.rationale || "")}</textarea></label>
    </form>
  `;
}

function scaleButtons(name, scale = [1, 2, 3, 4, 5], selected = "", label = "Оценка") {
  const values = Array.isArray(scale) && scale.length ? scale : [1, 2, 3, 4, 5];
  return `
    <div class="scale-control">
      <div class="scale-label">${escapeHtml(label)}</div>
      <input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(selected || "")}" />
      <div class="segmented-scale" role="group" aria-label="${escapeHtml(label)}">
        ${values.map((value) => `
          <button class="scale-button ${String(selected) === String(value) ? "selected" : ""}" type="button" data-choice-name="${escapeHtml(name)}" data-choice="${escapeHtml(value)}">${escapeHtml(value)}</button>
        `).join("")}
      </div>
    </div>
  `;
}

function taskPayloadFromForm() {
  const form = document.getElementById("task-form");
  if (!form) return {};
  return Object.fromEntries(new FormData(form).entries());
}

function renderHistory(history = {}) {
  const rows = [
    ...(history.drafts || []).map((item) => ["Черновик", item.created_at]),
    ...(history.submissions || []).map((item) => ["Отправка", item.created_at]),
    ...(history.reviews || []).map((item) => [`Ревью: ${item.outcome}`, item.created_at]),
  ];
  if (!rows.length) return `<p>История пуста.</p>`;
  return rows.map(([label, at]) => `<div class="history-row"><span>${escapeHtml(label)}</span><time>${escapeHtml(formatDate(at))}</time></div>`).join("");
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function handleTaskAction(action) {
  if (!state.selectedAssignmentId) return;
  const payload = taskPayloadFromForm();
  let route = action;
  let body = { payload };
  if (action === "review-approve") {
    route = "review";
    body = { outcome: "approved", payload: { reviewer_note: payload.reviewer_note || "Проверка принята." } };
  }
  if (action === "review-reject") {
    if (!String(payload.reviewer_note || "").trim()) {
      toast("Укажите причину отклонения.");
      return;
    }
    route = "review";
    body = { outcome: "needs_rework", payload: { reviewer_note: payload.reviewer_note.trim() } };
  }
  setSync("сохранение");
  const detail = await api(`/api/assignments/${encodeURIComponent(state.selectedAssignmentId)}/${route}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  state.selectedAssignment = detail;
  renderTask(detail);
  await loadDashboard(state.selectedAssignmentId);
  toast("Готово");
}

async function addAssignmentComment(event) {
  event.preventDefault();
  if (!state.selectedAssignmentId) return;
  const form = event.currentTarget;
  const message = String(new FormData(form).get("message") || "").trim();
  if (!message) return;
  const detail = await api(`/api/assignments/${encodeURIComponent(state.selectedAssignmentId)}/comment`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
  state.selectedAssignment = detail;
  renderTask(detail);
}

async function joinProject(projectId) {
  await api("/api/projects/join", { method: "POST", body: JSON.stringify({ project_id: projectId }) });
  toast("Запрос отправлен администратору");
  await loadDashboard(state.selectedAssignmentId);
}

function renderAgentLog() {
  els.agentLog.innerHTML = state.agentMessages.map((item) => `
    <div class="agent-message ${escapeHtml(item.role)}"><strong>${item.role === "user" ? "Вы" : "Агент"}</strong>${escapeHtml(item.text)}</div>
  `).join("");
  els.agentLog.scrollTop = els.agentLog.scrollHeight;
}

async function askAgent(message) {
  if (!message.trim()) return;
  state.agentMessages.push({ role: "user", text: message });
  renderAgentLog();
  const response = await api("/api/agent/chat", {
    method: "POST",
    body: JSON.stringify({ message, assignment_id: state.selectedAssignmentId }),
  });
  state.agentMessages.push({ role: "assistant", text: response.message });
  renderAgentLog();
}

async function openDrawer() {
  const data = await api("/api/expert/profile");
  const profile = data.profile || {};
  els.profileDisplayName.value = state.session?.display_name || "";
  els.profileCoauthorConsent.checked = Boolean(profile.coauthor_consent);
  els.profileWantsReviewer.checked = Boolean(profile.wants_reviewer);
  const selected = new Set(profile.legal_areas || []);
  els.legalAreaGrid.innerHTML = (data.legal_areas || state.meta.legal_areas || []).map((area) => `
    <label class="area-check"><input type="checkbox" name="legal_area" value="${escapeHtml(area)}" ${selected.has(area) ? "checked" : ""} />${escapeHtml(area)}</label>
  `).join("");
  els.drawerBackdrop.classList.remove("hidden");
  els.profileDrawer.classList.remove("hidden");
  els.profileDrawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  els.drawerBackdrop.classList.add("hidden");
  els.profileDrawer.classList.add("hidden");
  els.profileDrawer.setAttribute("aria-hidden", "true");
}

async function saveProfile(event) {
  event.preventDefault();
  const legalAreas = Array.from(els.legalAreaGrid.querySelectorAll("input:checked")).map((input) => input.value);
  const body = {
    display_name: els.profileDisplayName.value.trim(),
    legal_areas: legalAreas,
    coauthor_consent: els.profileCoauthorConsent.checked,
    wants_reviewer: els.profileWantsReviewer.checked,
    mode: state.session?.mode || "expert",
  };
  const data = await api("/api/expert/profile", { method: "POST", body: JSON.stringify(body) });
  state.session = data.user;
  renderChrome();
  await loadDashboard(state.selectedAssignmentId);
  toast("Профиль сохранен");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function uploadCredential() {
  const file = els.credentialFile.files?.[0];
  if (!file) {
    toast("Выберите файл");
    return;
  }
  const dataBase64 = await fileToBase64(file);
  await api("/api/expert/credentials/upload", {
    method: "POST",
    body: JSON.stringify({
      label: "Документ профиля",
      file_name: file.name,
      content_type: file.type || "application/octet-stream",
      data_base64: dataBase64,
    }),
  });
  toast("Документ загружен");
  await openDrawer();
}

async function switchMode(mode) {
  const data = await api("/api/mode", { method: "POST", body: JSON.stringify({ mode }) });
  state.session.mode = data.mode;
  renderChrome();
  await loadDashboard(state.selectedAssignmentId);
}

async function boot() {
  renderAgentLog();
  await loadMeta();
  const hashToken = new URLSearchParams(location.hash.replace(/^#/, "")).get("token");
  if (hashToken) {
    state.token = hashToken;
    localStorage.setItem("expert_platform_token", state.token);
    history.replaceState(null, "", location.pathname);
  }
  if (!state.token) {
    hardLogout();
    return;
  }
  try {
    await loadSession();
    await loadDashboard();
  } catch (error) {
    hardLogout();
  }
}

function setAuthMode(mode) {
  const registerMode = mode === "register";
  const setupMode = mode === "setup";
  els.passwordLoginForm?.classList.toggle("hidden", registerMode || setupMode);
  els.registrationForm?.classList.toggle("hidden", !registerMode);
  els.passwordSetupForm?.classList.toggle("hidden", !setupMode);
  els.authTabs?.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === (setupMode ? "login" : mode));
  });
  els.authNote.textContent = "";
}

els.authTabs?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-auth-mode]");
  if (button) setAuthMode(button.dataset.authMode);
});

els.passwordLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await api("/api/auth/password/login", {
      method: "POST",
      body: JSON.stringify({ email: els.loginEmail.value.trim(), password: els.loginPassword.value }),
    });
    state.token = result.token;
    state.session = result.user;
    localStorage.setItem("expert_platform_token", state.token);
    renderChrome();
    await loadDashboard();
  } catch (error) {
    setSync("ошибка");
    els.authNote.textContent = error.message;
  }
});

els.passwordSetupOpen?.addEventListener("click", () => {
  els.setupEmail.value = els.loginEmail.value.trim();
  setAuthMode("setup");
});

els.passwordSetupRequest?.addEventListener("click", async () => {
  try {
    const result = await api("/api/auth/password/setup/request", {
      method: "POST",
      body: JSON.stringify({ email: els.setupEmail.value.trim() }),
    });
    els.authNote.textContent = result.dev_otp ? `Тестовый код: ${result.dev_otp}` : "Код отправлен на email.";
  } catch (error) {
    els.authNote.textContent = error.message;
  }
});

els.passwordSetupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await api("/api/auth/password/setup/verify", {
      method: "POST",
      body: JSON.stringify({ email: els.setupEmail.value.trim(), otp: els.setupCode.value.trim(), password: els.setupPassword.value }),
    });
    state.token = result.token;
    state.session = result.user;
    localStorage.setItem("expert_platform_token", state.token);
    renderChrome();
    await loadDashboard();
  } catch (error) {
    els.authNote.textContent = error.message;
  }
});

els.registrationForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const legalAreas = Array.from(els.registrationAreaGrid.querySelectorAll("input:checked")).map((input) => input.value);
    const result = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: els.registerEmail.value.trim(),
        password: els.registerPassword.value,
        display_name: els.registerDisplayName.value.trim(),
        contact: els.registerContact.value.trim(),
        legal_areas: legalAreas,
        coauthor_consent: els.registerCoauthorConsent.checked,
        wants_reviewer: els.registerWantsReviewer.checked,
      }),
    });
    els.registrationForm.reset();
    renderRegistrationAreas();
    setAuthMode("login");
    els.authNote.textContent = result.message || "Заявка отправлена.";
  } catch (error) {
    els.authNote.textContent = error.message;
  }
});

els.googleLoginButton?.addEventListener("click", () => {
  if (!state.meta.google_auth_enabled) {
    els.authNote.textContent = "Google вход готов в коде, но в Cloudflare нужно добавить GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET.";
    return;
  }
  location.href = "/api/auth/google/start";
});

els.refreshButton.addEventListener("click", () => loadDashboard(state.selectedAssignmentId).catch((error) => toast(error.message)));
els.assignmentSearch.addEventListener("input", () => {
  state.search = els.assignmentSearch.value;
  renderDashboard();
});
els.modeSwitch.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (button) switchMode(button.dataset.mode).catch((error) => toast(error.message));
});
els.menuToggle?.addEventListener("click", toggleMenu);
els.profileButton.addEventListener("click", () => openDrawer().catch((error) => toast(error.message)));
els.drawerClose.addEventListener("click", closeDrawer);
els.drawerBackdrop.addEventListener("click", closeDrawer);
els.profileForm.addEventListener("submit", (event) => saveProfile(event).catch((error) => toast(error.message)));
els.logoutButton.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => null);
  hardLogout();
});
els.agentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = els.agentInput.value;
  els.agentInput.value = "";
  await askAgent(message).catch((error) => toast(error.message));
});
boot();
