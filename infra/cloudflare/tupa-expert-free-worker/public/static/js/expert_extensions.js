const LEGAL_AREAS = [
  "Гражданское право",
  "Арбитраж",
  "Трудовое право",
  "Семейное право",
  "Налоговое право",
  "Административное право",
  "Интеллектуальные права",
];

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
      status.textContent = "Профиль создан. Перезагрузка рабочего места...";
      location.reload();
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

function profilePanel(profile) {
  const areas = profile?.legal_areas?.length ? profile.legal_areas.join(", ") : "не указаны";
  return `
    <section class="panel cf-extension-panel" id="expert-profile-panel">
      <div class="panel-header">
        <div><div class="panel-tag">Профиль</div><h3>Компетенции эксперта</h3></div>
      </div>
      <div class="stack-list">
        <div class="stack-item"><strong>Области права</strong><div class="subtle">${esc(areas)}</div></div>
        <div class="stack-item"><strong>Регалии</strong><div class="subtle">${esc(profile?.credentials || "не указаны")}</div></div>
        <div class="stack-item"><strong>Ревью</strong><div class="subtle">${profile?.wants_reviewer ? "режим ревьювера доступен" : "режим эксперта"}</div></div>
      </div>
      <div class="hero-actions">
        <button class="secondary-button" type="button" data-mode="expert">Режим эксперта</button>
        <button class="secondary-button" type="button" data-mode="reviewer">Режим ревьювера</button>
      </div>
    </section>
  `;
}

function projectPanel(projects) {
  return `
    <section class="panel cf-extension-panel" id="project-join-panel">
      <div class="panel-header">
        <div><div class="panel-tag">Проекты</div><h3>Подключение к проектам</h3></div>
      </div>
      <div class="stack-list">
        ${(projects || []).map((project) => `
          <div class="stack-item">
            <strong>${esc(project.name)}</strong>
            <div class="subtle">${esc(project.summary || "")}</div>
            <div class="hero-actions"><button class="ghost-button compact" type="button" data-project-id="${esc(project.id)}" ${project.access === "requires_area" ? "disabled" : ""}>${project.access === "requires_area" ? "Нет доступа" : "Запросить доступ"}</button></div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

async function installWorkspaceExtensions() {
  if (!token() || document.getElementById("expert-profile-panel")) return;
  const rail = document.querySelector(".rail");
  if (!rail) return;
  try {
    const [profileData, dashboard] = await Promise.all([api("/api/expert/profile"), api("/api/dashboard")]);
    rail.insertAdjacentHTML("afterbegin", projectPanel(dashboard.projects));
    rail.insertAdjacentHTML("afterbegin", profilePanel(profileData.profile));
    rail.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", async () => {
        await api("/api/mode", { method: "POST", body: JSON.stringify({ mode: button.dataset.mode }) });
        location.reload();
      });
    });
    rail.querySelectorAll("[data-project-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        button.textContent = "Запрос отправлен";
        await api("/api/projects/join", { method: "POST", body: JSON.stringify({ project_id: button.dataset.projectId }) });
      });
    });
  } catch {
    // Extensions stay optional in demo mode.
  }
}

function installAgentHint() {
  const note = document.querySelector(".mcp-note");
  if (note && !note.dataset.extended) {
    note.dataset.extended = "true";
    note.textContent = "Помощник запоминает переписку, сжимает контекст, готов к OpenAI Agents SDK, может подготовить обращение администратору и подсказать действия на платформе.";
  }
}

function tick() {
  installRegistration();
  installWorkspaceExtensions();
  installAgentHint();
}

document.addEventListener("DOMContentLoaded", () => {
  tick();
  setInterval(tick, 1200);
});
