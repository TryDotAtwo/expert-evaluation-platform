const state = {
  token: localStorage.getItem("expert_platform_token") || "",
  email: "",
  meta: { legal_areas: [] },
  session: null,
  dashboard: null,
  selectedAssignmentId: "",
  selectedAssignment: null,
  queueFilter: "all",
  search: "",
  agentMessages: [
    { role: "assistant", text: "Готов объяснить задание, проверить пропуски, найти справку или подготовить обращение администратору." },
  ],
};

const els = {
  authScreen: document.getElementById("auth-screen"),
  workspace: document.getElementById("workspace"),
  otpRequestForm: document.getElementById("otp-request-form"),
  otpVerifyForm: document.getElementById("otp-verify-form"),
  otpEmail: document.getElementById("otp-email"),
  otpCode: document.getElementById("otp-code"),
  authNote: document.getElementById("auth-note"),
  syncStatus: document.getElementById("sync-status"),
  profileButton: document.getElementById("profile-button"),
  logoutButton: document.getElementById("logout-button"),
  modeSwitch: document.getElementById("mode-switch"),
  summaryGrid: document.getElementById("summary-grid"),
  queueFilters: document.getElementById("queue-filters"),
  assignmentSearch: document.getElementById("assignment-search"),
  assignmentList: document.getElementById("assignment-list"),
  compactProjectList: document.getElementById("compact-project-list"),
  taskCard: document.getElementById("task-card"),
  adminSurface: document.getElementById("admin-surface"),
  refreshButton: document.getElementById("refresh-button"),
  agentTask: document.getElementById("agent-task"),
  agentMemory: document.getElementById("agent-memory"),
  agentLog: document.getElementById("agent-log"),
  agentForm: document.getElementById("agent-form"),
  agentInput: document.getElementById("agent-input"),
  drawerBackdrop: document.getElementById("drawer-backdrop"),
  profileDrawer: document.getElementById("profile-drawer"),
  drawerClose: document.getElementById("drawer-close"),
  profileForm: document.getElementById("profile-form"),
  profileDisplayName: document.getElementById("profile-display-name"),
  profileCredentials: document.getElementById("profile-credentials"),
  profileCertificates: document.getElementById("profile-certificates"),
  profileWantsReviewer: document.getElementById("profile-wants-reviewer"),
  legalAreaGrid: document.getElementById("legal-area-grid"),
  credentialFile: document.getElementById("credential-file"),
  uploadCredentialButton: document.getElementById("upload-credential-button"),
  credentialList: document.getElementById("credential-list"),
  toastStack: document.getElementById("toast-stack"),
};

const labels = {
  assigned: "назначено",
  claimed: "взято",
  draft_saved: "черновик",
  submitted: "отправлено",
  approved: "принято",
  needs_rework: "доработка",
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

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers["content-type"] = "application/json";
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const type = response.headers.get("content-type") || "";
  const body = type.includes("application/json") ? await response.json() : await response.text();
  if (response.status === 401 && path !== "/api/auth/otp/verify") {
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
  const summary = dashboard.summary || {};
  const metricRows = [
    ["assigned", "Назначено"],
    ["draft_saved", "Черновики"],
    ["submitted", "Отправлено"],
    ["approved", "Принято"],
  ];
  els.summaryGrid.innerHTML = metricRows.map(([key, label]) => `
    <div class="metric-card"><strong>${escapeHtml(summary[key] || 0)}</strong><span>${escapeHtml(label)}</span></div>
  `).join("");

  els.compactProjectList.innerHTML = (dashboard.projects || []).map((project) => {
    const membership = project.membership_status || project.access || "available";
    const isActive = membership === "active";
    const isRequested = membership === "requested";
    const actionLabel = isActive ? "Подключено" : isRequested ? "Запрошено" : "Подключиться";
    return `
      <article class="project-access-card">
        <div>
          <strong>${escapeHtml(project.name)}</strong>
          <span>${escapeHtml(labels[project.task_type] || project.task_type)} · ${escapeHtml(project.required_area || "область не задана")}</span>
        </div>
        <button class="secondary-button" type="button" data-join-project="${escapeHtml(project.id)}" ${isActive || isRequested ? "disabled" : ""}>${escapeHtml(actionLabel)}</button>
      </article>
    `;
  }).join("") || `<div class="empty-inline">Проекты не найдены.</div>`;

  const query = state.search.toLowerCase();
  const items = (dashboard.assignments || []).filter((item) => {
    const byFilter = state.queueFilter === "all" || item.status === state.queueFilter;
    const haystack = `${item.task_title} ${item.project_name} ${item.task_type} ${item.status}`.toLowerCase();
    return byFilter && (!query || haystack.includes(query));
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
  els.compactProjectList.querySelectorAll("[data-join-project]").forEach((button) => {
    button.addEventListener("click", () => joinProject(button.dataset.joinProject));
  });
  renderAdminSurface();
}

function renderAdminSurface() {
  const admin = state.dashboard?.admin_surface;
  if (!admin) {
    els.adminSurface.classList.add("hidden");
    return;
  }
  els.adminSurface.classList.remove("hidden");
  els.adminSurface.innerHTML = `
    <div class="rail-header">
      <div><span class="eyebrow">Администрирование</span><h2>Контроль платформы</h2></div>
    </div>
    <div class="admin-grid">
      <div class="admin-item"><strong>Обращения</strong><p>${escapeHtml(admin.requests?.length || 0)} новых записей</p></div>
      <div class="admin-item"><strong>Качество</strong><p>Отправлено: ${escapeHtml(admin.quality?.submitted || 0)}, принято: ${escapeHtml(admin.quality?.approved || 0)}</p></div>
      <div class="admin-item"><strong>Маршрутизация</strong><p>${escapeHtml(admin.routing?.length || 0)} активных проектов</p></div>
      <div class="admin-item"><strong>Импорт/экспорт</strong><p>Очередь готова к расширению</p></div>
    </div>
  `;
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
  els.agentTask.textContent = assignment.task_title;
  els.agentMemory.textContent = "D1 thread";
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
      <button class="secondary-button" type="button" data-action="claim">Взять</button>
    </div>
    ${stepper()}
    <div class="content-grid">
      <section class="source-box">
        <span class="eyebrow">Материалы</span>
        <h3>${escapeHtml(payload.headline || assignment.task_title)}</h3>
        <p>${escapeHtml(payload.source_text || payload.text || payload.question || payload.anchor || "")}</p>
        ${payload.model_answer ? `<h3>Ответ</h3><p>${escapeHtml(payload.model_answer)}</p>` : ""}
      </section>
      <section class="editor-box">
        <span class="eyebrow">Форма</span>
        ${renderEditor(assignment.task_type, payload, assignment.draft || {})}
      </section>
    </div>
    <div class="task-actions">
      <button class="secondary-button" type="button" data-action="draft">Сохранить черновик</button>
      <button class="primary-button" type="button" data-action="submit">Отправить</button>
      <button class="secondary-button ${state.session?.role === "admin" || state.session?.role === "reviewer" ? "" : "hidden"}" type="button" data-action="review-approve">Принять</button>
      <button class="secondary-button ${state.session?.role === "admin" || state.session?.role === "reviewer" ? "" : "hidden"}" type="button" data-action="review-rework">Вернуть</button>
    </div>
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
    });
  });
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
    body = { outcome: "approved", payload: { reviewer_note: payload.rationale || "Проверка принята." } };
  }
  if (action === "review-rework") {
    route = "review";
    body = { outcome: "needs_rework", payload: { reviewer_note: payload.rationale || "Нужна доработка." } };
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
  if (response.memory) els.agentMemory.textContent = `${response.memory.length} сообщений`;
  renderAgentLog();
}

async function openDrawer() {
  const data = await api("/api/expert/profile");
  const profile = data.profile || {};
  els.profileDisplayName.value = state.session?.display_name || "";
  els.profileCredentials.value = profile.credentials || "";
  els.profileCertificates.value = profile.certificates || "";
  els.profileWantsReviewer.checked = Boolean(profile.wants_reviewer);
  const selected = new Set(profile.legal_areas || []);
  els.legalAreaGrid.innerHTML = (data.legal_areas || state.meta.legal_areas || []).map((area) => `
    <label class="area-check"><input type="checkbox" name="legal_area" value="${escapeHtml(area)}" ${selected.has(area) ? "checked" : ""} />${escapeHtml(area)}</label>
  `).join("");
  els.credentialList.innerHTML = (data.credentials || []).map((item) => `
    <div class="credential-item"><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.file_name)} · ${escapeHtml(Math.round((item.size || 0) / 1024))} КБ</p></div>
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
    credentials: els.profileCredentials.value.trim(),
    certificates: els.profileCertificates.value.trim(),
    legal_areas: legalAreas,
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

els.otpRequestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    state.email = els.otpEmail.value.trim();
    setSync("код");
    const result = await api("/api/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ email: state.email }),
    });
    els.otpVerifyForm.classList.remove("hidden");
    els.authNote.textContent = result.dev_otp ? `Тестовый код: ${result.dev_otp}` : "Код отправлен на email.";
    setSync("готово");
  } catch (error) {
    setSync("ошибка");
    els.authNote.textContent = error.message;
  }
});

els.otpVerifyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await api("/api/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email: state.email || els.otpEmail.value.trim(), otp: els.otpCode.value.trim() }),
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

els.refreshButton.addEventListener("click", () => loadDashboard(state.selectedAssignmentId).catch((error) => toast(error.message)));
els.assignmentSearch.addEventListener("input", () => {
  state.search = els.assignmentSearch.value;
  renderDashboard();
});
els.queueFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.queueFilter = button.dataset.filter;
  els.queueFilters.querySelectorAll("button").forEach((node) => node.classList.toggle("active", node === button));
  renderDashboard();
});
els.modeSwitch.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (button) switchMode(button.dataset.mode).catch((error) => toast(error.message));
});
els.profileButton.addEventListener("click", () => openDrawer().catch((error) => toast(error.message)));
els.drawerClose.addEventListener("click", closeDrawer);
els.drawerBackdrop.addEventListener("click", closeDrawer);
els.profileForm.addEventListener("submit", (event) => saveProfile(event).catch((error) => toast(error.message)));
els.uploadCredentialButton.addEventListener("click", () => uploadCredential().catch((error) => toast(error.message)));
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
document.querySelectorAll("[data-agent-prompt]").forEach((button) => {
  button.addEventListener("click", () => askAgent(button.dataset.agentPrompt).catch((error) => toast(error.message)));
});

boot();
