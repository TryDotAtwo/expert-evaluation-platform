function getStorage(storage) {
  if (storage !== undefined) return storage;
  if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
  return null;
}

export function createPlatformStateStore({
  initialToken = null,
  initialAgentMessages = [],
  storage,
} = {}) {
  const tokenStorage = getStorage(storage);
  const state = {
    token: initialToken,
    session: null,
    dashboard: null,
    assignmentDetail: null,
    selectedAssignmentId: null,
    selectedHelpId: null,
    agentMessages: [...initialAgentMessages],
    saveTimer: null,
  };

  function persistToken(token) {
    if (!tokenStorage) return;
    if (token) {
      tokenStorage.setItem("platform_token", token);
      return;
    }
    tokenStorage.removeItem("platform_token");
  }

  return {
    state,
    clearWorkspaceState() {
      state.session = null;
      state.dashboard = null;
      state.assignmentDetail = null;
      state.selectedAssignmentId = null;
      state.selectedHelpId = null;
    },
    appendAgentMessage(role, text) {
      state.agentMessages.push({ role, text });
    },
    setAssignmentDetail(detail) {
      state.assignmentDetail = detail;
    },
    setDashboard(dashboard) {
      state.dashboard = dashboard;
    },
    setSaveTimer(timer) {
      state.saveTimer = timer;
    },
    clearSaveTimer() {
      if (state.saveTimer) clearTimeout(state.saveTimer);
      state.saveTimer = null;
    },
    setSelectedAssignmentId(assignmentId) {
      state.selectedAssignmentId = assignmentId;
    },
    setSelectedHelpId(helpId) {
      state.selectedHelpId = helpId;
    },
    setSession(user) {
      state.session = user;
    },
    setToken(token) {
      state.token = token;
      persistToken(token);
    },
    resetAuth() {
      this.setToken(null);
      this.clearWorkspaceState();
    },
  };
}
