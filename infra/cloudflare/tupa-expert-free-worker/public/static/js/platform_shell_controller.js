export function createShellController({
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
}) {
  const state = store.state;

  function displayRole(role) {
    return {
      admin: "администратор",
      expert: "эксперт",
      reviewer: "проверяющий",
      ops: "оператор",
      auditor: "аудитор",
    }[role] || role;
  }

  function patchDashboardAssignment(detail) {
    if (!state.dashboard) return;
    const card = state.dashboard.assignments.find((item) => item.id === detail.assignment.id);
    if (!card) return;
    card.revision = detail.assignment.revision;
    card.status = detail.assignment.status;
    card.stored_status = detail.assignment.stored_status;
    card.routing_mode = detail.assignment.routing_mode;
    card.updated_at = detail.assignment.updated_at;
    card.completion = detail.assignment.completion;
    card.available_transitions = detail.assignment.available_transitions;
  }

  function hardLogout() {
    store.resetAuth();
    els.workspaceView.classList.add("hidden");
    els.loginView.classList.remove("hidden");
    els.userBadge.textContent = "";
    els.userBadge.classList.add("hidden");
    els.logoutButton.classList.add("hidden");
    els.adminPanel?.classList.add("hidden");
    if (els.summaryGrid) els.summaryGrid.innerHTML = "";
    if (els.projectsList) els.projectsList.innerHTML = "";
    if (els.assignmentsList) els.assignmentsList.innerHTML = "";
    if (els.adminSupport) els.adminSupport.innerHTML = "";
    if (els.adminSchemaPreviews) els.adminSchemaPreviews.innerHTML = "";
    if (els.adminQualitySummary) els.adminQualitySummary.innerHTML = "";
    if (els.adminControlPlane) els.adminControlPlane.innerHTML = "";
    renderEmptyAssignment();
    setSyncStatus("Требуется вход");
  }

  async function selectAssignment(assignmentId, silent = false) {
    store.setSelectedAssignmentId(assignmentId);
    if (!silent) renderDashboard();
    setSyncStatus("Загрузка задания...");
    const detail = await api(`/api/assignments/${assignmentId}`);
    store.setAssignmentDetail(adoptLocalDraft(detail, computeCompletion));
    renderAssignment();
    setSyncStatus("Синхронизировано");
  }

  async function loadDashboard(preserveSelection = true) {
    const dashboard = await api("/api/dashboard");
    if (state.session?.role === "admin") {
      const [controlPlane, routing, qualityCenter, importExport] = await Promise.all([
        api("/api/admin/control-plane"),
        api("/api/admin/routing"),
        api("/api/admin/quality-center"),
        api("/api/admin/import-export"),
      ]);
      dashboard.admin_control_plane = controlPlane;
      dashboard.admin_routing = routing;
      dashboard.admin_quality_center = qualityCenter;
      dashboard.admin_import_export = importExport;
    }
    store.setDashboard(dashboard);
    renderDashboard();
    if (state.session?.role === "admin") {
      store.setSelectedAssignmentId(null);
      store.setAssignmentDetail(null);
      return;
    }
    const availableAssignments = state.dashboard.assignments || [];
    const stillExists = availableAssignments.some((item) => item.id === state.selectedAssignmentId);
    if (!preserveSelection || !stillExists) {
      const preferred = state.session?.role === "expert"
        ? availableAssignments.find((item) => item.project_id === "court-llm" || item.project_name?.includes("Судеб"))
          || availableAssignments[0]
        : availableAssignments[0];
      store.setSelectedAssignmentId(preferred?.id ?? null);
    }
    if (state.selectedAssignmentId) {
      await selectAssignment(state.selectedAssignmentId, true);
      return;
    }
    renderEmptyAssignment();
  }

  async function bootstrap() {
    if (!state.token) {
      hardLogout();
      return;
    }

    try {
      const session = await api("/api/session");
      store.setSession(session.user);
      els.userBadge.textContent = `${session.user.display_name} · ${displayRole(session.user.role)}`;
      els.userBadge.classList.remove("hidden");
      els.logoutButton.classList.remove("hidden");
      els.loginView.classList.add("hidden");
      els.workspaceView.classList.remove("hidden");
      await loadDashboard();
      renderAgentLog();
      setSyncStatus("Синхронизировано");
    } catch (error) {
      hardLogout();
      toast("Не удалось восстановить сеанс");
    }
  }

  function scheduleSave(saveDraft) {
    if (!state.assignmentDetail || state.session.role !== "expert" || state.assignmentDetail.assignment.status === "submitted") {
      return;
    }
    store.clearSaveTimer();
    setSyncStatus("Черновик локально");
    store.setSaveTimer(setTimeout(saveDraft, 700));
  }

  async function saveDraft() {
    if (!state.assignmentDetail) return;
    setSyncStatus("Сохранение...");
    const assignmentId = state.assignmentDetail.assignment.id;
    try {
      const detail = await api(`/api/assignments/${assignmentId}/draft`, {
        method: "POST",
        body: JSON.stringify({
          payload: state.assignmentDetail.assignment.draft,
          base_revision: state.assignmentDetail.assignment.revision,
        }),
      });
      store.setAssignmentDetail(detail);
      patchDashboardAssignment(detail);
      clearLocalDraft(assignmentId);
      renderAssignment();
      setSyncStatus("Синхронизировано");
    } catch (error) {
      if (error.status === 409 && error.body?.detail?.latest) {
        store.setAssignmentDetail(error.body.detail.latest);
        renderAssignment();
        patchDashboardAssignment(state.assignmentDetail);
        setSyncStatus("Конфликт версий");
        toast("На сервере более свежая версия. Задание обновлено.");
        return;
      }
      cacheLocalDraft(assignmentId, state.assignmentDetail.assignment.draft, state.assignmentDetail.assignment.revision);
      setSyncStatus("Только локально");
      toast("Не удалось сохранить на сервере. Черновик остался локально.");
    }
  }

  async function submitCurrentAssignment() {
    if (!state.assignmentDetail) return;
    setSyncStatus("Отправка...");
    try {
      const detail = await api(`/api/assignments/${state.assignmentDetail.assignment.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          payload: state.assignmentDetail.assignment.draft,
          base_revision: state.assignmentDetail.assignment.revision,
        }),
      });
      store.setAssignmentDetail(detail);
      clearLocalDraft(detail.assignment.id);
      toast("Задание отправлено");
      await loadDashboard(true);
      setSyncStatus("Отправлено");
    } catch (error) {
      if (error.status === 409 && error.body?.detail?.latest) {
        store.setAssignmentDetail(error.body.detail.latest);
        renderAssignment();
        patchDashboardAssignment(state.assignmentDetail);
        setSyncStatus("Конфликт версий");
        toast("Версия задания устарела.");
        return;
      }
      toast(error.body?.detail || "Отправка не удалась");
      setSyncStatus("Ошибка отправки");
    }
  }

  async function submitReview(outcome, readComment) {
    if (!state.assignmentDetail) return;
    setSyncStatus("Отправка проверки...");
    try {
      const detail = await api(`/api/assignments/${state.assignmentDetail.assignment.id}/review`, {
        method: "POST",
        body: JSON.stringify({
          outcome,
          comment: readComment?.() || "",
          submission_sequence_no: state.assignmentDetail.review_workspace?.latest_submission_sequence,
        }),
      });
      store.setAssignmentDetail(detail);
      patchDashboardAssignment(detail);
      renderAssignment();
      await loadDashboard(true);
      toast("Проверка записана");
      setSyncStatus("Проверка отправлена");
    } catch (error) {
      toast(error.body?.detail?.message || error.body?.detail || "Проверка не отправлена");
      setSyncStatus("Ошибка проверки");
    }
  }

  async function submitAdjudication(readComment, readResolvedReviewPassIds) {
    if (!state.assignmentDetail) return;
    const openCase = (state.assignmentDetail.disagreement_cases || []).find((item) => item.status === "open");
    if (!openCase) {
      toast("Открытый спор не найден");
      return;
    }
    setSyncStatus("Закрытие спора...");
    try {
      const detail = await api(`/api/assignments/${state.assignmentDetail.assignment.id}/adjudicate`, {
        method: "POST",
        body: JSON.stringify({
          disagreement_case_id: openCase.id,
          outcome: "approved",
          comment: readComment?.() || "",
          resolved_review_pass_ids: readResolvedReviewPassIds?.() || openCase.review_pass_ids || [],
        }),
      });
      store.setAssignmentDetail(detail);
      patchDashboardAssignment(detail);
      renderAssignment();
      await loadDashboard(true);
      toast("Решение по спору записано");
      setSyncStatus("Спор закрыт");
    } catch (error) {
      toast(error.body?.detail?.message || error.body?.detail || "Спор не закрыт");
      setSyncStatus("Ошибка спора");
    }
  }

  async function askAgent(event, appendAgentMessage) {
    event.preventDefault();
    const message = els.agentInput.value.trim();
    if (!message) return;
    appendAgentMessage("user", message);
    els.agentInput.value = "";
    try {
      const response = await api("/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          assignment_id: state.assignmentDetail?.assignment?.id ?? null,
        }),
      });
      appendAgentMessage("assistant", response.message);
      if (response.actions?.length) {
        const action = response.actions.find((item) => item.type === "open_help");
        if (action && state.assignmentDetail?.help) {
          store.setSelectedHelpId(action.article_id);
          renderHelp(state.assignmentDetail.help);
        }
      }
      await loadDashboard(true);
    } catch {
      appendAgentMessage("assistant", "Помощник временно недоступен.");
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    els.loginError.classList.add("hidden");
    try {
      const response = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: els.loginUsername.value.trim(),
          password: els.loginPassword.value,
        }),
      });
      store.setToken(response.token);
      await bootstrap();
    } catch (error) {
      els.loginError.textContent = error.body?.detail || "Вход не выполнен";
      els.loginError.classList.remove("hidden");
    }
  }

  function parseJsonField(raw, fallback = {}) {
    const value = (raw || "").trim();
    if (!value) return fallback;
    return JSON.parse(value);
  }

  async function submitAdminProject(form) {
    const payload = {
      id: form.elements.id.value.trim(),
      name: form.elements.name.value.trim(),
      summary: form.elements.summary.value.trim(),
      task_type: form.elements.task_type.value.trim(),
      status: form.elements.status.value.trim() || "pilot",
      accent: form.elements.accent.value.trim() || "sunset",
      instructions: (form.elements.instructions.value || "")
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    };
    await api("/api/admin/projects", { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    await loadDashboard(true);
    toast("Проект создан");
  }

  async function submitAdminTaskSchema(form) {
    const payload = {
      id: form.elements.id.value.trim(),
      project_id: form.elements.project_id.value.trim(),
      task_type: form.elements.task_type.value.trim(),
      title: form.elements.title.value.trim(),
      description: form.elements.description.value.trim(),
      config: parseJsonField(form.elements.config.value),
      preview_payload: parseJsonField(form.elements.preview_payload.value),
    };
    await api("/api/admin/task-schemas", { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    await loadDashboard(true);
    toast("Черновик схемы создан");
  }

  async function publishAdminTaskSchema(schemaId, version) {
    await api(`/api/admin/task-schemas/${schemaId}/publish`, {
      method: "POST",
      body: JSON.stringify({ version: Number(version) }),
    });
    await loadDashboard(true);
    toast(`Схема опубликована: ${schemaId}@${version}`);
  }

  async function submitAdminTaskInstance(form) {
    const payload = {
      id: form.elements.id.value.trim(),
      project_id: form.elements.project_id.value.trim(),
      task_schema_id: form.elements.task_schema_id.value.trim(),
      task_schema_version: Number(form.elements.task_schema_version.value.trim()),
      title: form.elements.title.value.trim(),
      description: form.elements.description.value.trim(),
      payload: parseJsonField(form.elements.payload.value),
    };
    await api("/api/admin/task-instances", { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    await loadDashboard(true);
    toast("Задание создано");
  }

  function parseListField(raw) {
    return (raw || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function submitAdminRoutingPolicy(form) {
    const projectId = form.elements.project_id.value.trim();
    const payload = {
      routing_mode: form.elements.routing_mode.value.trim() || "push",
      default_reviewer_id: form.elements.default_reviewer_id.value.trim() || null,
    };
    await api(`/api/admin/routing/projects/${projectId}/policy`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    form.reset();
    await loadDashboard(true);
    toast("Правило маршрутизации сохранено");
  }

  async function submitAdminEnqueue(form) {
    const taskInstanceId = form.elements.task_instance_id.value.trim();
    const payload = {
      qa_mode: form.elements.qa_mode.value.trim() || "normal",
      routing_mode: form.elements.routing_mode.value.trim() || null,
      assignee_ids: parseListField(form.elements.assignee_ids.value),
      reviewer_id: form.elements.reviewer_id.value.trim() || null,
    };
    await api(`/api/admin/queue/task-instances/${taskInstanceId}/enqueue`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    form.reset();
    await loadDashboard(true);
    toast("Задание добавлено в очередь");
  }

  async function transitionAdminQueue(assignmentId, transition) {
    await api(`/api/admin/queue/assignments/${assignmentId}/transition`, {
      method: "POST",
      body: JSON.stringify({ transition }),
    });
    await loadDashboard(true);
    toast("Очередь обновлена");
  }

  async function submitAdminBenchmark(form) {
    const payload = {
      id: form.elements.id.value.trim() || null,
      task_instance_id: form.elements.task_instance_id.value.trim(),
      title: form.elements.title.value.trim() || null,
      status: form.elements.status.value.trim() || "draft",
      scoring_policy: form.elements.scoring_policy.value.trim() || "exact_match",
      expected_payload: parseJsonField(form.elements.expected_payload.value),
    };
    await api("/api/admin/benchmarks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    form.reset();
    await loadDashboard(true);
    toast("Эталон создан");
  }

  async function updateAdminBenchmarkStatus(benchmarkId, status) {
    await api(`/api/admin/benchmarks/${benchmarkId}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    await loadDashboard(true);
    toast("Статус эталона обновлен");
  }

  async function submitAdminImportJob(form) {
    const payload = {
      id: form.elements.id.value.trim() || null,
      project_id: form.elements.project_id.value.trim(),
      source_ref: form.elements.source_ref.value.trim(),
      format: form.elements.format.value.trim() || "json",
    };
    await api("/api/admin/import-jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    form.reset();
    await loadDashboard(true);
    toast("Задание на импорт создано");
  }

  async function retryAdminImportJob(jobId) {
    await api(`/api/admin/import-jobs/${jobId}/retry`, {
      method: "POST",
    });
    await loadDashboard(true);
    toast("Импорт перезапущен");
  }

  async function submitAdminExportJob(form) {
    const payload = {
      id: form.elements.id.value.trim() || null,
      project_id: form.elements.project_id.value.trim(),
      source_ref: form.elements.source_ref.value.trim() || null,
      format: form.elements.format.value.trim() || "json",
    };
    await api("/api/admin/export-jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    form.reset();
    await loadDashboard(true);
    toast("Задание на выгрузку создано");
  }

  async function retryAdminExportJob(jobId) {
    await api(`/api/admin/export-jobs/${jobId}/retry`, {
      method: "POST",
    });
    await loadDashboard(true);
    toast("Выгрузка перезапущена");
  }

  async function claimCurrentAssignment() {
    if (!state.assignmentDetail) return;
    const detail = await api(`/api/assignments/${state.assignmentDetail.assignment.id}/claim`, {
      method: "POST",
    });
    store.setAssignmentDetail(detail);
    patchDashboardAssignment(detail);
    await loadDashboard(true);
    toast("Задание взято в работу");
  }

  return {
    askAgent,
    bootstrap,
    handleLogin,
    hardLogout,
    loadDashboard,
    patchDashboardAssignment,
    saveDraft,
    scheduleSave,
    selectAssignment,
    submitAdminProject,
    submitAdminRoutingPolicy,
    submitAdminTaskInstance,
    submitAdminTaskSchema,
    submitAdminEnqueue,
    submitAdminExportJob,
    submitAdminImportJob,
    submitAdminBenchmark,
    transitionAdminQueue,
    retryAdminExportJob,
    retryAdminImportJob,
    updateAdminBenchmarkStatus,
    claimCurrentAssignment,
    publishAdminTaskSchema,
    submitAdjudication,
    submitCurrentAssignment,
    submitReview,
  };
}
