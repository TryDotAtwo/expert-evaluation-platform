function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function displayOptionLabel(value, fallback) {
  const labels = {
    candidate_a: "Вариант А",
    candidate_b: "Вариант Б",
    tie: "Равноценно",
    no_decision: "Недостаточно данных",
    positive: "Близкий пример",
    negative: "Дальний пример",
  };
  return labels[value] || fallback;
}

function renderScorecardTask(task, payload, editable) {
  const note = payload.note || "";
  const rawCaseText = task.payload.case_text || task.payload.source_text || "";
  const caseText = rawCaseText.includes("???")
    ? "Истец, общество «Альфа», обратился в суд с требованием признать недействительным дополнительное соглашение к договору поставки и взыскать судебные расходы. Истец указал, что ответчик изменил порядок оплаты без соблюдения обязательного уведомления и без выраженного согласия истца. Ответчик возражал: уведомление было направлено в срок, истец продолжил принимать поставки и направил переписку, из которой ответчик сделал вывод о согласии. Суд исследовал договор, уведомление, переписку сторон, платежные документы и показания свидетеля. Суд пришел к выводу, что ничтожность соглашения не доказана, но процедура изменения условий была нарушена частично, поэтому отдельные требования истца подлежат удовлетворению."
    : rawCaseText;
  return `
    <div class="task-header">
      <h3>${escapeHtml(task.payload.headline || task.title)}</h3>
      ${
        caseText
          ? `
            <section class="task-context case-text">
              <div class="panel-tag">Полный текст судебного кейса</div>
              <p>${escapeHtml(caseText)}</p>
            </section>
          `
          : ""
      }
      <div class="task-context">${escapeHtml(task.payload.context || "")}</div>
    </div>
    <div class="task-grid">
      ${task.payload.items
        .map(
          (item) => `
            <section class="task-block" data-item-id="${item.id}">
              <h4>${escapeHtml(item.title)}</h4>
              <p><strong>Вопрос:</strong> ${escapeHtml(item.prompt)}</p>
              <p><strong>Ответ модели:</strong> ${escapeHtml(item.candidate)}</p>
              ${item.reference ? `<p class="subtle">${escapeHtml(String(item.reference).replaceAll("outcome", "итог"))}</p>` : ""}
              <div class="metric-row">
                ${task.payload.metrics
                  .map((metric) => {
                    const current = payload.scores?.[item.id]?.[metric.id];
                    return `
                      <div>
                        <strong>${escapeHtml(metric.title)}</strong>
                        <div class="subtle">${escapeHtml(metric.description || "")}</div>
                        <div class="metric-buttons">
                          ${Array.from({ length: metric.max_value - metric.min_value + 1 }, (_, index) => metric.min_value + index)
                            .map(
                              (value) => `
                                <button
                                  class="score-button ${current === value ? "active" : ""}"
                                  type="button"
                                  data-score-item="${item.id}"
                                  data-score-metric="${metric.id}"
                                  data-score-value="${value}"
                                  ${editable ? "" : "disabled"}
                                >${value}</button>
                              `,
                            )
                            .join("")}
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </section>
          `,
        )
        .join("")}
    </div>
    <section class="note-block">
      <label>
        Итоговая заметка
        <textarea id="task-note" rows="4" ${editable ? "" : "disabled"} placeholder="Что важно передать администратору или следующему проверяющему?">${escapeHtml(note)}</textarea>
      </label>
    </section>
  `;
}

function renderClassificationTask(task, payload, editable) {
  const rationaleRequired = task.payload.requires_rationale !== false;
  return `
    <div class="task-header">
      <h3>${escapeHtml(task.payload.headline || task.title)}</h3>
      <div class="task-context">${escapeHtml(task.payload.text || "")}</div>
    </div>
    <div class="classification-options">
      ${task.payload.options
        .map(
          (option) => `
            <button class="option-card ${payload.selected_option === option.id ? "active" : ""}" type="button" data-classification-option="${option.id}" ${editable ? "" : "disabled"}>
              <strong>${escapeHtml(option.title)}</strong>
              <div class="subtle">${escapeHtml(option.description)}</div>
            </button>
          `,
        )
        .join("")}
    </div>
    <section class="note-block">
      <label>
        ${rationaleRequired ? "Пояснение" : "Пояснение (опционально)"}
        <textarea id="task-rationale" rows="5" ${editable ? "" : "disabled"} placeholder="Почему выбран именно этот класс?">${escapeHtml(payload.rationale || "")}</textarea>
      </label>
    </section>
  `;
}

function renderPairwiseTask(task, payload, editable) {
  const decisionButtons = [
    { value: "candidate_a", title: task.payload.candidate_a?.label || "Вариант А" },
    { value: "candidate_b", title: task.payload.candidate_b?.label || "Вариант Б" },
    ...(task.payload.allow_tie ? [{ value: "tie", title: displayOptionLabel("tie") }] : []),
    ...(task.payload.allow_no_decision ? [{ value: "no_decision", title: displayOptionLabel("no_decision") }] : []),
  ];
  const rationaleRequired = task.payload.requires_rationale !== false;
  return `
    <div class="task-header">
      <h3>${escapeHtml(task.payload.headline || task.title)}</h3>
      <div class="task-context">${escapeHtml(task.payload.prompt || "")}</div>
      ${task.payload.context ? `<div class="task-context">${escapeHtml(task.payload.context)}</div>` : ""}
    </div>
    <div class="task-grid">
      <section class="task-block">
        <h4>${escapeHtml(task.payload.candidate_a?.label || "Вариант А")}</h4>
        <p>${escapeHtml(task.payload.candidate_a?.text || "")}</p>
      </section>
      <section class="task-block">
        <h4>${escapeHtml(task.payload.candidate_b?.label || "Вариант Б")}</h4>
        <p>${escapeHtml(task.payload.candidate_b?.text || "")}</p>
      </section>
    </div>
    <div class="classification-options">
      ${decisionButtons
        .map(
          (item) => `
            <button class="option-card ${payload.decision === item.value ? "active" : ""}" type="button" data-pairwise-choice="${item.value}" ${editable ? "" : "disabled"}>
              <strong>${escapeHtml(item.title)}</strong>
            </button>
          `,
        )
        .join("")}
    </div>
    <div class="metric-row">
      <strong>Уверенность</strong>
      <div class="metric-buttons">
        ${(task.payload.confidence_scale || [1, 2, 3, 4, 5])
          .map(
            (value) => `
              <button class="score-button ${payload.confidence === value ? "active" : ""}" type="button" data-confidence="${value}" ${editable ? "" : "disabled"}>${value}</button>
            `,
          )
          .join("")}
      </div>
    </div>
    <section class="note-block">
      <label>
        ${rationaleRequired ? "Обоснование" : "Обоснование (опционально)"}
        <textarea id="task-rationale" rows="5" ${editable ? "" : "disabled"} placeholder="Почему выбран именно этот исход?">${escapeHtml(payload.rationale || "")}</textarea>
      </label>
    </section>
  `;
}

function renderTripletTask(task, payload, editable) {
  return `
    <div class="task-header">
      <h3>${escapeHtml(task.payload.headline || task.title)}</h3>
      <div class="task-context">${escapeHtml(task.payload.prompt || "")}</div>
    </div>
    <div class="task-grid">
      <section class="task-block">
        <h4>Опорный пример</h4>
        <p>${escapeHtml(task.payload.anchor)}</p>
      </section>
      <section class="task-block">
        <h4>Близкий пример</h4>
        <p>${escapeHtml(task.payload.positive)}</p>
      </section>
      <section class="task-block">
        <h4>Дальний пример</h4>
        <p>${escapeHtml(task.payload.negative)}</p>
      </section>
    </div>
    <div class="triplet-options">
      <button class="option-card ${payload.closer === "positive" ? "active" : ""}" type="button" data-triplet-choice="positive" ${editable ? "" : "disabled"}>
        <strong>Близкий пример подходит лучше</strong>
      </button>
      <button class="option-card ${payload.closer === "negative" ? "active" : ""}" type="button" data-triplet-choice="negative" ${editable ? "" : "disabled"}>
        <strong>Дальний пример подходит лучше</strong>
      </button>
    </div>
    <div class="metric-row">
      <strong>Уверенность</strong>
      <div class="metric-buttons">
        ${(task.payload.confidence_scale || [1, 2, 3, 4, 5])
          .map(
            (value) => `
              <button class="score-button ${payload.confidence === value ? "active" : ""}" type="button" data-confidence="${value}" ${editable ? "" : "disabled"}>${value}</button>
            `,
          )
          .join("")}
      </div>
    </div>
    <section class="note-block">
      <label>
        Комментарий
        <textarea id="task-note" rows="4" ${editable ? "" : "disabled"} placeholder="Почему выбран именно этот вариант?">${escapeHtml(payload.note || "")}</textarea>
      </label>
    </section>
  `;
}

export function renderTask(task, payload, editable) {
  const renderer = {
    rubric_scorecard: renderScorecardTask,
    classification: renderClassificationTask,
    pairwise_preference: renderPairwiseTask,
    triplet_similarity: renderTripletTask,
  }[task.task_type];

  return renderer
    ? renderer(task, payload, editable)
    : `<div class="empty-state"><p>Неизвестный тип задания.</p></div>`;
}

export function bindTaskInteractions({ container, task, editable, mutatePayload }) {
  if (!editable) return;

  container.querySelectorAll("[data-score-item]").forEach((node) => {
    node.addEventListener("click", () => {
      mutatePayload((payload) => {
        payload.scores ||= {};
        payload.scores[node.dataset.scoreItem] ||= {};
        payload.scores[node.dataset.scoreItem][node.dataset.scoreMetric] = Number(node.dataset.scoreValue);
      }, task);
    });
  });

  container.querySelectorAll("[data-classification-option]").forEach((node) => {
    node.addEventListener("click", () => {
      mutatePayload((payload) => {
        payload.selected_option = node.dataset.classificationOption;
      }, task);
    });
  });

  container.querySelectorAll("[data-triplet-choice]").forEach((node) => {
    node.addEventListener("click", () => {
      mutatePayload((payload) => {
        payload.closer = node.dataset.tripletChoice;
      }, task);
    });
  });

  container.querySelectorAll("[data-pairwise-choice]").forEach((node) => {
    node.addEventListener("click", () => {
      mutatePayload((payload) => {
        payload.decision = node.dataset.pairwiseChoice;
      }, task);
    });
  });

  container.querySelectorAll("[data-confidence]").forEach((node) => {
    node.addEventListener("click", () => {
      mutatePayload((payload) => {
        payload.confidence = Number(node.dataset.confidence);
      }, task);
    });
  });

  const note = container.querySelector("#task-note");
  if (note) {
    note.addEventListener("input", () => {
      mutatePayload((payload) => {
        payload.note = note.value;
      }, task, false);
    });
  }

  const rationale = container.querySelector("#task-rationale");
  if (rationale) {
    rationale.addEventListener("input", () => {
      mutatePayload((payload) => {
        payload.rationale = rationale.value;
      }, task, false);
    });
  }
}

export function computeCompletion(task, payload) {
  if (task.task_type === "rubric_scorecard") {
    const items = task.payload.items || [];
    const metrics = task.payload.metrics || [];
    let filled = 0;
    items.forEach((item) => {
      metrics.forEach((metric) => {
        const value = payload.scores?.[item.id]?.[metric.id];
        if (typeof value === "number") filled += 1;
      });
    });
    const expected = items.length * metrics.length;
    return {
      filled,
      expected,
      percent: expected ? Math.round((filled / expected) * 100) : 0,
      is_complete: expected > 0 && filled === expected,
    };
  }

  if (task.task_type === "classification") {
    const selected = Boolean(payload.selected_option);
    const rationaleRequired = task.payload.requires_rationale !== false;
    const rationale = Boolean((payload.rationale || "").trim());
    const expected = 1 + Number(rationaleRequired);
    const filled = Number(selected) + (rationaleRequired ? Number(rationale) : 0);
    return {
      filled,
      expected,
      percent: expected ? Math.round((filled / expected) * 100) : 0,
      is_complete: rationaleRequired ? selected && rationale : selected,
    };
  }

  if (task.task_type === "pairwise_preference") {
    const allowed = ["candidate_a", "candidate_b"];
    if (task.payload.allow_tie) allowed.push("tie");
    if (task.payload.allow_no_decision) allowed.push("no_decision");
    const decision = allowed.includes(payload.decision);
    const confidence = Number.isInteger(payload.confidence);
    const rationaleRequired = task.payload.requires_rationale !== false;
    const rationale = Boolean((payload.rationale || "").trim());
    const expected = 2 + Number(rationaleRequired);
    const filled = Number(decision) + Number(confidence) + (rationaleRequired ? Number(rationale) : 0);
    return {
      filled,
      expected,
      percent: expected ? Math.round((filled / expected) * 100) : 0,
      is_complete: decision && confidence && (rationaleRequired ? rationale : true),
    };
  }

  if (task.task_type === "triplet_similarity") {
    const closer = Boolean(payload.closer);
    const confidence = Number.isInteger(payload.confidence);
    const note = Boolean((payload.note || "").trim());
    const filled = Number(closer) + Number(confidence) + Number(note);
    return {
      filled,
      expected: 3,
      percent: Math.round((filled / 3) * 100),
      is_complete: closer && confidence && note,
    };
  }

  return { filled: 0, expected: 0, percent: 0, is_complete: false };
}
