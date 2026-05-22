function parseStoredJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

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
  workspaceView: localStorage.getItem("expert_platform_workspace_view") || "",
  menuCollapsed: localStorage.getItem("expert_platform_menu_collapsed") === "1",
  theme: localStorage.getItem("expert_platform_theme") || "light",
  search: "",
  statusFilter: localStorage.getItem("expert_platform_status_filter") || "all",
  taskPage: 1,
  adminAssignmentSearch: "",
  adminTaskPage: 1,
  adminJsonPayload: null,
  autosaveTimer: null,
  lastAutosaveKey: "",
  autosaveBusy: false,
  agentWidth: Number.parseInt(localStorage.getItem("expert_platform_agent_width") || "340", 10),
  adminToken: localStorage.getItem("expert_platform_admin_token") || "",
  impersonation: parseStoredJson("expert_platform_impersonation", null),
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
  themeButton: document.getElementById("theme-button"),
  logoutButton: document.getElementById("logout-button"),
  queueRail: document.getElementById("queue-rail"),
  modeSwitch: document.getElementById("mode-switch"),
  assignmentSearch: document.getElementById("assignment-search"),
  assignmentList: document.getElementById("assignment-list"),
  compactProjectList: document.getElementById("compact-project-list"),
  taskCard: document.getElementById("task-card"),
  adminSurface: document.getElementById("admin-surface"),
  agentResizer: document.getElementById("agent-resizer"),
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
  active: "доступ",
  requested: "запрошено",
  available: "доступно",
  locked: "закрыто",
  revoked: "отозвано",
  rejected: "отклонено",
  classification: "классификация",
  rubric_scorecard: "рубрика",
  pairwise_preference: "сравнение",
  triplet_similarity: "близость",
  document_relevance: "релевантность",
  norm_extraction: "нормы",
  citation_check: "ссылки",
  contradiction_search: "противоречия",
  procedural_risk: "риски",
  contract_clause_review: "условия",
  hidden: "скрыт",
  public: "публичный",
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

function applyTheme() {
  document.documentElement.dataset.theme = state.theme === "dark" ? "dark" : "light";
  localStorage.setItem("expert_platform_theme", state.theme);
  setCookie("expert_platform_theme", state.theme, 90);
  updateTopbarThemeButton();
}

function updateTopbarThemeButton() {
  if (!els.themeButton) return;
  const dark = state.theme === "dark";
  els.themeButton.title = dark ? "Светлая тема" : "Темная тема";
  els.themeButton.setAttribute("aria-label", els.themeButton.title);
  const icon = els.themeButton.querySelector("span");
  if (icon) icon.textContent = dark ? "☼" : "◐";
}

function syncMenuState() {
  els.workspace.classList.toggle("menu-collapsed", state.menuCollapsed);
  els.menuToggle?.classList.toggle("collapsed", state.menuCollapsed);
  els.menuToggle?.setAttribute("aria-expanded", String(!state.menuCollapsed));
  els.menuToggle?.setAttribute("aria-label", state.menuCollapsed ? "Развернуть меню" : "Свернуть меню");
  localStorage.setItem("expert_platform_menu_collapsed", state.menuCollapsed ? "1" : "0");
  setCookie("expert_platform_menu_collapsed", state.menuCollapsed ? "1" : "0", 90);
}

function toggleMenu() {
  state.menuCollapsed = !state.menuCollapsed;
  spinMenuButton();
  syncMenuState();
}

function spinMenuButton() {
  if (!els.menuToggle) return;
  els.menuToggle.classList.remove("spinning");
  void els.menuToggle.offsetWidth;
  els.menuToggle.classList.add("spinning");
  setTimeout(() => els.menuToggle?.classList.remove("spinning"), 520);
}

function setCookie(name, value, days = 7) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(String(value))}; expires=${expires}; path=/expert; SameSite=Lax`;
}

function getCookie(name) {
  const encoded = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split("; ").find((part) => part.startsWith(encoded));
  return item ? decodeURIComponent(item.slice(encoded.length)) : "";
}

function applyAgentWidth() {
  const width = Math.max(280, Math.min(560, Number.isFinite(state.agentWidth) ? state.agentWidth : 340));
  state.agentWidth = width;
  document.documentElement.style.setProperty("--agent-width", `${width}px`);
  localStorage.setItem("expert_platform_agent_width", String(width));
  setCookie("expert_platform_agent_width", String(width), 90);
}

function initAgentResizer() {
  if (!els.agentResizer) return;
  let active = false;
  const setFromClientX = (clientX) => {
    const nextWidth = Math.round(window.innerWidth - clientX - 12);
    state.agentWidth = nextWidth;
    applyAgentWidth();
  };
  const stop = () => {
    if (!active) return;
    active = false;
    document.body.classList.remove("resizing-agent");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
  };
  const move = (event) => {
    if (!active) return;
    event.preventDefault();
    setFromClientX(event.clientX);
  };
  els.agentResizer.addEventListener("pointerdown", (event) => {
    active = true;
    document.body.classList.add("resizing-agent");
    setFromClientX(event.clientX);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  });
  els.agentResizer.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    state.agentWidth += event.key === "ArrowLeft" ? 24 : -24;
    applyAgentWidth();
  });
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
  state.impersonation = null;
  state.adminToken = "";
  localStorage.removeItem("expert_platform_token");
  localStorage.removeItem("expert_platform_admin_token");
  localStorage.removeItem("expert_platform_impersonation");
  els.authScreen.classList.remove("hidden");
  els.workspace.classList.add("hidden");
  els.profileButton?.classList.add("hidden");
  els.themeButton?.classList.add("hidden");
  els.logoutButton?.classList.add("hidden");
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
  if (!state.workspaceView) state.workspaceView = state.session?.role === "admin" ? "admin-summary" : "tasks";
  if (state.session?.role !== "admin" && state.workspaceView.startsWith("admin-")) state.workspaceView = "tasks";
  renderChrome();
}

async function loadDashboard(preferredAssignmentId = "") {
  setSync("загрузка");
  const dashboard = await api("/api/dashboard");
  state.dashboard = dashboard;
  let nextAssignmentId = "";
  if (preferredAssignmentId) {
    nextAssignmentId = preferredAssignmentId;
    state.selectedAssignmentId = preferredAssignmentId;
    state.workspaceView = "assignment";
    localStorage.setItem("expert_platform_workspace_view", state.workspaceView);
  } else if (state.workspaceView === "assignment" && state.selectedAssignmentId) {
    nextAssignmentId = state.selectedAssignmentId;
  }
  renderDashboard();
  if (nextAssignmentId) await selectAssignment(nextAssignmentId);
  setSync("готово");
}

function renderChrome() {
  applyTheme();
  els.authScreen.classList.add("hidden");
  els.workspace.classList.remove("hidden");
  els.profileButton?.classList.remove("hidden");
  els.themeButton?.classList.remove("hidden");
  els.logoutButton?.classList.remove("hidden");
  els.modeSwitch.classList.remove("hidden");
  syncMenuState();
  updateTopbarThemeButton();
  const mode = state.session?.mode || "expert";
  els.modeSwitch.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
}

function statusChip(status) {
  return `<span class="chip ${escapeHtml(status)}">${escapeHtml(labels[status] || status || "-")}</span>`;
}

const TASK_PAGE_SIZE = 30;

function taskTypeLabel(type) {
  return labels[type] || String(type || "generic_review").replaceAll("_", " ");
}

function statusFilterOptions(assignments = []) {
  const base = [["all", "Все"], ["assigned", "Назначено"], ["draft_saved", "Черновики"], ["submitted", "Отправлено"], ["approved", "Принято"]];
  const seen = new Set(base.map(([id]) => id));
  assignments.forEach((item) => {
    if (item.status && !seen.has(item.status)) {
      seen.add(item.status);
      base.push([item.status, labels[item.status] || item.status]);
    }
  });
  return base;
}

function projectAreas(project) {
  return Array.isArray(project?.legal_areas) && project.legal_areas.length
    ? project.legal_areas
    : project?.required_area ? [project.required_area] : [];
}

function ensureSelectedProject(dashboard) {
  const projects = dashboard.projects || [];
  const assignments = dashboard.assignments || [];
  if (!projects.length) {
    state.selectedProjectId = "";
    localStorage.removeItem("expert_platform_project");
    return null;
  }
  const selected = projects.find((project) => project.id === state.selectedProjectId)
    || projects.find((project) => assignments.some((assignment) => assignment.project_id === project.id))
    || projects[0];
  state.selectedProjectId = selected.id;
  localStorage.setItem("expert_platform_project", selected.id);
  setCookie("expert_platform_project", selected.id, 90);
  return selected;
}

function ensureSelectedAdminProject(ctx) {
  if (!ctx.projects.length) {
    state.selectedAdminProjectId = "";
    localStorage.removeItem("expert_platform_admin_project");
    return null;
  }
  const selected = ctx.projects.find((project) => project.id === state.selectedAdminProjectId)
    || ctx.projects.find((project) => ctx.assignments.some((assignment) => assignment.project_id === project.id))
    || ctx.projects[0];
  state.selectedAdminProjectId = selected.id;
  localStorage.setItem("expert_platform_admin_project", selected.id);
  setCookie("expert_platform_admin_project", selected.id, 90);
  return selected;
}

function projectScopeBar(projects, selectedId, attrName) {
  return `
    <div class="project-scope-row" role="list" aria-label="Проекты">
      ${projects.map((project) => `
        <button class="project-scope-button ${project.id === selectedId ? "active" : ""}" type="button" data-${attrName}="${escapeHtml(project.id)}">
          <span>${escapeHtml(project.name)}</span>
          <em>${escapeHtml(project.counts?.assigned ?? "")}</em>
          ${project.visibility === "hidden" ? `<small>${escapeHtml(labels.hidden)}</small>` : ""}
        </button>
      `).join("") || `<div class="empty-inline">Проектов нет.</div>`}
    </div>
  `;
}

function sideButton(id, label, icon, options = {}) {
  const active = options.action ? false : state.workspaceView === id;
  const attrs = options.action ? `data-side-action="${escapeHtml(options.action)}"` : `data-side-view="${escapeHtml(id)}"`;
  return `
    <button class="side-nav-button ${active ? "active" : ""}" type="button" ${attrs} title="${escapeHtml(label)}">
      <span class="side-icon">${escapeHtml(icon)}</span>
      <span class="side-label">${escapeHtml(label)}</span>
      ${options.count !== undefined ? `<em>${escapeHtml(options.count)}</em>` : ""}
    </button>
  `;
}

function setWorkspaceView(view) {
  state.workspaceView = view;
  state.taskPage = 1;
  localStorage.setItem("expert_platform_workspace_view", view);
  if (view.startsWith("admin-")) {
    state.adminActiveTab = view.replace("admin-", "");
    localStorage.setItem("expert_platform_admin_tab", state.adminActiveTab);
  }
  renderDashboard();
}

function renderSideNav(dashboard) {
  const summary = dashboard.summary || {};
  const pendingMemberships = dashboard.admin_surface?.project_memberships?.filter((item) => item.status === "requested").length || 0;
  const pendingApplications = dashboard.admin_surface?.applications?.filter((item) => item.status === "pending").length || 0;
  const requestCount = (dashboard.admin_surface?.requests || []).filter((item) => item.status === "new").length;
  const isAdmin = state.session?.role === "admin";
  const isReviewer = state.session?.role === "reviewer" || isAdmin || state.session?.wants_reviewer;
  const primary = [
    sideButton("tasks", "Задания", "З", { count: dashboard.assignments?.length || 0 }),
    sideButton("projects", "Проекты", "П", { count: dashboard.projects?.length || 0 }),
    isReviewer ? sideButton("review", "Ревью", "Р", { count: summary.submitted || 0 }) : "",
    sideButton("contact", "Админу", "А", { count: dashboard.support_requests?.length || 0 }),
    sideButton("profile-summary", "Профиль", "◎"),
  ].join("");
  const admin = isAdmin ? `
    <div class="side-nav-group">
      <span class="side-nav-title">Админ</span>
      ${sideButton("admin-summary", "Сводка", "С")}
      ${sideButton("admin-applications", "Заявки", "З", { count: pendingApplications + pendingMemberships })}
      ${sideButton("admin-experts", "Эксперты", "Э")}
      ${sideButton("admin-projects", "Проекты", "П")}
      ${sideButton("admin-assignments", "Задания", "Д")}
      ${sideButton("admin-requests", "Обращения", "О", { count: requestCount })}
      ${sideButton("admin-create", "Создать", "+")}
      ${sideButton("admin-export", "JSON", "J")}
    </div>
  ` : "";
  els.compactProjectList.innerHTML = `
    <div class="side-nav-group">${primary}</div>
    ${admin}
    <div class="side-nav-group side-nav-bottom">
      ${state.impersonation ? sideButton("stop-impersonation", "Вернуться", "↩", { action: "stop-impersonation" }) : ""}
    </div>
  `;
  const stats = dashboard.profile_stats || {};
  els.assignmentList.innerHTML = `
    <div class="side-status-card">
      <strong>${escapeHtml(state.session?.display_name || "Профиль")}</strong>
      <span>${escapeHtml(roleLabels[state.session?.role] || state.session?.role || "expert")}</span>
      <small>${escapeHtml(stats.submitted || 0)} отправлено · ${escapeHtml(stats.approved || 0)} принято</small>
    </div>
  `;
  els.compactProjectList.querySelectorAll("[data-side-view]").forEach((button) => {
    button.addEventListener("click", () => setWorkspaceView(button.dataset.sideView));
  });
  els.compactProjectList.querySelectorAll("[data-side-action]").forEach((button) => {
    button.addEventListener("click", () => handleSideAction(button.dataset.sideAction).catch((error) => toast(error.message)));
  });
}

function renderDashboard() {
  const dashboard = state.dashboard || { assignments: [], projects: [], summary: {} };
  if (!state.workspaceView) state.workspaceView = state.session?.role === "admin" ? "admin-summary" : "tasks";
  if (state.session?.role !== "admin" && state.workspaceView.startsWith("admin-")) state.workspaceView = "tasks";
  renderSideNav(dashboard);
  renderWorkspaceView(dashboard);
}

function renderWorkspaceView(dashboard) {
  const isAdminView = state.workspaceView.startsWith("admin-");
  els.taskCard.classList.toggle("hidden", isAdminView);
  els.adminSurface.classList.toggle("hidden", !isAdminView);
  if (isAdminView) {
    state.adminActiveTab = state.workspaceView.replace("admin-", "");
    renderAdminSurface();
    return;
  }
  els.adminSurface.classList.add("hidden");
  if (state.workspaceView === "projects") return renderProjectWorkspace(dashboard);
  if (state.workspaceView === "profile-summary") return renderProfileSummaryWorkspace(dashboard);
  if (state.workspaceView === "contact") return renderAdminContactWorkspace(dashboard);
  if (state.workspaceView === "review") return renderTaskBrowser(dashboard, { reviewOnly: true });
  if (state.workspaceView === "assignment" && state.selectedAssignment) return renderTask(state.selectedAssignment);
  renderTaskBrowser(dashboard);
}

function filteredAssignments(assignments = [], { reviewOnly = false } = {}) {
  const query = state.search.toLowerCase();
  return assignments.filter((item) => {
    const byProject = Boolean(state.selectedProjectId) && item.project_id === state.selectedProjectId;
    const byStatus = state.statusFilter === "all" || item.status === state.statusFilter;
    const byReview = !reviewOnly || item.status === "submitted";
    const haystack = `${item.task_title} ${item.project_name} ${item.task_type} ${item.status}`.toLowerCase();
    return byProject && byStatus && byReview && (!query || haystack.includes(query));
  });
}

function renderTaskBrowser(dashboard, options = {}) {
  const selectedProject = ensureSelectedProject(dashboard);
  const assignments = filteredAssignments(dashboard.assignments || [], options);
  const maxPage = Math.max(1, Math.ceil(assignments.length / TASK_PAGE_SIZE));
  state.taskPage = Math.min(Math.max(1, state.taskPage), maxPage);
  const start = (state.taskPage - 1) * TASK_PAGE_SIZE;
  const pageItems = assignments.slice(start, start + TASK_PAGE_SIZE);
  els.taskCard.innerHTML = `
    <div class="workspace-head">
      <div>
        <span class="eyebrow">${options.reviewOnly ? "Ревью" : "Рабочая очередь"}</span>
        <h1>${options.reviewOnly ? "Проверка экспертных результатов" : "Задания"}</h1>
      </div>
      <div class="task-count">${escapeHtml(assignments.length)} найдено</div>
    </div>
    ${projectScopeBar(dashboard.projects || [], state.selectedProjectId, "project-filter")}
    ${selectedProject ? `
      <div class="project-context-strip">
        <strong>${escapeHtml(selectedProject.name)}</strong>
        <span>${escapeHtml(selectedProject.summary || "")}</span>
        <div class="application-meta">
          ${projectAreas(selectedProject).map((area) => `<span class="chip">${escapeHtml(area)}</span>`).join("") || `<span class="chip">область не задана</span>`}
          ${selectedProject.visibility === "hidden" ? `<span class="chip pending">скрыт</span>` : ""}
        </div>
      </div>
    ` : ""}
    <div class="browser-toolbar">
      <input id="task-browser-search" value="${escapeHtml(state.search)}" placeholder="поиск: название, проект, тип, статус" />
      <div class="browser-filter-row">
        ${statusFilterOptions(dashboard.assignments || []).map(([id, label]) => `
          <button class="filter-chip ${state.statusFilter === id ? "active" : ""}" type="button" data-status-filter="${escapeHtml(id)}">${escapeHtml(label)}</button>
        `).join("")}
      </div>
    </div>
    <div class="task-table">
      ${pageItems.map(renderAssignmentListRow).join("") || `<div class="empty-state"><p>Задания не найдены.</p></div>`}
    </div>
    <div class="pager">
      <button class="secondary-button" type="button" data-task-page="prev" ${state.taskPage <= 1 ? "disabled" : ""}>Назад</button>
      <span>${escapeHtml(state.taskPage)} / ${escapeHtml(maxPage)}</span>
      <button class="secondary-button" type="button" data-task-page="next" ${state.taskPage >= maxPage ? "disabled" : ""}>Вперед</button>
    </div>
  `;
  bindTaskBrowser();
}

function renderAssignmentListRow(item) {
  return `
    <article class="task-row ${item.id === state.selectedAssignmentId ? "active" : ""}">
      <button type="button" data-assignment-id="${escapeHtml(item.id)}">
        <span><strong>${escapeHtml(item.task_title)}</strong><small>${escapeHtml(item.project_name)} · ${escapeHtml(taskTypeLabel(item.task_type))}</small></span>
        <span class="task-row-meta">${statusChip(item.status)}<em>${escapeHtml(item.due_label || "без срока")}</em><em>${escapeHtml(item.completion?.percent || 0)}%</em></span>
      </button>
    </article>
  `;
}

function bindTaskBrowser() {
  els.taskCard.querySelectorAll("[data-project-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedProjectId = button.dataset.projectFilter || "";
      localStorage.setItem("expert_platform_project", state.selectedProjectId);
      setCookie("expert_platform_project", state.selectedProjectId, 90);
      state.taskPage = 1;
      state.selectedAssignmentId = "";
      renderDashboard();
    });
  });
  els.taskCard.querySelector("#task-browser-search")?.addEventListener("input", (event) => {
    state.search = event.target.value;
    state.taskPage = 1;
    renderDashboard();
  });
  els.taskCard.querySelectorAll("[data-status-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.statusFilter = button.dataset.statusFilter || "all";
      localStorage.setItem("expert_platform_status_filter", state.statusFilter);
      state.taskPage = 1;
      renderDashboard();
    });
  });
  els.taskCard.querySelectorAll("[data-assignment-id]").forEach((button) => {
    button.addEventListener("click", () => selectAssignment(button.dataset.assignmentId).catch((error) => toast(error.message)));
  });
  els.taskCard.querySelectorAll("[data-task-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.taskPage += button.dataset.taskPage === "next" ? 1 : -1;
      renderDashboard();
    });
  });
}

function renderProjectWorkspace(dashboard) {
  const projects = dashboard.projects || [];
  els.taskCard.innerHTML = `
    <div class="workspace-head">
      <div><span class="eyebrow">Проекты</span><h1>Доступы и заявки</h1></div>
    </div>
    <div class="project-browser-grid">
      ${projects.map((project) => {
        const status = project.membership_status || "available";
        const blocked = status === "active" || status === "requested" || status === "locked";
        const count = dashboard.assignments?.filter((assignment) => assignment.project_id === project.id).length || 0;
        return `
          <article class="project-browser-card">
            <header><strong>${escapeHtml(project.name)}</strong>${statusChip(status)}</header>
            <p>${escapeHtml(project.summary || "")}</p>
            <div class="application-meta">
              ${projectAreas(project).map((area) => `<span class="chip">${escapeHtml(area)}</span>`).join("") || `<span class="chip">область не задана</span>`}
              <span class="chip">${escapeHtml(taskTypeLabel(project.task_type))}</span>
              ${project.visibility === "hidden" ? `<span class="chip pending">скрыт</span>` : ""}
              <span class="chip">${escapeHtml(count)} заданий</span>
            </div>
            <button class="secondary-button" type="button" data-open-project-tasks="${escapeHtml(project.id)}">Открыть задания</button>
            <button class="secondary-button" type="button" data-join-project="${escapeHtml(project.id)}" ${blocked ? "disabled" : ""}>${status === "requested" ? "Заявка отправлена" : status === "active" ? "Доступ открыт" : "Подать заявку"}</button>
          </article>
        `;
      }).join("") || `<div class="empty-state"><p>Проекты не найдены.</p></div>`}
    </div>
  `;
  els.taskCard.querySelectorAll("[data-join-project]").forEach((button) => {
    button.addEventListener("click", () => joinProject(button.dataset.joinProject).catch((error) => toast(error.message)));
  });
  els.taskCard.querySelectorAll("[data-open-project-tasks]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedProjectId = button.dataset.openProjectTasks || "";
      localStorage.setItem("expert_platform_project", state.selectedProjectId);
      setWorkspaceView("tasks");
    });
  });
}

function renderProfileSummaryWorkspace(dashboard) {
  const stats = dashboard.profile_stats || {};
  const mentions = stats.mentions || [];
  els.taskCard.innerHTML = `
    <div class="workspace-head">
      <div><span class="eyebrow">Профиль</span><h1>${escapeHtml(state.session?.display_name || "Профиль")}</h1></div>
      <button class="secondary-button" type="button" data-open-profile>Редактировать</button>
    </div>
    <div class="admin-grid">
      ${metricCard("всего назначено", stats.total || 0)}
      ${metricCard("отправлено", stats.submitted || 0)}
      ${metricCard("принято", stats.approved || 0)}
      ${metricCard("на доработке", stats.needs_rework || 0)}
    </div>
    <section class="admin-section">
      <div class="admin-section-head"><div><span class="eyebrow">Упоминания</span><h3>Порог 400 решенных заданий в проекте</h3></div></div>
      <div class="export-list">
        ${mentions.map((item) => `
          <div class="export-row">
            <div><strong>${escapeHtml(item.project_name)}</strong><small>${escapeHtml(item.solved)} / ${escapeHtml(item.threshold)} решено</small></div>
            <span class="chip ${item.eligible ? "approved" : "pending"}">${item.eligible ? "можно упоминать" : `${item.remaining} осталось`}</span>
          </div>
        `).join("") || `<div class="empty-inline">Упоминаний пока нет.</div>`}
      </div>
    </section>
  `;
  els.taskCard.querySelector("[data-open-profile]")?.addEventListener("click", () => openDrawer().catch((error) => toast(error.message)));
}

function renderAdminContactWorkspace() {
  els.taskCard.innerHTML = `
    <div class="workspace-head">
      <div><span class="eyebrow">Обращение админу</span><h1>Сообщение через агента</h1></div>
    </div>
    <section class="admin-form-panel contact-panel">
      <p>Сообщение попадет в админ-панель. Агент сохранит контекст выбранного задания, если задание открыто.</p>
      <form id="admin-contact-form">
        <label>Текст обращения<textarea name="message" rows="7" placeholder="что нужно решить администратору" required></textarea></label>
        <button class="primary-button" type="submit">Отправить админу</button>
      </form>
    </section>
  `;
  els.taskCard.querySelector("#admin-contact-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = String(new FormData(event.currentTarget).get("message") || "").trim();
    if (!message) return;
    await askAgent(`Администратору: ${message}`);
    event.currentTarget.reset();
    toast("Обращение создано");
  });
}

async function handleSideAction(action) {
  if (action === "theme") {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
    renderDashboard();
    return;
  }
  if (action === "logout") {
    await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => null);
    hardLogout();
    return;
  }
  if (action === "stop-impersonation") {
    stopImpersonation();
  }
}

function stopImpersonation() {
  if (!state.adminToken) return;
  state.token = state.adminToken;
  state.adminToken = "";
  state.impersonation = null;
  localStorage.setItem("expert_platform_token", state.token);
  localStorage.removeItem("expert_platform_admin_token");
  localStorage.removeItem("expert_platform_impersonation");
  state.workspaceView = "admin-summary";
  loadSession().then(() => loadDashboard()).catch((error) => toast(error.message));
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
  ["requests", "Обращения"],
  ["create", "Создать"],
  ["export", "Экспорт"],
];

const taskTypeOptions = [
  ["classification", "Классификация"],
  ["rubric_scorecard", "Рубрика"],
  ["pairwise_preference", "Сравнение"],
  ["triplet_similarity", "Близость"],
  ["document_relevance", "Релевантность"],
  ["norm_extraction", "Извлечение норм"],
  ["citation_check", "Проверка ссылок"],
  ["contradiction_search", "Противоречия"],
  ["procedural_risk", "Процессуальные риски"],
  ["contract_clause_review", "Условия договора"],
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
  const memberships = admin.project_memberships || [];
  const requests = admin.requests || [];
  if (!state.selectedAdminProjectId && projects[0]) state.selectedAdminProjectId = projects[0].id;
  if (!state.selectedAdminUserId && experts[0]) state.selectedAdminUserId = experts[0].id;
  const selectedProject = projects.find((item) => item.id === state.selectedAdminProjectId) || projects[0] || null;
  const projectAssignments = selectedProject ? assignments.filter((item) => item.project_id === selectedProject.id) : [];
  if (!state.selectedAdminAssignmentId && projectAssignments[0]) state.selectedAdminAssignmentId = projectAssignments[0].id;
  const selectedAssignment = projectAssignments.find((item) => item.id === state.selectedAdminAssignmentId) || projectAssignments[0] || null;
  const selectedUser = experts.find((item) => item.id === state.selectedAdminUserId) || experts[0] || null;
  if (selectedProject) state.selectedAdminProjectId = selectedProject.id;
  if (selectedAssignment) state.selectedAdminAssignmentId = selectedAssignment.id;
  if (selectedUser) state.selectedAdminUserId = selectedUser.id;
  return { projects, assignments, projectAssignments, experts, applications, exports, memberships, requests, selectedProject, selectedAssignment, selectedUser };
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
  const accessCount = ctx.memberships.filter((item) => item.status === "requested").length;
  const reviewerCount = ctx.experts.filter((item) => item.role === "reviewer" || item.wants_reviewer).length;
  const submitted = admin.quality?.submitted || 0;
  const approved = admin.quality?.approved || 0;
  const recentRequests = [
    ...ctx.memberships.filter((item) => item.status === "requested").slice(0, 4).map((item) => ({
      title: item.project_name || item.project_id,
      note: `${item.display_name || item.email} · доступ к проекту`,
      status: item.status,
    })),
    ...ctx.applications.filter((item) => item.status === "pending").slice(0, 4).map((item) => ({
      title: item.display_name || item.email,
      note: `${item.contact || item.email} · регистрация`,
      status: item.status,
    })),
  ].slice(0, 6);
  return `
    <section class="admin-section">
      <div class="admin-grid">
        ${metricCard("регистрации ждут решения", pendingCount)}
        ${metricCard("доступы к проектам ждут решения", accessCount)}
        ${metricCard("профили в системе", ctx.experts.length, `${reviewerCount} ревью`)}
        ${metricCard("активные проекты", ctx.projects.length)}
        ${metricCard("экспертизы", submitted, `${approved} принято`)}
      </div>
    </section>
    <section class="admin-section admin-two-column">
      <div>
        <div class="admin-section-head"><div><span class="eyebrow">Проекты</span><h3>Короткий статус</h3></div></div>
        <div class="export-list">
          ${ctx.projects.slice(0, 8).map((project) => {
            const count = ctx.assignments.filter((assignment) => assignment.project_id === project.id).length;
            return `
              <div class="export-row compact-row">
                <div><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(taskTypeLabel(project.task_type))} · ${escapeHtml(project.visibility === "hidden" ? "скрыт" : "публичный")}</small></div>
                <span class="chip">${escapeHtml(count)} заданий</span>
              </div>
            `;
          }).join("") || `<div class="empty-inline">Проектов нет.</div>`}
        </div>
      </div>
      <div>
        <div class="admin-section-head"><div><span class="eyebrow">Обращения</span><h3>Что требует решения</h3></div></div>
        <div class="export-list">
          ${recentRequests.map((item) => `
            <div class="export-row compact-row">
              <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.note)}</small></div>
              ${statusChip(item.status)}
            </div>
          `).join("") || `<div class="empty-inline">Новых обращений нет.</div>`}
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

function renderMembershipRequestCard(item) {
  return `
    <article class="application-card">
      <header>
        <div>
          <strong>${escapeHtml(item.display_name || item.email)}</strong>
          <small>${escapeHtml(item.email)} · ${escapeHtml(item.project_name || item.project_id)}</small>
        </div>
        ${statusChip(item.status)}
      </header>
      <div class="application-meta">
        <span class="chip">${escapeHtml(roleLabels[item.role] || item.role || "expert")}</span>
        ${adminPills(item.legal_areas || (item.required_area ? [item.required_area] : []))}
        ${item.visibility === "hidden" ? `<span class="chip pending">скрыт</span>` : ""}
      </div>
      ${item.status === "requested" ? `
        <div class="application-decision compact-actions">
          <button class="primary-button" type="button" data-membership-action="grant" data-member-user="${escapeHtml(item.user_id)}" data-member-project="${escapeHtml(item.project_id)}">Открыть доступ</button>
          <button class="danger-button" type="button" data-membership-action="reject" data-member-user="${escapeHtml(item.user_id)}" data-member-project="${escapeHtml(item.project_id)}">Отклонить</button>
        </div>
      ` : ""}
    </article>
  `;
}

function renderAdminApplications(ctx) {
  const pending = ctx.applications.filter((item) => item.status === "pending");
  const processed = ctx.applications.filter((item) => item.status !== "pending");
  const projectRequests = ctx.memberships.filter((item) => item.status === "requested");
  return `
    <section class="admin-section">
      <div class="admin-section-head"><div><span class="eyebrow">Доступы</span><h3>Заявки на проекты</h3></div></div>
      <div class="application-list">${projectRequests.map(renderMembershipRequestCard).join("") || `<div class="empty-inline">Заявок на проекты нет.</div>`}</div>
    </section>
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
  const progress = expert.progress || {};
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
      <small>${escapeHtml(progress.submitted || 0)} отправлено · ${escapeHtml(progress.approved || 0)} принято · ${escapeHtml(progress.total || 0)} всего</small>
    </article>
  `;
}

function renderAdminExperts(ctx) {
  const selected = ctx.selectedUser;
  const progress = selected?.progress || {};
  const mentions = progress.mentions || [];
  return `
    <section class="admin-section">
      <div class="admin-section-head"><div><span class="eyebrow">Профили экспертов</span><h3>Мозаика команды</h3></div></div>
      <div class="expert-grid mosaic">${ctx.experts.map(renderExpertProfileCard).join("") || `<div class="empty-inline">Профилей нет.</div>`}</div>
    </section>
    ${selected ? `
      <section class="admin-detail-panel expert-detail-expanded">
        <span class="eyebrow">Профиль</span>
        <h3>${escapeHtml(selected.display_name)}</h3>
        <div class="detail-table expert-detail-grid">
          <div><span>Email</span><strong>${escapeHtml(selected.email)}</strong></div>
          <div><span>Роль</span><strong>${escapeHtml(roleLabels[selected.role] || selected.role)}</strong></div>
          <div><span>Статус</span><strong>${escapeHtml(selected.status || "active")}</strong></div>
          <div><span>Режим</span><strong>${escapeHtml(selected.mode || "expert")}</strong></div>
          <div><span>Создан</span><strong>${escapeHtml(displayDate(selected.created_at))}</strong></div>
        </div>
        <div class="application-meta">${adminPills(selected.legal_areas || [])}</div>
        <div class="admin-note-row"><span>Регалии</span><strong>${escapeHtml(selected.admin_credentials || "не заполнены")}</strong></div>
        <div class="admin-grid compact-metrics">
          ${metricCard("всего", progress.total || 0)}
          ${metricCard("отправлено", progress.submitted || 0)}
          ${metricCard("принято", progress.approved || 0)}
          ${metricCard("доработка", progress.needs_rework || 0)}
        </div>
        <div class="export-list">
          ${mentions.map((item) => `
            <div class="export-row compact-row">
              <div><strong>${escapeHtml(item.project_name)}</strong><small>${escapeHtml(item.solved)} / ${escapeHtml(item.threshold)} решено</small></div>
              <span class="chip ${item.eligible ? "approved" : "pending"}">${item.eligible ? "упоминание открыто" : `${item.remaining} осталось`}</span>
            </div>
          `).join("") || `<div class="empty-inline">Упоминаний пока нет.</div>`}
        </div>
        <button class="secondary-button" type="button" data-impersonate-user="${escapeHtml(selected.id)}">Смотреть от лица пользователя</button>
      </section>
    ` : ""}
  `;
}

function renderProjectCard(project, assignments) {
  const count = assignments.filter((item) => item.project_id === project.id).length;
  return `
    <article class="admin-select-card ${project.id === state.selectedAdminProjectId ? "active" : ""}" data-admin-project="${escapeHtml(project.id)}">
      <header><strong>${escapeHtml(project.name)}</strong><span class="chip">${escapeHtml(labels[project.task_type] || project.task_type)}</span></header>
      <p>${escapeHtml(project.summary || "Описание не задано.")}</p>
      <div class="application-meta">
        ${adminPills(projectAreas(project))}
        ${project.visibility === "hidden" ? `<span class="chip pending">скрыт</span>` : ""}
        <span class="chip">${escapeHtml(count)} заданий</span>
      </div>
    </article>
  `;
}

function renderAdminProjects(ctx) {
  const selected = ctx.selectedProject;
  const projectAssignments = selected ? ctx.assignments.filter((item) => item.project_id === selected.id) : [];
  const projectMembers = selected ? ctx.memberships.filter((item) => item.project_id === selected.id && item.status === "active") : [];
  const projectRequests = selected ? ctx.memberships.filter((item) => item.project_id === selected.id && item.status === "requested") : [];
  const activeUserIds = new Set(projectMembers.map((item) => item.user_id));
  const candidateExperts = selected ? ctx.experts.filter((expert) => !activeUserIds.has(expert.id)) : [];
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
            <div><span>Области</span><strong>${escapeHtml(projectAreas(selected).join(", ") || "не заданы")}</strong></div>
            <div><span>Видимость</span><strong>${escapeHtml(labels[selected.visibility] || selected.visibility || "public")}</strong></div>
            <div><span>Статус</span><strong>${escapeHtml(selected.status || "active")}</strong></div>
            <div><span>Задания</span><strong>${escapeHtml(projectAssignments.length)}</strong></div>
          </div>
          <div class="admin-section">
            <div class="admin-section-head"><div><span class="eyebrow">Участники</span><h3>Эксперты и ревьюверы</h3></div></div>
            <div class="export-list">
              ${projectMembers.map((item) => `
                <div class="export-row compact-row">
                  <div><strong>${escapeHtml(item.display_name || item.email)}</strong><small>${escapeHtml(item.email)} · ${escapeHtml(roleLabels[item.role] || item.role)}</small></div>
                  <button class="secondary-button" type="button" data-membership-action="revoke" data-member-user="${escapeHtml(item.user_id)}" data-member-project="${escapeHtml(selected.id)}">Убрать</button>
                </div>
              `).join("") || `<div class="empty-inline">Участников пока нет.</div>`}
            </div>
          </div>
          <div class="admin-section">
            <div class="admin-section-head"><div><span class="eyebrow">Заявки</span><h3>Ожидают доступа</h3></div></div>
            <div class="export-list">
              ${projectRequests.map((item) => `
                <div class="export-row compact-row">
                  <div><strong>${escapeHtml(item.display_name || item.email)}</strong><small>${escapeHtml(item.email)}</small></div>
                  <div class="admin-actions-row">
                    <button class="secondary-button" type="button" data-membership-action="grant" data-member-user="${escapeHtml(item.user_id)}" data-member-project="${escapeHtml(selected.id)}">Открыть</button>
                    <button class="danger-button" type="button" data-membership-action="reject" data-member-user="${escapeHtml(item.user_id)}" data-member-project="${escapeHtml(selected.id)}">Отклонить</button>
                  </div>
                </div>
              `).join("") || `<div class="empty-inline">Заявок нет.</div>`}
            </div>
          </div>
          <div class="admin-section">
            <div class="admin-section-head"><div><span class="eyebrow">Назначить</span><h3>Добавить участника</h3></div></div>
            <div class="admin-choice-grid">
              ${candidateExperts.slice(0, 40).map((expert) => `
                <button class="admin-choice" type="button" data-membership-action="grant" data-member-user="${escapeHtml(expert.id)}" data-member-project="${escapeHtml(selected.id)}">${escapeHtml(expert.display_name)} · ${escapeHtml(roleLabels[expert.role] || expert.role)}</button>
              `).join("") || `<div class="empty-inline">Все доступные профили уже назначены.</div>`}
            </div>
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
  const selectedProject = ensureSelectedAdminProject(ctx);
  const selected = ctx.selectedAssignment;
  const query = state.adminAssignmentSearch.toLowerCase();
  const scopedAssignments = selectedProject ? ctx.assignments.filter((item) => item.project_id === selectedProject.id) : [];
  const filtered = scopedAssignments.filter((item) => {
    const haystack = `${item.task_title} ${item.project_name} ${item.task_type} ${item.status}`.toLowerCase();
    return !query || haystack.includes(query);
  });
  const maxPage = Math.max(1, Math.ceil(filtered.length / TASK_PAGE_SIZE));
  state.adminTaskPage = Math.min(Math.max(1, state.adminTaskPage), maxPage);
  const pageItems = filtered.slice((state.adminTaskPage - 1) * TASK_PAGE_SIZE, state.adminTaskPage * TASK_PAGE_SIZE);
  return `
    <section class="admin-section admin-two-column wide-left">
      <div>
        <div class="admin-section-head"><div><span class="eyebrow">Профиль задания</span><h3>Очередь и состояние</h3></div></div>
        ${projectScopeBar(ctx.projects, state.selectedAdminProjectId, "admin-project-filter")}
        <div class="browser-toolbar slim"><input id="admin-assignment-search" value="${escapeHtml(state.adminAssignmentSearch)}" placeholder="поиск по сотням заданий" /></div>
        <div class="admin-list">${pageItems.map(renderAdminAssignmentRow).join("") || `<div class="empty-inline">Заданий нет.</div>`}</div>
        <div class="pager">
          <button class="secondary-button" type="button" data-admin-task-page="prev" ${state.adminTaskPage <= 1 ? "disabled" : ""}>Назад</button>
          <span>${escapeHtml(state.adminTaskPage)} / ${escapeHtml(maxPage)} · ${escapeHtml(filtered.length)} найдено</span>
          <button class="secondary-button" type="button" data-admin-task-page="next" ${state.adminTaskPage >= maxPage ? "disabled" : ""}>Вперед</button>
        </div>
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

function legalAreaChecks(areas, selected = []) {
  const selectedSet = new Set(selected);
  return `
    <div class="area-pill-grid">
      ${areas.map((area) => `
        <label class="area-check-pill">
          <input type="checkbox" name="legal_areas" value="${escapeHtml(area)}" ${selectedSet.has(area) ? "checked" : ""} />
          <span>${escapeHtml(area)}</span>
        </label>
      `).join("")}
    </div>
  `;
}

function renderAdminCreate(ctx) {
  const areaItems = (state.meta.legal_areas || []).map((area) => [area, area]);
  const areaNames = state.meta.legal_areas || [];
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
        <div><span class="form-label">Области права</span>${legalAreaChecks(areaNames, areaNames.slice(0, 1))}</div>
        <input id="admin-project-task-type" name="task_type" type="hidden" value="classification" />
        <div><span class="form-label">Тип задания</span>${choiceButtons(taskTypeOptions, "admin-project-task-type", "classification")}</div>
        <label>Другой тип задания<input name="custom_task_type" placeholder="например: contract_clause_review" /></label>
        <label class="toggle-line"><input name="is_hidden" type="checkbox" /> Скрытый проект: виден только администраторам</label>
        <button class="primary-button" type="submit">Создать проект</button>
      </form>
      <form class="admin-form-panel" id="admin-assignment-create-form">
        <div class="admin-section-head"><div><span class="eyebrow">Создать задание</span><h3>Назначить работу</h3></div></div>
        <label>JSON задания<textarea id="admin-assignment-json" name="assignment_json" rows="6" placeholder='{"task_title":"...", "source_text":"...", "task_type":"...", "payload":{...}}'></textarea></label>
        <div class="json-status" id="admin-assignment-json-status">JSON можно вставить целиком. Найденные поля подтянутся в форму.</div>
        <input id="admin-assignment-project" name="project_id" type="hidden" value="${escapeHtml(defaultProject.id || "")}" />
        <input id="admin-assignment-task-type" name="task_type" type="hidden" value="${escapeHtml(defaultProject.task_type || "classification")}" />
        <div><span class="form-label">Проект</span>${choiceButtons(projectItems, "admin-assignment-project", defaultProject.id || "")}</div>
        <input id="admin-assignment-user" name="user_id" type="hidden" value="${escapeHtml(defaultUser.id || "")}" />
        <div><span class="form-label">Кому назначить</span>${choiceButtons(expertItems, "admin-assignment-user", defaultUser.id || "")}</div>
        <div><span class="form-label">Области права задания</span>${legalAreaChecks(areaNames, projectAreas(defaultProject))}</div>
        <label>Другой тип задания<input name="custom_task_type" placeholder="например: procedural_risk_review" /></label>
        <label>Название задания<input name="task_title" placeholder="короткое рабочее название" required /></label>
        <label>Инструкция<textarea name="prompt" rows="3" placeholder="опционально"></textarea></label>
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

function renderAdminRequests(ctx) {
  return `
    <section class="admin-section">
      <div class="admin-section-head"><div><span class="eyebrow">Обращения</span><h3>Сообщения через агента</h3></div></div>
      <div class="application-list">
        ${ctx.requests.map((item) => `
          <article class="application-card">
            <header>
              <div><strong>${escapeHtml(item.user_id)}</strong><small>${escapeHtml(displayDate(item.created_at))}${item.assignment_id ? ` · ${escapeHtml(item.assignment_id)}` : ""}</small></div>
              ${statusChip(item.status)}
            </header>
            <p>${escapeHtml(item.message)}</p>
            ${item.assignment_id ? `<button class="secondary-button" type="button" data-admin-open-assignment="${escapeHtml(item.assignment_id)}">Открыть задание и вступить в дискуссию</button>` : ""}
          </article>
        `).join("") || `<div class="empty-inline">Обращений нет.</div>`}
      </div>
    </section>
  `;
}

function renderAdminActiveTab(admin, ctx) {
  if (state.adminActiveTab === "applications") return renderAdminApplications(ctx);
  if (state.adminActiveTab === "experts") return renderAdminExperts(ctx);
  if (state.adminActiveTab === "projects") return renderAdminProjects(ctx);
  if (state.adminActiveTab === "assignments") return renderAdminAssignments(ctx);
  if (state.adminActiveTab === "requests") return renderAdminRequests(ctx);
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
  await loadDashboard();
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
      state.workspaceView = `admin-${state.adminActiveTab}`;
      localStorage.setItem("expert_platform_admin_tab", state.adminActiveTab);
      localStorage.setItem("expert_platform_workspace_view", state.workspaceView);
      renderDashboard();
    });
  });
  els.adminSurface.querySelectorAll("[data-admin-project]").forEach((node) => {
    node.addEventListener("click", () => {
      state.selectedAdminProjectId = node.dataset.adminProject || "";
      state.selectedAdminAssignmentId = "";
      localStorage.setItem("expert_platform_admin_project", state.selectedAdminProjectId);
      setCookie("expert_platform_admin_project", state.selectedAdminProjectId, 90);
      localStorage.removeItem("expert_platform_admin_assignment");
      renderAdminSurface();
    });
  });
  els.adminSurface.querySelectorAll("[data-admin-project-filter]").forEach((node) => {
    node.addEventListener("click", () => {
      state.selectedAdminProjectId = node.dataset.adminProjectFilter || "";
      state.selectedAdminAssignmentId = "";
      state.adminTaskPage = 1;
      localStorage.setItem("expert_platform_admin_project", state.selectedAdminProjectId);
      setCookie("expert_platform_admin_project", state.selectedAdminProjectId, 90);
      localStorage.removeItem("expert_platform_admin_assignment");
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
  els.adminSurface.querySelectorAll("[data-membership-action]").forEach((button) => {
    button.addEventListener("click", () => adminProjectMembership(button).catch((error) => toast(error.message)));
  });
  els.adminSurface.querySelectorAll("[data-impersonate-user]").forEach((button) => {
    button.addEventListener("click", () => adminImpersonate(button.dataset.impersonateUser).catch((error) => toast(error.message)));
  });
  els.adminSurface.querySelector("#admin-assignment-search")?.addEventListener("input", (event) => {
    state.adminAssignmentSearch = event.target.value;
    state.adminTaskPage = 1;
    renderAdminSurface();
  });
  els.adminSurface.querySelectorAll("[data-admin-task-page]").forEach((button) => {
    button.addEventListener("click", () => {
      state.adminTaskPage += button.dataset.adminTaskPage === "next" ? 1 : -1;
      renderAdminSurface();
    });
  });
  const jsonInput = els.adminSurface.querySelector("#admin-assignment-json");
  jsonInput?.addEventListener("input", () => applyAssignmentJsonToForm(jsonInput.closest("form")));
  els.adminSurface.querySelector("#admin-project-create-form")?.addEventListener("submit", (event) => {
    adminCreateProject(event).catch((error) => toast(error.message));
  });
  els.adminSurface.querySelector("#admin-assignment-create-form")?.addEventListener("submit", (event) => {
    adminCreateAssignment(event).catch((error) => toast(error.message));
  });
}

async function adminProjectMembership(button) {
  const action = button.dataset.membershipAction || "grant";
  const endpoint = action === "revoke"
    ? "/api/admin/project-memberships/revoke"
    : action === "reject"
      ? "/api/admin/project-memberships/reject"
      : "/api/admin/project-memberships/grant";
  await api(endpoint, {
    method: "POST",
    body: JSON.stringify({ user_id: button.dataset.memberUser, project_id: button.dataset.memberProject }),
  });
  toast(action === "grant" ? "Доступ открыт" : action === "reject" ? "Заявка отклонена" : "Доступ убран");
  await loadDashboard();
}

async function adminImpersonate(userId) {
  if (!userId) return;
  const result = await api("/api/admin/impersonate", { method: "POST", body: JSON.stringify({ user_id: userId }) });
  state.adminToken = state.token;
  state.token = result.token;
  state.session = result.user;
  state.impersonation = { by: result.impersonated_by, target: result.user };
  localStorage.setItem("expert_platform_admin_token", state.adminToken);
  localStorage.setItem("expert_platform_token", state.token);
  localStorage.setItem("expert_platform_impersonation", JSON.stringify(state.impersonation));
  state.workspaceView = "tasks";
  localStorage.setItem("expert_platform_workspace_view", state.workspaceView);
  toast(`Просмотр от лица: ${result.user.display_name || result.user.email}`);
  await loadDashboard();
}

async function adminCreateProject(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.legal_areas = formData.getAll("legal_areas");
  if (payload.custom_task_type) payload.task_type = payload.custom_task_type;
  const response = await api("/api/admin/projects", { method: "POST", body: JSON.stringify(payload) });
  state.selectedAdminProjectId = response.project?.id || state.selectedAdminProjectId;
  state.adminActiveTab = "projects";
  localStorage.setItem("expert_platform_admin_project", state.selectedAdminProjectId);
  setCookie("expert_platform_admin_project", state.selectedAdminProjectId, 90);
  localStorage.setItem("expert_platform_admin_tab", state.adminActiveTab);
  form.reset();
  toast("Проект создан");
  await loadDashboard();
}

async function adminCreateAssignment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.legal_areas = formData.getAll("legal_areas");
  const jsonPayload = parseAssignmentJson(form.querySelector("#admin-assignment-json")?.value || "");
  Object.entries(jsonPayload).forEach(([key, value]) => {
    if (payload[key] === undefined || String(payload[key] || "").trim() === "") payload[key] = value;
  });
  if (payload.custom_task_type) payload.task_type = payload.custom_task_type;
  if (jsonPayload.payload) payload.payload = jsonPayload.payload;
  if (!payload.source_text && jsonPayload.payload?.source_text) payload.source_text = jsonPayload.payload.source_text;
  if (!payload.source_text && jsonPayload.payload?.question) payload.source_text = jsonPayload.payload.question;
  if (!payload.task_title && jsonPayload.payload?.headline) payload.task_title = jsonPayload.payload.headline;
  if (jsonPayload.options) payload.options = jsonPayload.options;
  if (jsonPayload.criteria) payload.criteria = jsonPayload.criteria;
  if (jsonPayload.fields) payload.fields = jsonPayload.fields;
  if (Array.isArray(jsonPayload.legal_areas) && jsonPayload.legal_areas.length) payload.legal_areas = jsonPayload.legal_areas;
  if (!payload.task_title || !payload.source_text) {
    toast("Заполните недостающие поля после импорта JSON: название и материал.");
    return;
  }
  const response = await api("/api/admin/assignments", { method: "POST", body: JSON.stringify(payload) });
  state.selectedAdminAssignmentId = response.assignment?.id || state.selectedAdminAssignmentId;
  state.adminActiveTab = "assignments";
  localStorage.setItem("expert_platform_admin_assignment", state.selectedAdminAssignmentId);
  localStorage.setItem("expert_platform_admin_tab", state.adminActiveTab);
  form.reset();
  toast("Задание создано");
  await loadDashboard(response.assignment?.id || state.selectedAssignmentId);
}

function parseAssignmentJson(value) {
  const text = String(value || "").trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function applyAssignmentJsonToForm(form) {
  const textarea = form.querySelector("#admin-assignment-json");
  const status = form.querySelector("#admin-assignment-json-status");
  const data = parseAssignmentJson(textarea?.value || "");
  if (!Object.keys(data).length) {
    if (status) status.textContent = textarea?.value.trim() ? "JSON не разобран. Проверьте синтаксис." : "JSON можно вставить целиком. Найденные поля подтянутся в форму.";
    return;
  }
  const mapping = {
    project_id: "#admin-assignment-project",
    user_id: "#admin-assignment-user",
    task_type: "#admin-assignment-task-type",
    task_title: '[name="task_title"]',
    prompt: '[name="prompt"]',
    source_text: '[name="source_text"]',
    material: '[name="source_text"]',
    option_a: '[name="option_a"]',
    option_b: '[name="option_b"]',
    due_at: '[name="due_at"]',
  };
  Object.entries(mapping).forEach(([field, selector]) => {
    const input = form.querySelector(selector);
    if (input && data[field] !== undefined && data[field] !== null && String(input.value || "").trim() === "") input.value = String(data[field]);
  });
  if (data.payload && typeof data.payload === "object") {
    if (data.payload.headline && !form.querySelector('[name="task_title"]')?.value) form.querySelector('[name="task_title"]').value = data.payload.headline;
    if (data.payload.source_text && !form.querySelector('[name="source_text"]')?.value) form.querySelector('[name="source_text"]').value = data.payload.source_text;
    if (data.payload.question && !form.querySelector('[name="source_text"]')?.value) form.querySelector('[name="source_text"]').value = data.payload.question;
  }
  if (Array.isArray(data.legal_areas)) {
    const selected = new Set(data.legal_areas);
    form.querySelectorAll('[name="legal_areas"]').forEach((input) => {
      input.checked = selected.has(input.value);
    });
  }
  if (status) status.textContent = `JSON разобран: ${Object.keys(data).slice(0, 8).join(", ")}`;
}

async function selectAssignment(id) {
  if (!id) return;
  window.clearTimeout(state.autosaveTimer);
  setSync("задание");
  state.selectedAssignmentId = id;
  state.workspaceView = "assignment";
  localStorage.setItem("expert_platform_workspace_view", state.workspaceView);
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
  const activeDraft = reviewMode ? {} : draftForAssignment(assignment);
  state.lastAutosaveKey = reviewMode ? "" : JSON.stringify(activeDraft);
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
    ${reviewMode ? renderReviewWorkspace(detail) : renderExpertWorkspace(detail, activeDraft)}
    ${renderAssignmentChat(detail)}
    <section class="history-box">
      <span class="eyebrow">История</span>
      ${renderHistory(detail.history)}
    </section>
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
      if (!reviewMode) scheduleDraftAutosave();
    });
  });
  if (!reviewMode) bindTaskAutosave();
  const chatForm = els.taskCard.querySelector("#assignment-comment-form");
  chatForm?.addEventListener("submit", (event) => addAssignmentComment(event).catch((error) => toast(error.message)));
  const chatTextarea = chatForm?.querySelector("textarea");
  chatTextarea?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  });
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

function renderExpertWorkspace(detail, draft = null) {
  const { assignment, task } = detail;
  const payload = task.payload || {};
  const activeDraft = draft || draftForAssignment(assignment);
  return `
    <div class="content-grid">
      ${renderMaterialBox(assignment, payload)}
      <section class="editor-box">
        <span class="eyebrow">Работа эксперта</span>
        ${renderEditor(assignment.task_type, payload, activeDraft)}
      </section>
    </div>
    <div class="task-actions">
      <span class="autosave-status" id="autosave-status">сохраняется автоматически</span>
      <button class="primary-button" type="button" data-action="submit">Отправить</button>
      <button class="secondary-button" type="button" data-action="next">Следующее задание</button>
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
        <button class="secondary-button" type="button" data-action="next">Следующее задание</button>
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
  if (type !== "triplet_similarity") {
    return `
      <div class="answer-stack">
        ${Object.entries(answer).map(([key, value]) => valueRow(key, value)).join("")}
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
  if (type !== "triplet_similarity") {
    const fields = Array.isArray(payload.fields) && payload.fields.length ? payload.fields : [
      { id: "result", label: "Результат", type: "textarea" },
      { id: "rationale", label: "Аргументы", type: "textarea" },
      { id: "confidence", label: "Уверенность", type: "scale", scale: payload.confidence_scale || [1, 2, 3, 4, 5] },
    ];
    return `
      <form id="task-form">
        ${fields.map((field) => {
          const id = String(field.id || field.name || "").replace(/[^a-zA-Z0-9_-]+/g, "_") || "field";
          const label = field.label || id;
          if (field.type === "scale") return scaleButtons(id, field.scale || payload.confidence_scale, draft[id], label);
          if (Array.isArray(field.options)) {
            return `
              <input type="hidden" name="${escapeHtml(id)}" value="${escapeHtml(draft[id] || "")}" />
              <div><span class="form-label">${escapeHtml(label)}</span>
                <div class="admin-choice-grid">
                  ${field.options.map((option) => {
                    const value = option.id || option.value || option;
                    const text = option.title || option.label || option;
                    return `<button class="admin-choice ${String(draft[id]) === String(value) ? "selected" : ""}" type="button" data-choice-name="${escapeHtml(id)}" data-choice="${escapeHtml(value)}">${escapeHtml(text)}</button>`;
                  }).join("")}
                </div>
              </div>
            `;
          }
          return `<label>${escapeHtml(label)}<textarea name="${escapeHtml(id)}" rows="4">${escapeHtml(draft[id] || "")}</textarea></label>`;
        }).join("")}
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

function draftStorageKey(id = state.selectedAssignmentId) {
  return id ? `expert_platform_draft_${id}` : "";
}

function readStoredDraft(id) {
  const key = draftStorageKey(id);
  if (!key) return {};
  const raw = localStorage.getItem(key) || getCookie(key);
  return parseStoredJsonFromValue(raw, {});
}

function writeStoredDraft(id, payload) {
  const key = draftStorageKey(id);
  if (!key) return;
  const json = JSON.stringify(payload);
  localStorage.setItem(key, json);
  if (json.length < 3000) setCookie(key, json, 14);
}

function clearStoredDraft(id) {
  const key = draftStorageKey(id);
  if (!key) return;
  localStorage.removeItem(key);
  setCookie(key, "", -1);
}

function draftForAssignment(assignment) {
  const stored = readStoredDraft(assignment?.id);
  return { ...(assignment?.draft || {}), ...stored };
}

function setAutosaveStatus(text) {
  const node = document.getElementById("autosave-status");
  if (node) node.textContent = text;
}

function bindTaskAutosave() {
  const form = document.getElementById("task-form");
  if (!form) return;
  form.addEventListener("input", scheduleDraftAutosave);
  form.addEventListener("change", scheduleDraftAutosave);
}

function scheduleDraftAutosave() {
  if (!state.selectedAssignmentId) return;
  window.clearTimeout(state.autosaveTimer);
  const payload = taskPayloadFromForm();
  writeStoredDraft(state.selectedAssignmentId, payload);
  setAutosaveStatus("черновик сохранен в браузере");
  state.autosaveTimer = window.setTimeout(() => {
    saveDraftSilently().catch((error) => {
      setAutosaveStatus("автосохранение не прошло");
      toast(error.message);
    });
  }, 850);
}

async function saveDraftSilently() {
  if (!state.selectedAssignmentId || state.autosaveBusy) return;
  const payload = taskPayloadFromForm();
  const key = JSON.stringify(payload);
  if (key === state.lastAutosaveKey) return;
  state.autosaveBusy = true;
  setAutosaveStatus("сохранение...");
  try {
    const detail = await api(`/api/assignments/${encodeURIComponent(state.selectedAssignmentId)}/draft`, {
      method: "POST",
      body: JSON.stringify({ payload }),
    });
    state.selectedAssignment = detail;
    state.lastAutosaveKey = key;
    clearStoredDraft(state.selectedAssignmentId);
    setAutosaveStatus("сохранено на платформе");
  } finally {
    state.autosaveBusy = false;
  }
}

function parseStoredJsonFromValue(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function goToNextAssignment() {
  const current = state.selectedAssignment?.assignment;
  const assignments = state.dashboard?.assignments || [];
  const projectId = current?.project_id || state.selectedProjectId;
  const reviewMode = state.session?.mode === "reviewer";
  const queue = assignments.filter((item) => item.project_id === projectId && (reviewMode ? item.status === "submitted" : item.status !== "approved"));
  const currentIndex = queue.findIndex((item) => item.id === state.selectedAssignmentId);
  const next = queue[currentIndex >= 0 ? currentIndex + 1 : 0] || queue[0];
  if (!next || next.id === state.selectedAssignmentId) {
    toast("Следующее задание не найдено");
    return;
  }
  await selectAssignment(next.id);
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
  if (action === "next") {
    await goToNextAssignment();
    return;
  }
  window.clearTimeout(state.autosaveTimer);
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
  if (route === "submit" || route === "review") clearStoredDraft(state.selectedAssignmentId);
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
  await loadDashboard();
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
  await loadDashboard();
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
  if (state.session?.role === "admin") {
    state.workspaceView = data.mode === "reviewer" ? "review" : "tasks";
    localStorage.setItem("expert_platform_workspace_view", state.workspaceView);
  }
  renderChrome();
  await loadDashboard();
}

async function boot() {
  const cookieWidth = Number.parseInt(getCookie("expert_platform_agent_width") || "", 10);
  if (Number.isFinite(cookieWidth)) state.agentWidth = cookieWidth;
  applyTheme();
  applyAgentWidth();
  initAgentResizer();
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
    els.authNote.textContent = "Google вход не активен в текущем Worker. Если секреты уже добавлены в GitHub, дождитесь успешного deploy и синхронизации Worker secrets.";
    return;
  }
  location.href = "/api/auth/google/start";
});

els.refreshButton.addEventListener("click", () => loadDashboard().catch((error) => toast(error.message)));
els.assignmentSearch.addEventListener("input", () => {
  state.search = els.assignmentSearch.value;
  renderDashboard();
});
els.modeSwitch.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (button) switchMode(button.dataset.mode).catch((error) => toast(error.message));
});
els.menuToggle?.addEventListener("click", toggleMenu);
els.profileButton?.addEventListener("click", () => openDrawer().catch((error) => toast(error.message)));
els.themeButton?.addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
});
els.drawerClose.addEventListener("click", closeDrawer);
els.drawerBackdrop.addEventListener("click", closeDrawer);
els.profileForm.addEventListener("submit", (event) => saveProfile(event).catch((error) => toast(error.message)));
els.logoutButton?.addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => null);
  hardLogout();
});
els.agentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = els.agentInput.value.trim();
  if (!message) return;
  els.agentInput.value = "";
  await askAgent(message).catch((error) => toast(error.message));
});
els.agentInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.agentForm.requestSubmit();
  }
});
boot();
