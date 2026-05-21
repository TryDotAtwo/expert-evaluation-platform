import { bindTaskInteractions, computeCompletion, renderTask } from "./task_family_runtime.js";
import {
  adoptLocalDraft,
  cacheLocalDraft,
  clearLocalDraft,
  getCurrentPayload,
} from "./assignment_local_state.js";
import { createPlatformStateStore } from "./shared_state_store.js";
import {
  renderAgentLog as buildAgentLogHtml,
  renderDashboardShell,
  renderExecutionHistory,
  renderHelpPane,
  renderReviewerPanel,
  wireDashboardSelection,
  wireHelpSelection,
} from "./ui_shell_renderers.js?v=cloudflare-renderer-v2";
import { createShellController } from "./platform_shell_controller.js";

const BASE_PATH = window.__APP_BASE_PATH__ || "";

function withBasePath(path) {
  if (!BASE_PATH || path.startsWith("http://") || path.startsWith("https://") || path.startsWith("//")) {
    return path;
  }
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) {
    return path;
  }
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

const store = createPlatformStateStore({
  initialToken: localStorage.getItem("platform_token"),
  initialAgentMessages: [
    {
      role: "assistant",
      text: "Агент платформы объясняет задания, проверяет пропуски, готовит обращения администратору, помнит последние сообщения и сжимает длинный контекст. Оценки и административные настройки без отдельного подтверждения не изменяются.",
    },
  ],
});
const state = store.state;

const els = {
  loginView: document.getElementById("login-view"),
  workspaceView: document.getElementById("workspace-view"),
  loginForm: document.getElementById("login-form"),
  loginUsername: document.getElementById("login-username"),
  loginPassword: document.getElementById("login-password"),
  loginError: document.getElementById("login-error"),
  userBadge: document.getElementById("user-badge"),
  logoutButton: document.getElementById("logout-button"),
  syncStatus: document.getElementById("sync-status"),
  summaryGrid: document.getElementById("summary-grid"),
  projectsList: document.getElementById("projects-list"),
  assignmentsList: document.getElementById("assignments-list"),
  adminPanel: document.getElementById("admin-panel"),
  adminWorkspaceContent: document.getElementById("admin-workspace-content"),
  adminSupport: document.getElementById("admin-support"),
  adminSchemaPreviews: document.getElementById("admin-schema-previews"),
  adminQualitySummary: document.getElementById("admin-quality-summary"),
  adminControlPlane: document.getElementById("admin-control-plane"),
  heroTitle: document.getElementById("hero-title"),
  heroSubtitle: document.getElementById("hero-subtitle"),
  assignmentStatus: document.getElementById("assignment-status"),
  assignmentRevision: document.getElementById("assignment-revision"),
  assignmentGuidance: document.getElementById("assignment-guidance"),
  completionBar: document.getElementById("completion-bar"),
  completionCaption: document.getElementById("completion-caption"),
  taskPanel: document.getElementById("task-panel"),
  helpList: document.getElementById("help-list"),
  helpArticle: document.getElementById("help-article"),
  refreshButton: document.getElementById("refresh-button"),
  submitButton: document.getElementById("submit-button"),
  reviewApproveButton: document.getElementById("review-approve-button"),
  reviewReworkButton: document.getElementById("review-rework-button"),
  reviewAdjudicateButton: document.getElementById("review-adjudicate-button"),
  reloadAssignmentButton: document.getElementById("reload-assignment-button"),
  agentLog: document.getElementById("agent-log"),
  agentForm: document.getElementById("agent-form"),
  agentInput: document.getElementById("agent-input"),
  toastStack: document.getElementById("toast-stack"),
};

els.helpList?.closest(".rail-panel")?.remove();
document.getElementById("admin-panel-legacy")?.remove();

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  els.toastStack.appendChild(node);
  setTimeout(() => node.remove(), 3500);
}

function setSyncStatus(message) {
  els.syncStatus.textContent = message;
}

function displayAssignmentStatus(value) {
  return {
    queued: "в очереди",
    available: "доступно",
    assigned: "назначено",
    claimed: "взято",
    in_progress: "в работе",
    draft_saved: "черновик",
    submitted: "отправлено",
    approved: "принято",
    needs_rework: "доработка",
    blocked: "заблокировано",
  }[value] || value || "-";
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(withBasePath(path), { ...options, headers });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();

  if (response.status === 401) {
    hardLogout();
    throw new Error("Session expired");
  }
  if (!response.ok) {
    throw { status: response.status, body };
  }
  return body;
}

function renderDashboard() {
  els.workspaceView.dataset.role = state.session?.role || "";
  const rendered = renderDashboardShell({
    dashboard: state.dashboard,
    sessionRole: state.session?.role,
    selectedAssignmentId: state.selectedAssignmentId,
  });
  els.summaryGrid.innerHTML = rendered.summaryHtml;
  els.projectsList.innerHTML = rendered.projectsHtml;
  els.assignmentsList.innerHTML = rendered.assignmentsHtml;
  wireDashboardSelection(els.projectsList, selectAssignment);
  wireDashboardSelection(els.assignmentsList, selectAssignment);

  if (rendered.adminVisible) {
    els.adminPanel.classList.remove("hidden");
    els.taskPanel.classList.add("hidden");
    els.assignmentGuidance.innerHTML = "";
    els.heroTitle.textContent = "Администрирование платформы";
    els.heroSubtitle.textContent = "Очередь, проекты, качество, обращения, импорт и выгрузка в одном рабочем месте.";
    els.assignmentStatus.textContent = "администратор";
    els.assignmentRevision.textContent = "панель";
    els.completionBar.style.width = "100%";
    els.completionCaption.textContent = "данные загружены";
    setActionVisibility({
      reviewerMode: false,
      canReview: false,
      canAdjudicate: false,
      canSaveDraft: false,
      canSubmit: false,
      canClaim: false,
      isSubmitted: false,
    });
    els.reloadAssignmentButton.classList.add("hidden");
    els.adminWorkspaceContent.innerHTML = rendered.adminWorkspaceHtml || "";
    els.adminSupport.innerHTML = rendered.adminSupportHtml;
    els.adminSchemaPreviews.innerHTML = rendered.adminSchemaHtml;
    els.adminQualitySummary.innerHTML = rendered.adminQualityHtml;
    els.adminControlPlane.innerHTML = rendered.adminControlHtml;
    wireAdminControlPlane();
    return;
  }
  els.adminPanel.classList.add("hidden");
  els.taskPanel.classList.remove("hidden");
  els.reloadAssignmentButton.classList.remove("hidden");
  els.adminWorkspaceContent.innerHTML = "";
  els.adminSupport.innerHTML = "";
  els.adminSchemaPreviews.innerHTML = "";
  els.adminQualitySummary.innerHTML = "";
  els.adminControlPlane.innerHTML = "";
}

function withBusy(button, busyText, action) {
  if (!button || button.dataset.busy === "true") return Promise.resolve();
  const originalText = button.textContent;
  button.dataset.busy = "true";
  button.disabled = true;
  button.classList.add("is-busy");
  if (busyText) button.textContent = busyText;
  return Promise.resolve()
    .then(action)
    .finally(() => {
      button.dataset.busy = "false";
      button.disabled = false;
      button.classList.remove("is-busy");
      button.textContent = originalText;
    });
}

function withFormBusy(form, busyText, action) {
  const button = form?.querySelector("button[type='submit'], button:not([type])");
  return withBusy(button, busyText, action);
}

function wireAdminControlPlane() {
  document.getElementById("admin-project-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await controller.submitAdminProject(event.currentTarget);
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    } catch (error) {
      toast(error.body?.detail || error.message || "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    }
  });
  document.getElementById("admin-task-schema-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await controller.submitAdminTaskSchema(event.currentTarget);
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    } catch (error) {
      toast(error.body?.detail || error.message || "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    }
  });
  document.getElementById("admin-task-instance-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await controller.submitAdminTaskInstance(event.currentTarget);
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    } catch (error) {
      toast(error.body?.detail || error.message || "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    }
  });
  document.getElementById("admin-routing-policy-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await controller.submitAdminRoutingPolicy(event.currentTarget);
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    } catch (error) {
      toast(error.body?.detail || error.message || "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    }
  });
  document.getElementById("admin-enqueue-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await controller.submitAdminEnqueue(event.currentTarget);
        setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    } catch (error) {
      toast(error.body?.detail || error.message || "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    }
  });
  document.getElementById("admin-benchmark-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await controller.submitAdminBenchmark(event.currentTarget);
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    } catch (error) {
      toast(error.body?.detail || error.message || "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    }
  });
  document.getElementById("admin-import-job-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await controller.submitAdminImportJob(event.currentTarget);
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    } catch (error) {
      toast(error.body?.detail || error.message || "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    }
  });
  document.getElementById("admin-export-job-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await controller.submitAdminExportJob(event.currentTarget);
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    } catch (error) {
      toast(error.body?.detail || error.message || "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    }
  });
  document.querySelectorAll("[data-publish-schema-id]").forEach((node) => {
    node.addEventListener("click", async () => {
      try {
        await controller.publishAdminTaskSchema(
          node.dataset.publishSchemaId,
          node.dataset.publishSchemaVersion,
        );
      setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
    } catch (error) {
        toast(error.body?.detail || error.message || "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
        setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      }
    });
  });
  document.querySelectorAll("[data-queue-transition-assignment-id]").forEach((node) => {
    node.addEventListener("click", async () => {
      try {
        await controller.transitionAdminQueue(
          node.dataset.queueTransitionAssignmentId,
          node.dataset.queueTransition,
        );
        setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      } catch (error) {
        toast(error.body?.detail || error.message || "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
        setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      }
    });
  });
  document.querySelectorAll("[data-benchmark-id][data-benchmark-status]").forEach((node) => {
    node.addEventListener("click", async () => {
      try {
        await controller.updateAdminBenchmarkStatus(
          node.dataset.benchmarkId,
          node.dataset.benchmarkStatus,
        );
        setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      } catch (error) {
        toast(error.body?.detail || error.message || "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
        setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      }
    });
  });
  document.querySelectorAll("[data-import-job-retry-id]").forEach((node) => {
    node.addEventListener("click", async () => {
      try {
        await controller.retryAdminImportJob(node.dataset.importJobRetryId);
        setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      } catch (error) {
        toast(error.body?.detail || error.message || "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
        setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      }
    });
  });
  document.querySelectorAll("[data-export-job-retry-id]").forEach((node) => {
    node.addEventListener("click", async () => {
      try {
        await controller.retryAdminExportJob(node.dataset.exportJobRetryId);
        setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      } catch (error) {
        toast(error.body?.detail || error.message || "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
        setSyncStatus("\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e");
      }
    });
  });
}

function setActionVisibility({ reviewerMode, canReview, canAdjudicate, canSaveDraft, canSubmit, canClaim, isSubmitted }) {
  const showExpertPrimary = !reviewerMode && (canSaveDraft || canSubmit || canClaim);
  els.submitButton.classList.toggle("hidden", !showExpertPrimary);
  els.reviewApproveButton.classList.toggle("hidden", !reviewerMode);
  els.reviewReworkButton.classList.toggle("hidden", !reviewerMode);
  els.reviewAdjudicateButton.classList.toggle("hidden", !reviewerMode);
  els.submitButton.disabled = canClaim ? false : !canSubmit;
  els.submitButton.textContent = canClaim
    ? "Взять задание"
    : isSubmitted
      ? "Уже отправлено"
      : "Отправить";
  els.reviewApproveButton.disabled = !canReview;
  els.reviewReworkButton.disabled = !canReview;
  els.reviewAdjudicateButton.disabled = !canAdjudicate;
}

function renderEmptyAssignment() {
  els.heroTitle.textContent = "Задание не выбрано";
  els.heroSubtitle.textContent = "Задания появятся после загрузки списка.";
  els.assignmentStatus.textContent = "-";
  els.assignmentRevision.textContent = "версия -";
  els.completionBar.style.width = "0%";
  els.completionCaption.textContent = "0%";
  if (els.helpList) els.helpList.innerHTML = "";
  if (els.helpArticle) els.helpArticle.innerHTML = "";
  els.assignmentGuidance.innerHTML = "";
  els.taskPanel.innerHTML = `
    <div class="empty-state">
      <h3>Очередь пуста</h3>
      <p>Выберите задание слева.</p>
    </div>
  `;
  setActionVisibility({
    reviewerMode: false,
    canReview: false,
    canAdjudicate: false,
    canSaveDraft: false,
    canSubmit: false,
    canClaim: false,
    isSubmitted: false,
  });
}

function renderAssignment() {
  if (!state.assignmentDetail) {
    renderEmptyAssignment();
    return;
  }

  const { assignment, project, help } = state.assignmentDetail;
  const task = state.assignmentDetail.task_view || state.assignmentDetail.task;
  const reviewerMode = state.session.role === "reviewer";
  const availableTransitions = assignment.available_transitions || [];
  const canSaveDraft = availableTransitions.includes("save_draft");
  const canSubmit = availableTransitions.includes("submit");
  const canClaim = availableTransitions.includes("claim");
  const expertEditable = state.session.role === "expert" && canSaveDraft;
  const canReview = Boolean(state.assignmentDetail.review_workspace?.can_review);
  const canAdjudicate = Boolean(state.assignmentDetail.review_workspace?.can_adjudicate);

  els.heroTitle.textContent = task.title;
  els.heroSubtitle.textContent = task.description;
  els.assignmentStatus.textContent = displayAssignmentStatus(assignment.status);
  els.assignmentRevision.textContent = `версия ${assignment.revision}`;
  els.completionBar.style.width = `${assignment.completion.percent}%`;
  els.completionCaption.textContent = `${assignment.completion.percent}% готово`;

  setActionVisibility({
    reviewerMode,
    canReview,
    canAdjudicate,
    canSaveDraft,
    canSubmit,
    canClaim,
    isSubmitted: assignment.status === "submitted",
  });

  renderHelp(help);

  const taskMarkup = renderTask(task, getCurrentPayload(state.assignmentDetail), expertEditable);
  const reviewerMarkup = reviewerMode ? renderReviewerPanel(state.assignmentDetail) : "";
  const historyMarkup = renderExecutionHistory(state.assignmentDetail);
  els.taskPanel.innerHTML = `${taskMarkup}${reviewerMarkup}${historyMarkup}`;
  bindTaskInteractions({ container: els.taskPanel, task, editable: expertEditable, mutatePayload });
  els.taskPanel.querySelectorAll("[data-open-disagreement-case-id]").forEach((node) => {
    node.addEventListener("click", async () => {
      const detail = await api(`/api/disagreements/${node.dataset.openDisagreementCaseId}`);
      store.setAssignmentDetail(detail);
      renderAssignment();
    });
  });
}

function renderHelp(items) {
  const rendered = renderHelpPane(items, state.selectedHelpId);
  store.setSelectedHelpId(rendered.nextSelectedHelpId);
  els.assignmentGuidance.innerHTML = rendered.articleHtml;
  if (!els.helpList || !els.helpArticle) return;
  els.helpList.innerHTML = rendered.listHtml;
  els.helpArticle.innerHTML = rendered.articleHtml;
  wireHelpSelection(els.helpList, (helpId) => {
    store.setSelectedHelpId(helpId);
    renderHelp(items);
  });
}

function mutatePayload(mutator, task, rerender = true) {
  if (!state.assignmentDetail) return;
  const payload = getCurrentPayload(state.assignmentDetail);
  mutator(payload);
  state.assignmentDetail.assignment.draft = payload;
  state.assignmentDetail.assignment.completion = computeCompletion(task, payload);
  cacheLocalDraft(state.assignmentDetail.assignment.id, payload, state.assignmentDetail.assignment.revision);
  if (rerender) {
    renderAssignment();
  } else {
    els.completionBar.style.width = `${state.assignmentDetail.assignment.completion.percent}%`;
    els.completionCaption.textContent = `${state.assignmentDetail.assignment.completion.percent}% готово`;
    els.submitButton.disabled = !state.assignmentDetail.assignment.completion.is_complete;
  }
  scheduleSave();
}

function appendAgentMessage(role, text) {
  store.appendAgentMessage(role, text);
  renderAgentLog();
}

function renderAgentLog() {
  els.agentLog.innerHTML = buildAgentLogHtml(state.agentMessages);
  els.agentLog.scrollTop = els.agentLog.scrollHeight;
}

function readReviewComment() {
  return document.getElementById("review-comment")?.value?.trim() || "";
}

function readResolvedReviewPassIds() {
  const raw = document.getElementById("adjudication-review-ids")?.value?.trim() || "";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const controller = createShellController({
  store,
  els,
  api,
  toast,
  setSyncStatus,
  renderDashboard,
  renderAssignment,
  renderEmptyAssignment,
  renderAgentLog,
  renderHelp,
  adoptLocalDraft,
  computeCompletion,
  cacheLocalDraft,
  clearLocalDraft,
});

const {
  askAgent,
  bootstrap,
  claimCurrentAssignment,
  handleLogin,
  hardLogout,
  loadDashboard,
  saveDraft,
  scheduleSave: scheduleSaveBase,
  selectAssignment,
  submitAdminProject,
  submitAdminEnqueue,
  submitAdminExportJob,
  submitAdminImportJob,
  submitAdminBenchmark,
  submitAdminRoutingPolicy,
  submitAdminTaskInstance,
  submitAdminTaskSchema,
  transitionAdminQueue,
  retryAdminExportJob,
  retryAdminImportJob,
  updateAdminBenchmarkStatus,
  publishAdminTaskSchema,
  submitAdjudication,
  submitCurrentAssignment,
  submitReview,
} = controller;

function scheduleSave() {
  scheduleSaveBase(saveDraft);
}

els.loginForm.addEventListener("submit", handleLogin);
els.logoutButton.addEventListener("click", hardLogout);
els.refreshButton.addEventListener("click", () =>
  withBusy(els.refreshButton, "Обновление...", async () => {
    setSyncStatus("Обновление...");
    await loadDashboard(true);
    setSyncStatus("Синхронизировано");
  }),
);
els.reloadAssignmentButton.addEventListener("click", async () => {
  await withBusy(els.reloadAssignmentButton, "Загрузка...", async () => {
    if (state.selectedAssignmentId) await selectAssignment(state.selectedAssignmentId);
  });
});
els.submitButton.addEventListener("click", async () => {
  await withBusy(els.submitButton, "Выполняется...", async () => {
    const transitions = state.assignmentDetail?.assignment?.available_transitions || [];
    if (transitions.includes("claim")) {
      await claimCurrentAssignment();
      return;
    }
    await submitCurrentAssignment();
  });
});
els.reviewApproveButton.addEventListener("click", async () => {
  await withBusy(els.reviewApproveButton, "Запись...", () => submitReview("approved", readReviewComment));
});
els.reviewReworkButton.addEventListener("click", async () => {
  await withBusy(els.reviewReworkButton, "Запись...", () => submitReview("needs_rework", readReviewComment));
});
els.reviewAdjudicateButton.addEventListener("click", async () => {
  await withBusy(els.reviewAdjudicateButton, "Закрытие...", () =>
    submitAdjudication(readReviewComment, readResolvedReviewPassIds),
  );
});
els.agentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  return withFormBusy(els.agentForm, "Ответ...", () => askAgent(event, appendAgentMessage));
});

bootstrap();

