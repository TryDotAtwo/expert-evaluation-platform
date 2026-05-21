function clone(value) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function localDraftKey(assignmentId) {
  return `platform_draft_${assignmentId}`;
}

export function adoptLocalDraft(detail, computeCompletion) {
  const key = localDraftKey(detail.assignment.id);
  const cached = localStorage.getItem(key);
  if (!cached) return detail;
  try {
    const parsed = JSON.parse(cached);
    if ((parsed.revision ?? -1) >= detail.assignment.revision && detail.assignment.status !== "submitted") {
      detail.assignment.draft = parsed.payload;
      detail.assignment.completion = computeCompletion(detail.task_view || detail.task, parsed.payload);
    }
  } catch {
    return detail;
  }
  return detail;
}

export function getCurrentPayload(assignmentDetail) {
  if (!assignmentDetail) return {};
  return clone(
    assignmentDetail.assignment.submitted_payload ||
      assignmentDetail.assignment.draft ||
      {},
  );
}

export function cacheLocalDraft(assignmentId, payload, revision) {
  localStorage.setItem(localDraftKey(assignmentId), JSON.stringify({ payload, revision }));
}

export function clearLocalDraft(assignmentId) {
  localStorage.removeItem(localDraftKey(assignmentId));
}
