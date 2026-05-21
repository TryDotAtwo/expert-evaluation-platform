function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanVisibleText(value, fallback = "") {
  const text = String(value ?? "");
  return text.includes("???") ? fallback : text;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayStatus(value) {
  return {
    queued: "в очереди",
    available: "доступно",
    assigned: "назначено",
    claimed: "взято",
    in_progress: "в работе",
    submitted: "отправлено",
    approved: "принято",
    needs_rework: "доработка",
    blocked: "заблокировано",
    active: "активно",
    archived: "архив",
    draft: "черновик",
    draft_saved: "черновик сохранен",
    published: "опубликовано",
    pilot: "пилот",
    failed: "ошибка",
    completed: "готово",
    open: "открыто",
    closed: "закрыто",
  }[value] || value || "-";
}

function displayTaskType(value) {
  return {
    rubric_scorecard: "оценка по критериям",
    classification: "классификация",
    pairwise_preference: "сравнение вариантов",
    triplet_similarity: "семантическая тройка",
  }[value] || value || "-";
}

function displayMode(value) {
  return {
    push: "назначение",
    claim: "самовыбор",
    normal: "обычно",
    overlap: "перекрестная проверка",
    gold: "эталон",
    exact_match: "точное совпадение",
    classification_selected_option: "выбранный класс",
  }[value] || value || "-";
}

function displaySignal(value) {
  return {
    agreement_rate: "согласованность",
    gold_accuracy: "точность по эталону",
    reviewer_accuracy: "точность проверяющего",
    completion_abandonment: "незавершенные задания",
    lead_time: "время прохождения",
    support_escalation_rate: "частота обращений",
  }[value] || value || "-";
}

function displaySubjectType(value) {
  return {
    global: "общий уровень",
    project: "проект",
    reviewer: "проверяющий",
    assignment: "задание",
  }[value] || "сущность";
}

function detailsBlock(title, content, open = false) {
  return `
    <details class="disclosure" ${open ? "open" : ""}>
      <summary>${escapeHtml(title)}</summary>
      <div class="disclosure-body">${content}</div>
    </details>
  `;
}

function summaryCard(title, value, caption) {
  return `
    <div class="summary-card">
      <div class="eyebrow">${escapeHtml(title)}</div>
      <strong>${value}</strong>
      <div class="subtle">${escapeHtml(caption)}</div>
    </div>
  `;
}

function assignmentCard(assignment, selectedAssignmentId) {
  const selected = assignment.id === selectedAssignmentId ? "selected" : "";
  const chips = [
    `<span class="meta-chip">${escapeHtml(displayStatus(assignment.status))}</span>`,
    `<span class="meta-chip">${escapeHtml(displayTaskType(assignment.task_type))}</span>`,
    assignment.routing_mode ? `<span class="meta-chip">маршрут: ${escapeHtml(displayMode(assignment.routing_mode))}</span>` : "",
    `<span class="meta-chip">${assignment.completion.percent}%</span>`,
    `<span class="meta-chip">${escapeHtml(assignment.due_label || "без срока")}</span>`,
    assignment.qa_mode ? `<span class="meta-chip">проверка: ${escapeHtml(displayMode(assignment.qa_mode))}</span>` : "",
    assignment.review_queue_label ? `<span class="meta-chip">${escapeHtml(assignment.review_queue_label)}</span>` : "",
    assignment.peer_count ? `<span class="meta-chip">парные: ${escapeHtml(assignment.peer_count)}</span>` : "",
    assignment.open_case_count ? `<span class="meta-chip">споры: ${escapeHtml(assignment.open_case_count)}</span>` : "",
    assignment.is_gold ? `<span class="meta-chip">эталон</span>` : "",
  ].join("");
  return `
    <button class="stack-item ${selected}" data-assignment-id="${assignment.id}" type="button">
      <h4>${escapeHtml(assignment.task_title)}</h4>
      <div class="subtle">${escapeHtml(assignment.project_name)}</div>
      <div class="assignment-meta">
        ${chips}
      </div>
      ${assignment.assignee_name ? `<div class="stack-meta"><span class="meta-chip">${escapeHtml(assignment.assignee_name)}</span></div>` : ""}
    </button>
  `;
}

function renderReviewerSurface(reviewerSurface, selectedAssignmentId) {
  const sections = reviewerSurface?.sections || [];
  if (!sections.length) {
    return `<div class="empty-state"><p>Очереди проверки пусты.</p></div>`;
  }
  return sections
    .map(
      (section) => `
        <section class="stack-item reviewer-section">
          <h4>${escapeHtml(section.title)}</h4>
          <div class="subtle">${escapeHtml(section.description)}</div>
          <div class="stack-meta">
            <span class="meta-chip">количество: ${escapeHtml(section.count)}</span>
          </div>
          <div class="stack-list compact-scroll">
            ${
              section.items.length
                ? section.items.map((assignment) => assignmentCard(assignment, selectedAssignmentId)).join("")
                : `<div class="subtle">Очередь пуста.</div>`
            }
          </div>
        </section>
      `,
    )
    .join("");
}

export function renderDashboardShell({ dashboard, sessionRole, selectedAssignmentId }) {
  const summary = dashboard.summary || {};
  const reviewerSurface = dashboard.reviewer_surface || { counts: {}, sections: [] };
  const summaryItems = sessionRole === "reviewer"
    ? [
        summaryCard("На проверке", reviewerSurface.counts.pending_review || 0, "Ожидают решения"),
        summaryCard("Возвраты", reviewerSurface.counts.returned_to_expert || 0, "Отправлены на доработку"),
        summaryCard("Споры", reviewerSurface.counts.pending_adjudication || 0, "Открытые разногласия"),
        summaryCard("Готово", reviewerSurface.counts.review_complete || 0, "Закрытые проверки"),
      ]
    : [
        summaryCard("Доступно", summary.available ?? summary.queued ?? 0, "Можно взять"),
        summaryCard("Назначено", summary.assigned ?? summary.in_progress ?? 0, "Ждет эксперта"),
        summaryCard("В работе", summary.claimed ?? summary.draft_saved ?? 0, "Есть черновик"),
        summaryCard("Отправлено", summary.submitted || 0, "Готовые задания"),
        summaryCard("Обращения", summary.open_support || 0, "Открытые вопросы"),
      ];
  const summaryHtml = summaryItems.join("");

  const projectsHtml = (dashboard.projects || [])
    .map(
      (project) => `
        <div class="stack-item project-pill">
          <h4>${escapeHtml(project.name)}</h4>
          <div class="subtle">${escapeHtml(project.summary || "")}</div>
          <div class="project-meta">
            <span class="meta-chip">${escapeHtml(displayTaskType(project.task_type))}</span>
            <span class="meta-chip">доступно: ${escapeHtml(project.counts.available ?? project.counts.queued ?? 0)}</span>
            <span class="meta-chip">назначено: ${escapeHtml(project.counts.assigned ?? project.counts.in_progress ?? 0)}</span>
            <span class="meta-chip">в работе: ${escapeHtml(project.counts.claimed ?? project.counts.draft_saved ?? 0)}</span>
            <span class="meta-chip">готово: ${project.counts.submitted}</span>
          </div>
        </div>
      `,
    )
    .join("");

  const assignmentsHtml = sessionRole === "reviewer"
    ? renderReviewerSurface(reviewerSurface, selectedAssignmentId)
    : (dashboard.assignments || []).map((assignment) => assignmentCard(assignment, selectedAssignmentId)).join("");

  const adminVisible = sessionRole === "admin";
  const adminWorkspaceHtml = adminVisible
    ? `
      <div class="admin-start-grid">
        <div class="stack-item">
          <h4>Что делать</h4>
          <div class="subtle">Проверьте обращения, заблокированные задания, очередь и качество. Служебные формы раскрываются ниже.</div>
        </div>
        <div class="stack-item">
          <h4>Очередь</h4>
          <div class="stack-meta">
            <span class="meta-chip">доступно: ${escapeHtml(summary.available ?? summary.queued ?? 0)}</span>
            <span class="meta-chip">в работе: ${escapeHtml(summary.claimed ?? summary.draft_saved ?? 0)}</span>
            <span class="meta-chip">отправлено: ${escapeHtml(summary.submitted || 0)}</span>
          </div>
        </div>
        <div class="stack-item">
          <h4>Качество</h4>
          <div class="stack-meta">
            <span class="meta-chip">споры: ${escapeHtml(dashboard.admin_quality_center?.counts?.open_disagreements || 0)}</span>
            <span class="meta-chip">блокировки: ${escapeHtml(dashboard.admin_quality_center?.counts?.blocked || 0)}</span>
            <span class="meta-chip">эталоны: ${escapeHtml(dashboard.admin_quality_center?.counts?.benchmarks_active || 0)}</span>
          </div>
        </div>
      </div>
    `
    : "";
  const adminSupportHtml = adminVisible
    ? (dashboard.support_requests || [])
        .map(
          (item) => `
            <div class="stack-item">
              <h5>${escapeHtml(item.user_name)}</h5>
              <div class="subtle">${escapeHtml(item.message)}</div>
              <div class="stack-meta">
                <span class="meta-chip">${escapeHtml(displayStatus(item.status))}</span>
                <span class="meta-chip">${formatDate(item.created_at)}</span>
              </div>
            </div>
          `,
        )
        .join("") || `<div class="empty-state"><p>Открытых обращений нет.</p></div>`
    : "";

  const adminSchemaHtml = adminVisible
    ? (dashboard.schema_previews || [])
        .map(
          (item) => `
            <div class="stack-item">
              <h5>${escapeHtml(item.title)}</h5>
              <div class="subtle">${escapeHtml(item.project_name)} · ${escapeHtml(displayTaskType(item.task_type))}</div>
              <div class="stack-meta">
                <span class="meta-chip">версия ${escapeHtml(item.schema_version)}</span>
                <span class="meta-chip">полей: ${escapeHtml(item.preview_fields.length)}</span>
                <span class="meta-chip">заданий: ${escapeHtml(item.assignment_count)}</span>
              </div>
            </div>
          `,
        )
        .join("") || `<div class="empty-state"><p>Предпросмотр схем пуст.</p></div>`
    : "";

  const adminQualityHtml = adminVisible
    ? (() => {
        const qualityCenter = dashboard.admin_quality_center || {
          global: [],
          projects: [],
          reviewers: [],
          disagreements: [],
          triage: { support: [], blocked: [] },
          benchmarks: [],
          counts: {},
        };
        const globalSignals = qualityCenter.global || dashboard.quality_summary?.global || [];
        const projectSignals = qualityCenter.projects || [];
        const reviewerSignals = qualityCenter.reviewers || [];
        const disagreements = qualityCenter.disagreements || [];
        const triage = qualityCenter.triage || { support: [], blocked: [] };
        const benchmarks = qualityCenter.benchmarks || [];
        const globalHtml = globalSignals.length
          ? globalSignals
              .map(
                (item) => `
                  <div class="stack-item">
                    <strong>${escapeHtml(displaySignal(item.signal_type))}</strong>
                    <div class="subtle">значение: ${escapeHtml(Number(item.value).toFixed(2))}</div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty-state"><p>Сигналы качества отсутствуют.</p></div>`;
        const projectHtml = projectSignals
          .map(
            (project) => `
              <div class="stack-item">
                <h5>${escapeHtml(project.project_name || project.project_id)}</h5>
                <div class="stack-meta">
                  <span class="meta-chip">споры: ${escapeHtml(project.counts.disagreements_open)}</span>
                  <span class="meta-chip">обращения: ${escapeHtml(project.counts.support_open)}</span>
                  <span class="meta-chip">блокировки: ${escapeHtml(project.counts.blocked)}</span>
                  <span class="meta-chip">проверяющие: ${escapeHtml(project.counts.reviewers)}</span>
                </div>
                <div class="stack-meta">
                  ${(project.signals || []).map((item) => `<span class="meta-chip">${escapeHtml(displaySignal(item.signal_type))}: ${escapeHtml(Number(item.value).toFixed(2))}</span>`).join("")}
                </div>
              </div>
            `,
          )
          .join("");
        const reviewerHtml = reviewerSignals.length
          ? reviewerSignals
              .map(
                (reviewer) => `
                  <div class="stack-item">
                    <h5>${escapeHtml(reviewer.reviewer_name)}</h5>
                    <div class="stack-meta">
                      <span class="meta-chip">проверки: ${escapeHtml(reviewer.counts.reviews)}</span>
                      <span class="meta-chip">доработки: ${escapeHtml(reviewer.counts.needs_rework)}</span>
                      <span class="meta-chip">эскалации: ${escapeHtml(reviewer.counts.escalated)}</span>
                      <span class="meta-chip">отмены: ${escapeHtml(reviewer.counts.overturned_reviews)}</span>
                    </div>
                    <div class="stack-meta">
                      ${(reviewer.signals || []).map((item) => `<span class="meta-chip">${escapeHtml(displaySignal(item.signal_type))}: ${escapeHtml(Number(item.value).toFixed(2))}</span>`).join("")}
                    </div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty-state"><p>Данных по проверяющим нет.</p></div>`;
        const disagreementHtml = disagreements.length
          ? disagreements
              .map(
                (item) => `
                  <div class="stack-item">
                    <h5>${escapeHtml(item.task_title)}</h5>
                    <div class="subtle">${escapeHtml(item.project_name)}</div>
                    <div class="stack-meta">
                      <span class="meta-chip">группа: ${escapeHtml(item.assignment_group_id || "-")}</span>
                      <span class="meta-chip">отправка: ${escapeHtml(item.submission_sequence_no || "-")}</span>
                    </div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty-state"><p>Открытых споров нет.</p></div>`;
        const supportHtml = (triage.support || []).length
          ? triage.support
              .map(
                (item) => `
                  <div class="stack-item">
                    <h5>${escapeHtml(item.user_name)}</h5>
                    <div class="subtle">${escapeHtml(item.project_name || item.project_id || "общий")} · ${escapeHtml(item.message)}</div>
                    <div class="stack-meta">
                      <span class="meta-chip">${formatDate(item.created_at)}</span>
                      <span class="meta-chip">${item.assignment_id ? "задание связано" : "без задания"}</span>
                    </div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty-state"><p>Открытых обращений нет.</p></div>`;
        const blockedHtml = (triage.blocked || []).length
          ? triage.blocked
              .map(
                (item) => `
                  <div class="stack-item">
                    <h5>${escapeHtml(item.task_title)}</h5>
                    <div class="subtle">${escapeHtml(item.project_name)}</div>
                    <div class="stack-meta">
                      <span class="meta-chip">было: ${escapeHtml(displayStatus(item.blocked_from_status))}</span>
                      <span class="meta-chip">${formatDate(item.updated_at)}</span>
                    </div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty-state"><p>Заблокированных заданий нет.</p></div>`;
        const benchmarkHtml = benchmarks.length
          ? benchmarks
              .map(
                (item) => `
                  <div class="stack-item">
                    <div class="inline-row">
                      <div>
                        <h5>${escapeHtml(item.title || item.task_title || item.id)}</h5>
                        <div class="subtle">${escapeHtml(item.project_name || item.project_id || "-")}</div>
                      </div>
                      <div class="stack-meta">
                        ${
                          item.status !== "active"
                            ? `<button class="ghost-button compact" data-benchmark-id="${escapeHtml(item.id)}" data-benchmark-status="active" type="button">Активировать</button>`
                            : ""
                        }
                        ${
                          item.status !== "archived"
                            ? `<button class="ghost-button compact" data-benchmark-id="${escapeHtml(item.id)}" data-benchmark-status="archived" type="button">В архив</button>`
                            : ""
                        }
                        ${
                          item.status !== "draft"
                            ? `<button class="ghost-button compact" data-benchmark-id="${escapeHtml(item.id)}" data-benchmark-status="draft" type="button">В черновик</button>`
                            : ""
                        }
                      </div>
                    </div>
                    <div class="stack-meta">
                      <span class="meta-chip">${escapeHtml(displayStatus(item.status))}</span>
                      <span class="meta-chip">правило: ${escapeHtml(displayMode(item.scoring_policy))}</span>
                      <span class="meta-chip">заданий: ${escapeHtml(item.assignment_count)}</span>
                      <span class="meta-chip">точность: ${escapeHtml(item.gold_accuracy == null ? "-" : Number(item.gold_accuracy).toFixed(2))}</span>
                    </div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty-state"><p>Эталоны не заведены.</p></div>`;
        return `
          <div class="stack-item">
            <h5>Центр качества</h5>
            <div class="stack-meta">
              <span class="meta-chip">проекты: ${escapeHtml(qualityCenter.counts.projects || 0)}</span>
              <span class="meta-chip">проверяющие: ${escapeHtml(qualityCenter.counts.reviewers || 0)}</span>
              <span class="meta-chip">споры: ${escapeHtml(qualityCenter.counts.open_disagreements || 0)}</span>
              <span class="meta-chip">блокировки: ${escapeHtml(qualityCenter.counts.blocked || 0)}</span>
              <span class="meta-chip">эталоны: ${escapeHtml(qualityCenter.counts.benchmarks_active || 0)}</span>
            </div>
          </div>
          <form id="admin-benchmark-form" class="admin-form">
            <h5>Создать эталон</h5>
            <input name="id" placeholder="идентификатор, необязательно" />
            <input name="task_instance_id" placeholder="идентификатор задания" />
            <input name="title" placeholder="название эталона" />
            <input name="status" placeholder="черновик | активно | архив" />
            <input name="scoring_policy" placeholder="правило оценки" />
            <textarea name="expected_payload" rows="4" placeholder='{"selected_option":"accept","rationale":"эталон"}'></textarea>
            <button class="secondary-button" type="submit">Создать эталон</button>
          </form>
          ${detailsBlock("Глобальные сигналы", `<div class="stack-list">${globalHtml}</div>`)}
          <div class="section-title">Проекты</div>
          <div class="stack-list">${projectHtml || `<div class="empty-state"><p>Деталей по проектам нет.</p></div>`}</div>
          ${detailsBlock("Проверяющие", `<div class="stack-list">${reviewerHtml}</div>`)}
          ${detailsBlock("Споры", `<div class="stack-list">${disagreementHtml}</div>`)}
          ${detailsBlock("Обращения", `<div class="stack-list">${supportHtml}</div>`)}
          ${detailsBlock("Блокировки", `<div class="stack-list">${blockedHtml}</div>`)}
          ${detailsBlock("Эталоны", `<div class="stack-list">${benchmarkHtml}</div>`)}
        `;
      })()
    : "";

  const adminControlHtml = adminVisible
    ? (() => {
        const controlPlane = dashboard.admin_control_plane || { projects: [], task_schemas: [], task_instances: [] };
        const routingPlane = dashboard.admin_routing || { projects: [], task_instances: [], queue_items: [], experts: [], reviewers: [] };
        const importExportPlane = dashboard.admin_import_export || {
          projects: [],
          import_jobs: [],
          export_jobs: [],
          counts: {},
        };
        const projectItems = controlPlane.projects.length
          ? controlPlane.projects
              .map(
                (project) => `
                  <div class="stack-item">
                    <h5>${escapeHtml(project.name)}</h5>
                    <div class="subtle">${escapeHtml(project.summary || "")}</div>
                    <div class="stack-meta">
                      <span class="meta-chip">${escapeHtml(displayTaskType(project.task_type))}</span>
                      <span class="meta-chip">${escapeHtml(displayStatus(project.status))}</span>
                    </div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty-state"><p>Административных проектов пока нет.</p></div>`;
        const schemaItems = controlPlane.task_schemas.length
          ? controlPlane.task_schemas
              .map(
                (item) => `
                  <div class="stack-item">
                    <div class="inline-row">
                      <div>
                        <h5>${escapeHtml(item.schema.title)}</h5>
                        <div class="subtle">версия ${escapeHtml(item.schema.version)} · ${escapeHtml(displayTaskType(item.schema.task_type))}</div>
                      </div>
                      ${
                        item.publishable
                          ? `<button class="ghost-button compact" data-publish-schema-id="${escapeHtml(item.schema.id)}" data-publish-schema-version="${escapeHtml(item.schema.version)}" type="button">Опубликовать</button>`
                          : `<span class="meta-chip">опубликовано</span>`
                      }
                    </div>
                    <div class="stack-meta">
                      <span class="meta-chip">${escapeHtml(displayStatus(item.schema.status))}</span>
                      <span class="meta-chip">заданий: ${escapeHtml(item.instance_count)}</span>
                    </div>
                    <div class="subtle">Предпросмотр: ${escapeHtml(item.preview.title || item.schema.title)}</div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty-state"><p>Схем пока нет.</p></div>`;
        const taskInstanceItems = controlPlane.task_instances.length
          ? controlPlane.task_instances
              .slice(-5)
              .reverse()
              .map(
                (taskInstance) => `
                  <div class="stack-item">
                    <h5>${escapeHtml(taskInstance.title)}</h5>
                    <div class="subtle">Служебный код скрыт</div>
                    <div class="stack-meta">
                      <span class="meta-chip">версия схемы ${escapeHtml(taskInstance.task_schema_version)}</span>
                      <span class="meta-chip">проект задан</span>
                    </div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty-state"><p>Созданных заданий пока нет.</p></div>`;
        const routingProjectItems = routingPlane.projects.length
          ? routingPlane.projects
              .map(
                (project) => `
                  <div class="stack-item">
                    <h5>${escapeHtml(project.name)}</h5>
                    <div class="stack-meta">
                      <span class="meta-chip">маршрут: ${escapeHtml(displayMode(project.policy.routing_mode))}</span>
                      <span class="meta-chip">проверяющий: ${project.policy.default_reviewer_id ? "назначен" : "не назначен"}</span>
                    </div>
                    <div class="stack-meta">
                      <span class="meta-chip">доступно: ${escapeHtml(project.queue_counts.available)}</span>
                      <span class="meta-chip">назначено: ${escapeHtml(project.queue_counts.assigned)}</span>
                      <span class="meta-chip">в работе: ${escapeHtml(project.queue_counts.claimed)}</span>
                      <span class="meta-chip">блокировки: ${escapeHtml(project.queue_counts.blocked)}</span>
                    </div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty-state"><p>Правил маршрутизации пока нет.</p></div>`;
        const routingTaskInstanceItems = routingPlane.task_instances.length
          ? routingPlane.task_instances
              .slice(-8)
              .reverse()
              .map(
                (taskInstance) => `
                  <div class="stack-item">
                    <h5>${escapeHtml(taskInstance.title)}</h5>
                    <div class="subtle">Служебный код скрыт</div>
                    <div class="stack-meta">
                      <span class="meta-chip">проект задан</span>
                      <span class="meta-chip">в очереди: ${escapeHtml(taskInstance.enqueued_count)}</span>
                    </div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty-state"><p>Заданий для очереди пока нет.</p></div>`;
        const queueItems = routingPlane.queue_items.length
          ? routingPlane.queue_items
              .map(
                (item) => `
                  <div class="stack-item">
                    <div class="inline-row">
                      <div>
                        <h5>${escapeHtml(item.task_title)}</h5>
                        <div class="subtle">${escapeHtml(item.project_name)}</div>
                      </div>
                      ${
                        item.available_transitions.includes("unblock")
                          ? `<button class="ghost-button compact" data-queue-transition-assignment-id="${escapeHtml(item.id)}" data-queue-transition="unblock" type="button">Разблокировать</button>`
                          : `<button class="ghost-button compact" data-queue-transition-assignment-id="${escapeHtml(item.id)}" data-queue-transition="block" type="button">Заблокировать</button>`
                      }
                    </div>
                    <div class="stack-meta">
                      <span class="meta-chip">${escapeHtml(displayStatus(item.status))}</span>
                      <span class="meta-chip">маршрут: ${escapeHtml(displayMode(item.routing_mode))}</span>
                      <span class="meta-chip">проверка: ${escapeHtml(displayMode(item.qa_mode))}</span>
                      <span class="meta-chip">эксперт: ${item.assignee_id ? "назначен" : "очередь"}</span>
                      <span class="meta-chip">проверяющий: ${item.reviewer_id ? "назначен" : "не назначен"}</span>
                    </div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty-state"><p>Очередь пока пуста.</p></div>`;
        const importJobItems = importExportPlane.import_jobs.length
          ? importExportPlane.import_jobs
              .map(
                (item) => `
                  <div class="stack-item">
                    <div class="inline-row">
                      <div>
                        <h5>Импорт данных</h5>
                        <div class="subtle">${escapeHtml(item.project_name || "проект задан")}</div>
                      </div>
                      ${
                        item.retryable
                          ? `<button class="ghost-button compact" data-import-job-retry-id="${escapeHtml(item.id)}" type="button">Повторить</button>`
                          : `<span class="meta-chip">стабильно</span>`
                      }
                    </div>
                    <div class="stack-meta">
                      <span class="meta-chip">${escapeHtml(displayStatus(item.status))}</span>
                      <span class="meta-chip">формат: ${escapeHtml(item.format)}</span>
                      <span class="meta-chip">артефакт: ${item.artifact_ref ? "сформирован" : "-"}</span>
                    </div>
                    <div class="subtle">отчет: ${item.report_ref ? "сформирован" : "-"} · ошибка: ${escapeHtml(item.error || "нет")}</div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty-state"><p>Заданий на импорт пока нет.</p></div>`;
        const exportJobItems = importExportPlane.export_jobs.length
          ? importExportPlane.export_jobs
              .map(
                (item) => `
                  <div class="stack-item">
                    <div class="inline-row">
                      <div>
                        <h5>Выгрузка данных</h5>
                        <div class="subtle">${escapeHtml(item.project_name || "проект задан")}</div>
                      </div>
                      ${
                        item.retryable
                          ? `<button class="ghost-button compact" data-export-job-retry-id="${escapeHtml(item.id)}" type="button">Повторить</button>`
                          : `<span class="meta-chip">стабильно</span>`
                      }
                    </div>
                    <div class="stack-meta">
                      <span class="meta-chip">${escapeHtml(displayStatus(item.status))}</span>
                      <span class="meta-chip">формат: ${escapeHtml(item.format)}</span>
                      <span class="meta-chip">артефакт: ${item.artifact_ref ? "сформирован" : "-"}</span>
                    </div>
                    <div class="subtle">отчет: ${item.report_ref ? "сформирован" : "-"} · ошибка: ${escapeHtml(item.error || "нет")}</div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty-state"><p>Заданий на выгрузку пока нет.</p></div>`;
        return `
          ${detailsBlock("Создать проект", `
            <form id="admin-project-form" class="admin-form">
              <input name="id" placeholder="идентификатор проекта" />
              <input name="name" placeholder="название проекта" />
              <input name="summary" placeholder="краткое описание" />
              <input name="task_type" placeholder="тип задания" />
              <input name="status" placeholder="статус" />
              <input name="accent" placeholder="цветовой акцент" />
              <textarea name="instructions" rows="2" placeholder="одна инструкция на строку"></textarea>
              <button class="secondary-button" type="submit">Создать проект</button>
            </form>
          `)}
          ${detailsBlock("Создать схему", `
            <form id="admin-task-schema-form" class="admin-form">
              <input name="id" placeholder="идентификатор схемы" />
              <input name="project_id" placeholder="идентификатор проекта" />
              <input name="task_type" placeholder="тип задания" />
              <input name="title" placeholder="название схемы" />
              <input name="description" placeholder="описание" />
              <textarea name="config" rows="4" placeholder='{"options":["accept","reject"],"requires_rationale":true}'></textarea>
              <textarea name="preview_payload" rows="4" placeholder='{"headline":"заголовок","text":"текст"}'></textarea>
              <button class="secondary-button" type="submit">Создать схему</button>
            </form>
          `)}
          ${detailsBlock("Создать задание", `
            <form id="admin-task-instance-form" class="admin-form">
              <input name="id" placeholder="идентификатор задания" />
              <input name="project_id" placeholder="идентификатор проекта" />
              <input name="task_schema_id" placeholder="идентификатор схемы" />
              <input name="task_schema_version" placeholder="номер версии схемы" />
              <input name="title" placeholder="название задания" />
              <input name="description" placeholder="описание" />
              <textarea name="payload" rows="4" placeholder='{"headline":"case","text":"body"}'></textarea>
              <button class="secondary-button" type="submit">Создать задание</button>
            </form>
          `)}
          ${detailsBlock("Список проектов", `<div class="stack-list">${projectItems}</div>`)}
          ${detailsBlock("Схемы", `<div class="stack-list">${schemaItems}</div>`)}
          ${detailsBlock("Задания", `<div class="stack-list">${taskInstanceItems}</div>`)}
          ${detailsBlock("Маршрутизация", `
            <form id="admin-routing-policy-form" class="admin-form">
              <input name="project_id" placeholder="идентификатор проекта" />
              <input name="routing_mode" placeholder="назначение или самовыбор" />
              <input name="default_reviewer_id" placeholder="идентификатор проверяющего" />
              <button class="secondary-button" type="submit">Сохранить правило</button>
              <div class="subtle">Доступно проверяющих: ${(routingPlane.reviewers || []).length}</div>
            </form>
            <div class="stack-list">${routingProjectItems}</div>
          `)}
          ${detailsBlock("Очередь", `
            <form id="admin-enqueue-form" class="admin-form">
              <input name="task_instance_id" placeholder="идентификатор задания" />
              <input name="qa_mode" placeholder="обычно | перекрестно | эталон" />
              <input name="routing_mode" placeholder="маршрут, необязательно" />
              <input name="assignee_ids" placeholder="идентификаторы экспертов через запятую" />
              <input name="reviewer_id" placeholder="идентификатор проверяющего, необязательно" />
              <button class="secondary-button" type="submit">Добавить в очередь</button>
              <div class="subtle">Доступно экспертов: ${(routingPlane.experts || []).length}</div>
            </form>
            <div class="section-title">Кандидаты</div>
            <div class="stack-list">${routingTaskInstanceItems}</div>
            <div class="section-title">Очередь</div>
            <div class="stack-list">${queueItems}</div>
          `)}
          ${detailsBlock("Импорт и выгрузка", `
            <div class="stack-item">
              <h5>Журнал заданий</h5>
              <div class="stack-meta">
                <span class="meta-chip">импорт: ${escapeHtml(importExportPlane.counts.imports_total || 0)}</span>
                <span class="meta-chip">ошибок импорта: ${escapeHtml(importExportPlane.counts.imports_failed || 0)}</span>
                <span class="meta-chip">выгрузка: ${escapeHtml(importExportPlane.counts.exports_total || 0)}</span>
                <span class="meta-chip">ошибок выгрузки: ${escapeHtml(importExportPlane.counts.exports_failed || 0)}</span>
              </div>
            </div>
            <form id="admin-import-job-form" class="admin-form">
              <input name="id" placeholder="идентификатор импорта, необязательно" />
              <input name="project_id" placeholder="идентификатор проекта" />
              <input name="source_ref" placeholder="источник данных" />
              <input name="format" placeholder="формат" />
              <button class="secondary-button" type="submit">Создать импорт</button>
              <div class="subtle">Доступно проектов: ${(importExportPlane.projects || []).length}</div>
            </form>
            <form id="admin-export-job-form" class="admin-form">
              <input name="id" placeholder="идентификатор выгрузки, необязательно" />
              <input name="project_id" placeholder="идентификатор проекта" />
              <input name="source_ref" placeholder="фильтр, необязательно" />
              <input name="format" placeholder="формат" />
              <button class="secondary-button" type="submit">Создать выгрузку</button>
              <div class="subtle">Выгрузка в текущем режиме сохраняет только метаданные.</div>
            </form>
            <div class="section-title">Импорт</div>
            <div class="stack-list">${importJobItems}</div>
            <div class="section-title">Выгрузка</div>
            <div class="stack-list">${exportJobItems}</div>
          `)}
        `;
      })()
    : "";

  return {
    summaryHtml,
    projectsHtml,
    assignmentsHtml,
    adminVisible,
    adminWorkspaceHtml,
    adminSupportHtml,
    adminSchemaHtml,
    adminQualityHtml,
    adminControlHtml,
  };
}

export function wireDashboardSelection(container, onSelect) {
  container.querySelectorAll("[data-assignment-id]").forEach((node) => {
    node.addEventListener("click", async () => {
      await onSelect(node.dataset.assignmentId);
    });
  });
}

export function renderHelpPane(items, selectedHelpId) {
  const nextSelectedHelpId = selectedHelpId && items.some((item) => item.id === selectedHelpId)
    ? selectedHelpId
    : items[0]?.id ?? null;

  const listHtml = items
    .map(
      (item) => `
        <button class="stack-item ${item.id === nextSelectedHelpId ? "selected" : ""}" data-help-id="${item.id}" type="button">
          <h5>${escapeHtml(item.title)}</h5>
          <div class="stack-meta">${item.tags.map((tag) => `<span class="meta-chip">${escapeHtml(tag)}</span>`).join("")}</div>
        </button>
      `,
    )
    .join("");

  const current = items.find((item) => item.id === nextSelectedHelpId);
  const articleHtml = current
    ? `<h4>${escapeHtml(cleanVisibleText(current.title, "Как выставлять оценки по критериям"))}</h4><p>${escapeHtml(cleanVisibleText(current.body, "Смотрите на каждый аспект отдельно. Точность отражает фактическую корректность, ясность — понятность и структуру, полнота — покрытие обязательных элементов ответа."))}</p>`
    : `<p class="subtle">Статья справки не выбрана.</p>`;

  return { nextSelectedHelpId, listHtml, articleHtml };
}

export function wireHelpSelection(container, onSelect) {
  container.querySelectorAll("[data-help-id]").forEach((node) => {
    node.addEventListener("click", () => {
      onSelect(node.dataset.helpId);
    });
  });
}

export function renderReviewerPanel(detail) {
  const workspace = detail.review_workspace || {};
  if (!workspace.can_review && !workspace.can_adjudicate) {
    return `
      <section class="note-block">
        <div class="panel-header">
          <div>
            <div class="panel-tag">Проверка</div>
            <h3>Рабочее место проверяющего</h3>
          </div>
        </div>
        <p class="subtle">Проверка недоступна для текущего статуса.</p>
      </section>
    `;
  }

  const checklistHtml = (workspace.reviewer_checklist || [])
    .map(
      (item) => `
        <div class="stack-item">
          <strong>${escapeHtml(item.label)}</strong>
          <div class="subtle">${item.done ? "готово" : "не хватает"}</div>
        </div>
      `,
    )
    .join("");
  const qaDrilldown = workspace.qa_drilldown || {};
  const overlap = qaDrilldown.overlap || {};
  const gold = qaDrilldown.gold || {};
  const disagreement = qaDrilldown.disagreement || {};
  const openCaseHtml = (workspace.open_case_navigation || []).length
    ? workspace.open_case_navigation
        .map(
          (item) => `
            <button class="stack-item" data-open-disagreement-case-id="${escapeHtml(item.id)}" type="button">
              <strong>${escapeHtml(item.label)}</strong>
              <div class="subtle">${escapeHtml(displayStatus(item.status || "open"))}</div>
            </button>
          `,
        )
        .join("")
    : `<div class="subtle">Открытых споров нет.</div>`;

  return `
    <section class="note-block">
      <div class="panel-header">
        <div>
          <div class="panel-tag">Проверка</div>
          <h3>Рабочее место проверяющего</h3>
        </div>
      </div>
      <div class="stack-meta">
        <span class="meta-chip">${escapeHtml(workspace.review_queue_label || "очередь проверки")}</span>
        <span class="meta-chip">отправка: ${escapeHtml(workspace.latest_submission_sequence || "-")}</span>
        <span class="meta-chip">проверяющий: ${escapeHtml(workspace.reviewer_id || "не назначен")}</span>
        ${detail.assignment_group ? `<span class="meta-chip">парные: ${escapeHtml(detail.peer_assignments.length)}</span>` : ""}
        ${detail.assignment?.qa_mode ? `<span class="meta-chip">режим: ${escapeHtml(displayMode(detail.assignment.qa_mode))}</span>` : ""}
        ${detail.gold_benchmark ? `<span class="meta-chip">эталон активен</span>` : ""}
      </div>
      <div class="stack-list">
        <div class="stack-item">
          <h4>Чек-лист проверки</h4>
          <div class="stack-list">${checklistHtml || `<div class="subtle">Чек-лист пуст.</div>`}</div>
        </div>
        <div class="stack-item">
          <h4>Детали проверки</h4>
          <div class="stack-meta">
            <span class="meta-chip">задание: текущая карточка</span>
            <span class="meta-chip">режим: ${escapeHtml(displayMode(qaDrilldown.mode))}</span>
            <span class="meta-chip">парные: ${escapeHtml(overlap.peer_count || 0)}</span>
            <span class="meta-chip">эталон: ${gold.active ? "активен" : "выключен"}</span>
            <span class="meta-chip">споры: ${escapeHtml(disagreement.open_count || 0)}</span>
          </div>
          <div class="subtle">
            группа ${overlap.assignment_group_id ? "назначена" : "-"} · эталон ${gold.benchmark_id ? "назначен" : "-"} · правило ${escapeHtml(displayMode(gold.scoring_policy))}
          </div>
        </div>
        <div class="stack-item">
          <h4>Открытые споры</h4>
          <div class="stack-list">${openCaseHtml}</div>
        </div>
      </div>
      <label>
        Комментарий проверяющего
        <textarea id="review-comment" rows="4" placeholder="Поясните принятие или возврат на доработку."></textarea>
      </label>
      ${
        workspace.can_adjudicate
          ? `
            <label>
              Закрытые проверки
              <input id="adjudication-review-ids" placeholder="идентификатор-проверки-1, идентификатор-проверки-2" />
            </label>
          `
          : ""
      }
    </section>
  `;
}

export function renderExecutionHistory(detail) {
  const workflow = detail.workflow || {};
  const schema = detail.task_schema || {};
  const taskInstance = detail.task_instance || {};
  const drafts = detail.draft_revisions || [];
  const submissions = detail.submission_history || [];
  const reviews = detail.review_passes || [];
  const disagreementCases = detail.disagreement_cases || [];
  const adjudicationPasses = detail.adjudication_passes || [];
  const qualitySignals = detail.quality_signals || [];
  const audits = detail.audit_events || [];

  return detailsBlock("История и служебные данные", `
    <section class="note-block">
      <div class="panel-header">
        <div>
          <div class="panel-tag">История</div>
          <h3>История выполнения</h3>
        </div>
      </div>
      <div class="stack-meta">
        <span class="meta-chip">схема: версия ${escapeHtml(schema.version || 1)}</span>
        <span class="meta-chip">задание: текущая карточка</span>
        <span class="meta-chip">черновики: ${workflow.draft_revision_count || 0}</span>
        <span class="meta-chip">отправки: ${workflow.submission_count || 0}</span>
        <span class="meta-chip">проверки: ${workflow.review_pass_count || 0}</span>
        <span class="meta-chip">споры: ${workflow.disagreement_case_count || 0}</span>
        <span class="meta-chip">решения: ${workflow.adjudication_pass_count || 0}</span>
        <span class="meta-chip">аудит: ${workflow.audit_event_count || 0}</span>
      </div>
      <div class="stack-list">
        <div class="stack-item">
          <h4>Снимки отправок</h4>
          ${
            submissions.length
              ? submissions
                  .map(
                    (item) => `
                      <div class="stack-item">
                        <strong>отправка ${item.sequence_no}</strong>
                        <div class="subtle">создано ${formatDate(item.created_at)} · хэш ${escapeHtml((item.payload_hash || "").slice(0, 10))}</div>
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="subtle">Снимков отправок пока нет.</div>`
          }
        </div>
        <div class="stack-item">
          <h4>Версии черновика</h4>
          ${
            drafts.length
              ? drafts
                  .map(
                    (item) => `
                      <div class="stack-item">
                        <strong>версия ${item.revision}</strong>
                        <div class="subtle">обновлено ${formatDate(item.updated_at)} · автор ${escapeHtml(item.editor_id)}</div>
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="subtle">История черновика пуста.</div>`
          }
        </div>
        <div class="stack-item">
          <h4>Проверки</h4>
          ${
            reviews.length
              ? reviews
                  .map(
                    (item) => `
                      <div class="stack-item">
                        <strong>${escapeHtml(displayStatus(item.outcome))} · проверка ${escapeHtml(item.sequence_no)}</strong>
                        <div class="subtle">${formatDate(item.created_at)} · проверяющий ${escapeHtml(item.reviewer_id)} · отправка ${escapeHtml(item.submission_sequence_no)}</div>
                        ${item.comment ? `<div class="subtle">${escapeHtml(item.comment)}</div>` : ""}
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="subtle">История проверок пуста.</div>`
          }
        </div>
        <div class="stack-item">
          <h4>Споры</h4>
          ${
            disagreementCases.length
              ? disagreementCases
                  .map(
                    (item) => `
                      <div class="stack-item">
                        <strong>${escapeHtml(displayStatus(item.status))}</strong>
                        <div class="subtle">${formatDate(item.created_at)} · причина ${escapeHtml(item.trigger_reason || "ручная")} · отправка ${escapeHtml(item.submission_sequence_no || "-")}</div>
                        <div class="subtle">проверки ${escapeHtml((item.review_pass_ids || []).join(", "))}</div>
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="subtle">Споров нет.</div>`
          }
        </div>
        <div class="stack-item">
          <h4>Решения по спорам</h4>
          ${
            adjudicationPasses.length
              ? adjudicationPasses
                  .map(
                    (item) => `
                      <div class="stack-item">
                        <strong>${escapeHtml(displayStatus(item.outcome))}</strong>
                        <div class="subtle">${formatDate(item.created_at)} · ответственный ${escapeHtml(item.adjudicator_id)}</div>
                        <div class="subtle">закрыто ${escapeHtml((item.resolved_review_pass_ids || []).join(", "))}</div>
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="subtle">Решений по спорам нет.</div>`
          }
        </div>
        <div class="stack-item">
          <h4>Сигналы качества</h4>
          ${
            qualitySignals.length
              ? qualitySignals
                  .map(
                    (item) => `
                      <div class="stack-item">
                        <strong>${escapeHtml(displaySignal(item.signal_type))}</strong>
                        <div class="subtle">${escapeHtml(displaySubjectType(item.subject_type))} · ${escapeHtml(Number(item.value).toFixed(2))}</div>
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="subtle">Сигналов качества нет.</div>`
          }
        </div>
        <div class="stack-item">
          <h4>Журнал аудита</h4>
          ${
            audits.length
              ? audits
                  .map(
                    (item) => `
                      <div class="stack-item">
                        <strong>${escapeHtml(item.event_type)}</strong>
                        <div class="subtle">${formatDate(item.occurred_at)} · исполнитель ${escapeHtml(item.actor_id)}</div>
                      </div>
                    `,
                  )
                  .join("")
              : `<div class="subtle">Журнал аудита пуст.</div>`
          }
        </div>
      </div>
    </section>
  `);
}

export function renderAgentLog(messages) {
  return messages
    .map(
      (item) => `
        <div class="agent-message ${item.role}">
          <strong>${item.role === "user" ? "Вы" : "Агент"}</strong>
          <div>${escapeHtml(item.text)}</div>
        </div>
      `,
    )
    .join("");
}
