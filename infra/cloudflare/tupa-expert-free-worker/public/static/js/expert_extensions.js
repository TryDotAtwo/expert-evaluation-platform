const LEGAL_AREAS = [
  "Гражданское право",
  "Арбитраж",
  "Трудовое право",
  "Семейное право",
  "Налоговое право",
  "Административное право",
  "Интеллектуальные права",
];

let profileLoadedForToken = "";
let profileLoading = false;
let drawerChromeReady = false;
let agentSurfaceReady = false;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function token() {
  return localStorage.getItem("platform_token");
}

async function api(path, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (token()) headers.authorization = `Bearer ${token()}`;
  const response = await fetch(path, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Запрос не выполнен");
  return body;
}

function selectedLegalAreas(form) {
  return Array.from(form.querySelectorAll("input[name='legal_areas']:checked")).map((item) => item.value);
}

function roleLabel(role) {
  return {
    admin: "администратор",
    expert: "эксперт",
    reviewer: "проверяющий",
  }[role] || role || "эксперт";
}

function accessLabel(project) {
  if (project.access === "requires_area" || project.status === "locked") return "нужна подходящая область права";
  if (project.access === "granted" || project.status === "active") return "доступ открыт";
  if (project.access === "eligible" || project.status === "available") return "можно запросить доступ";
  return "доступ по запросу";
}

function accessDisabled(project) {
  return project.access === "requires_area" || project.status === "locked" || project.access === "granted" || project.status === "active";
}

function accessActionLabel(project) {
  if (project.access === "requires_area" || project.status === "locked") return "Недоступно";
  if (project.access === "granted" || project.status === "active") return "Доступ есть";
  return "Запросить доступ";
}

function installRegistration() {
  const loginCard = document.querySelector(".auth-card");
  if (!loginCard || document.getElementById("expert-registration")) return;
  const details = document.createElement("details");
  details.id = "expert-registration";
  details.className = "disclosure";
  details.innerHTML = `
    <summary>Регистрация эксперта</summary>
    <form id="expert-registration-form" class="auth-form disclosure-body">
      <label>Имя и фамилия<input name="display_name" required placeholder="Например: Иван Петров" /></label>
      <label>Email<input name="email" type="email" required placeholder="expert@example.com" /></label>
      <label>Пароль<input name="password" type="password" required placeholder="Минимум один символ для демо" /></label>
      <label>Регалии<textarea name="credentials" rows="3" placeholder="Дипломы, стаж, ученые степени"></textarea></label>
      <label>Сертификаты<textarea name="certificates" rows="3" placeholder="Сертификаты, курсы, аккредитации"></textarea></label>
      <div class="section-title">Области права</div>
      <div class="cf-check-grid">
        ${LEGAL_AREAS.map((area) => `<label><input type="checkbox" name="legal_areas" value="${esc(area)}" /> ${esc(area)}</label>`).join("")}
      </div>
      <label class="cf-inline"><input type="checkbox" name="wants_reviewer" /> Хочу быть ревьювером</label>
      <button class="primary-button" type="submit">Зарегистрироваться</button>
      <div class="subtle" id="registration-status"></div>
    </form>
  `;
  loginCard.appendChild(details);
  details.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector("#registration-status");
    status.textContent = "Регистрация...";
    try {
      const body = {
        display_name: form.elements.display_name.value.trim(),
        username: form.elements.email.value.trim(),
        email: form.elements.email.value.trim(),
        password: form.elements.password.value,
        credentials: form.elements.credentials.value.trim(),
        certificates: form.elements.certificates.value.trim(),
        legal_areas: selectedLegalAreas(form),
        wants_reviewer: form.elements.wants_reviewer.checked,
      };
      const result = await api("/api/register", { method: "POST", body: JSON.stringify(body) });
      localStorage.setItem("platform_token", result.token);
      status.textContent = "Профиль создан. Рабочее место загружается...";
      location.reload();
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

function openProfileDrawer() {
  document.getElementById("profile-drawer")?.classList.remove("hidden");
  document.getElementById("profile-drawer-backdrop")?.classList.remove("hidden");
  const drawer = document.getElementById("profile-drawer");
  if (drawer) drawer.setAttribute("aria-hidden", "false");
}

function closeProfileDrawer() {
  document.getElementById("profile-drawer")?.classList.add("hidden");
  document.getElementById("profile-drawer-backdrop")?.classList.add("hidden");
  const drawer = document.getElementById("profile-drawer");
  if (drawer) drawer.setAttribute("aria-hidden", "true");
}

function installProfileDrawerChrome() {
  if (drawerChromeReady) return;
  drawerChromeReady = true;
  document.getElementById("profile-button")?.addEventListener("click", openProfileDrawer);
  document.getElementById("profile-drawer-close")?.addEventListener("click", closeProfileDrawer);
  document.getElementById("profile-drawer-backdrop")?.addEventListener("click", closeProfileDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeProfileDrawer();
  });
}

function renderProfileDrawer(profile, dashboard) {
  const user = dashboard?.user || {};
  const areas = Array.isArray(profile?.legal_areas) ? profile.legal_areas : [];
  const credentials = profile?.credentials?.trim() || "Регалии не указаны";
  const certificates = profile?.certificates?.trim() || "Сертификаты не указаны";
  const reviewerEnabled = Boolean(profile?.wants_reviewer || user.role === "reviewer");
  const projects = dashboard?.projects || [];

  return `
    <div class="profile-summary">
      <div class="profile-identity">
        <strong>${esc(user.display_name || user.username || "Эксперт")}</strong>
        <span class="subtle">${esc(roleLabel(dashboard?.role || user.role))}</span>
      </div>

      <div class="profile-section">
        <div class="section-title">Области права</div>
        <div class="profile-chip-list">
          ${areas.length ? areas.map((area) => `<span class="profile-chip">${esc(area)}</span>`).join("") : `<span class="profile-chip">области не указаны</span>`}
        </div>
      </div>

      <div class="profile-section">
        <div class="section-title">Регалии</div>
        <div class="stack-item"><div class="subtle">${esc(credentials)}</div></div>
        <div class="stack-item"><strong>Сертификаты</strong><div class="subtle">${esc(certificates)}</div></div>
      </div>

      <div class="profile-section">
        <div class="section-title">Режим работы</div>
        <div class="stack-item">
          <strong>${reviewerEnabled ? "Эксперт и проверяющий" : "Эксперт"}</strong>
          <div class="subtle">${reviewerEnabled ? "Ревью-режим доступен" : "Ревью-режим не запрошен"}</div>
        </div>
        <div class="hero-actions">
          <button class="secondary-button" type="button" data-mode="expert">Режим эксперта</button>
          <button class="secondary-button" type="button" data-mode="reviewer" ${reviewerEnabled ? "" : "disabled"}>Режим ревью</button>
        </div>
      </div>

      <div class="profile-section">
        <div class="section-title">Проекты</div>
        <div class="stack-list">
          ${projects.map((project) => `
            <div class="stack-item project-access-item">
              <div class="project-access-row">
                <div>
                  <strong>${esc(project.name)}</strong>
                  <div class="subtle">${esc(project.summary || "")}</div>
                </div>
                <span class="meta-chip">${esc(accessLabel(project))}</span>
              </div>
              <div class="hero-actions">
                <button class="ghost-button compact" type="button" data-project-id="${esc(project.id)}" ${accessDisabled(project) ? "disabled" : ""}>${esc(accessActionLabel(project))}</button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

function wireProfileDrawerActions(container) {
  container.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.textContent = "Переключение...";
      await api("/api/mode", { method: "POST", body: JSON.stringify({ mode: button.dataset.mode }) });
      location.reload();
    });
  });
  container.querySelectorAll("[data-project-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.textContent = "Запрошено";
      button.disabled = true;
      await api("/api/projects/join", { method: "POST", body: JSON.stringify({ project_id: button.dataset.projectId }) });
    });
  });
}

async function installWorkspaceExtensions() {
  const currentToken = token();
  const profileButton = document.getElementById("profile-button");
  const content = document.getElementById("profile-drawer-content");
  if (!currentToken) {
    profileLoadedForToken = "";
    profileButton?.classList.add("hidden");
    closeProfileDrawer();
    return;
  }
  profileButton?.classList.remove("hidden");
  if (!content || profileLoading || profileLoadedForToken === currentToken) return;
  profileLoading = true;
  try {
    const [profileData, dashboard] = await Promise.all([api("/api/expert/profile"), api("/api/dashboard")]);
    content.innerHTML = renderProfileDrawer(profileData.profile, dashboard);
    wireProfileDrawerActions(content);
    profileLoadedForToken = currentToken;
  } catch {
    content.innerHTML = `<div class="empty-state">Профиль временно недоступен.</div>`;
  } finally {
    profileLoading = false;
  }
}

function installAgentSurface() {
  if (!agentSurfaceReady) {
    agentSurfaceReady = true;
    document.querySelectorAll("[data-agent-prompt]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = document.getElementById("agent-input");
        const form = document.getElementById("agent-form");
        if (!input || !form) return;
        input.value = button.dataset.agentPrompt || "";
        input.focus();
        form.requestSubmit();
      });
    });
  }

  const taskTitle = document.getElementById("hero-title")?.textContent?.trim();
  const status = document.getElementById("assignment-status")?.textContent?.trim();
  const completion = document.getElementById("completion-caption")?.textContent?.trim();
  const taskNode = document.getElementById("agent-context-task");
  const memoryNode = document.getElementById("agent-context-memory");
  const messageCount = document.querySelectorAll("#agent-log .agent-message").length;
  if (taskNode) taskNode.textContent = taskTitle && !/не выбрано/i.test(taskTitle) ? `${taskTitle} · ${status || "-"}` : "задание не выбрано";
  if (memoryNode) memoryNode.textContent = messageCount > 2 ? `сообщений: ${messageCount}, ${completion || "0%"}` : "диалог готов";
}

function tick() {
  installRegistration();
  installProfileDrawerChrome();
  installWorkspaceExtensions();
  installAgentSurface();
}

document.addEventListener("DOMContentLoaded", () => {
  tick();
  setInterval(tick, 1200);
});
