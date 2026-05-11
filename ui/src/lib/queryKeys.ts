export const queryКлючs = {
  companies: {
    all: ["companies"] as const,
    detail: (id: string) => ["companies", id] as const,
    stats: ["companies", "stats"] as const,
  },
  companyНавыки: {
    list: (companyId: string) => ["company-skills", companyId] as const,
    detail: (companyId: string, skillId: string) => ["company-skills", companyId, skillId] as const,
    updateСтатус: (companyId: string, skillId: string) =>
      ["company-skills", companyId, skillId, "update-status"] as const,
    file: (companyId: string, skillId: string, relativeПуть: string) =>
      ["company-skills", companyId, skillId, "file", relativeПуть] as const,
  },
  agents: {
    list: (companyId: string) => ["agents", companyId] as const,
    detail: (id: string) => ["agents", "detail", id] as const,
    runtimeState: (id: string) => ["agents", "runtime-state", id] as const,
    taskSessions: (id: string) => ["agents", "task-sessions", id] as const,
    skills: (id: string) => ["agents", "skills", id] as const,
    instructionsBundle: (id: string) => ["agents", "instructions-bundle", id] as const,
    instructionsFile: (id: string, relativeПуть: string) =>
      ["agents", "instructions-bundle", id, "file", relativeПуть] as const,
    keys: (agentId: string) => ["agents", "keys", agentId] as const,
    configRevisions: (agentId: string) => ["agents", "config-revisions", agentId] as const,
    adapterМодельs: (companyId: string, adapterТип: string, environmentId?: string | null) =>
      ["agents", companyId, "adapter-models", adapterТип, environmentId ?? null] as const,
    adapterМодельПрофильs: (companyId: string, adapterТип: string) =>
      ["agents", companyId, "adapter-model-profiles", adapterТип] as const,
    detectМодель: (companyId: string, adapterТип: string) =>
      ["agents", companyId, "detect-model", adapterТип] as const,
  },
  issues: {
    list: (companyId: string) => ["issues", companyId] as const,
    search: (companyId: string, q: string, projectId?: string, limit?: number) =>
      ["issues", companyId, "search", q, projectId ?? "__all-projects__", limit ?? "__no-limit__"] as const,
    listAssignedToMe: (companyId: string) => ["issues", companyId, "assigned-to-me"] as const,
    listMineByMe: (companyId: string) => ["issues", companyId, "mine-by-me"] as const,
    listTouchedByMe: (companyId: string) => ["issues", companyId, "touched-by-me"] as const,
    listUnreadTouchedByMe: (companyId: string) => ["issues", companyId, "unread-touched-by-me"] as const,
    labels: (companyId: string) => ["issues", companyId, "labels"] as const,
    listByProject: (companyId: string, projectId: string) =>
      ["issues", companyId, "project", projectId] as const,
    listPluginOperationsByProject: (companyId: string, projectId: string, originKindPrefix: string) =>
      ["issues", companyId, "project", projectId, "plugin-operations", originKindPrefix] as const,
    listByРодитель: (companyId: string, parentId: string) =>
      ["issues", companyId, "parent", parentId] as const,
    listByDescendantRoot: (companyId: string, rootЗадачаId: string) =>
      ["issues", companyId, "descendants", rootЗадачаId] as const,
    listByExecutionРабочая область: (companyId: string, executionРабочая областьId: string) =>
      ["issues", companyId, "execution-workspace", executionРабочая областьId] as const,
    detail: (id: string) => ["issues", "detail", id] as const,
    comments: (issueId: string) => ["issues", "comments", issueId] as const,
    interactions: (issueId: string) => ["issues", "interactions", issueId] as const,
    feedbackVotes: (issueId: string) => ["issues", "feedback-votes", issueId] as const,
    costSummary: (issueId: string, options: { excludeRoot?: boolean } = {}) =>
      options.excludeRoot
        ? (["issues", "cost-summary", issueId, "exclude-root"] as const)
        : (["issues", "cost-summary", issueId] as const),
    attachments: (issueId: string) => ["issues", "attachments", issueId] as const,
    documents: (issueId: string) => ["issues", "documents", issueId] as const,
    document: (issueId: string, key: string) => ["issues", "document", issueId, key] as const,
    documentRevisions: (issueId: string, key: string) => ["issues", "document-revisions", issueId, key] as const,
    activity: (issueId: string) => ["issues", "activity", issueId] as const,
    runs: (issueId: string) => ["issues", "runs", issueId] as const,
    approvals: (issueId: string) => ["issues", "approvals", issueId] as const,
    liveЗапуститьs: (issueId: string) => ["issues", "live-runs", issueId] as const,
    activeЗапустить: (issueId: string) => ["issues", "active-run", issueId] as const,
    workProducts: (issueId: string) => ["issues", "work-products", issueId] as const,
  },
  routines: {
    list: (companyId: string, filters?: { projectId?: string | null }) =>
      ["routines", companyId, filters?.projectId ?? "__all-projects__"] as const,
    detail: (id: string) => ["routines", "detail", id] as const,
    runs: (id: string) => ["routines", "runs", id] as const,
    revisions: (id: string) => ["routines", "revisions", id] as const,
    activity: (companyId: string, id: string) => ["routines", "activity", companyId, id] as const,
  },
  executionРабочие области: {
    list: (companyId: string, filters?: Record<string, string | boolean | undefined>) =>
      ["execution-workspaces", companyId, filters ?? {}] as const,
    summaryList: (companyId: string, filters?: Record<string, string | boolean | undefined>) =>
      ["execution-workspaces", companyId, "summary", filters ?? {}] as const,
    detail: (id: string) => ["execution-workspaces", "detail", id] as const,
    closeReadiness: (id: string) => ["execution-workspaces", "close-readiness", id] as const,
    workspaceOperations: (id: string) => ["execution-workspaces", "workspace-operations", id] as const,
  },
  environments: {
    list: (companyId: string) => ["environments", companyId] as const,
  },
  projects: {
    list: (companyId: string) => ["projects", companyId] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
  },
  goals: {
    list: (companyId: string) => ["goals", companyId] as const,
    detail: (id: string) => ["goals", "detail", id] as const,
  },
  budgets: {
    overview: (companyId: string) => ["budgets", "overview", companyId] as const,
  },
  approvals: {
    list: (companyId: string, status?: string) =>
      ["approvals", companyId, status] as const,
    detail: (approvalId: string) => ["approvals", "detail", approvalId] as const,
    comments: (approvalId: string) => ["approvals", "comments", approvalId] as const,
    issues: (approvalId: string) => ["approvals", "issues", approvalId] as const,
  },
  access: {
    invites: (companyId: string, state: string = "all", limit: number = 20) =>
      ["access", "invites", "paginated-v1", companyId, state, limit] as const,
    joinRequests: (companyId: string, status: string = "pending_approval") =>
      ["access", "join-requests", companyId, status] as const,
    companyMembers: (companyId: string) => ["access", "company-members", companyId] as const,
    companyUserDirectory: (companyId: string) => ["access", "company-user-directory", companyId] as const,
    adminUsers: (query: string) => ["access", "admin-users", query] as const,
    userКомпанияДоступ: (userId: string) => ["access", "user-company-access", userId] as const,
    invite: (token: string) => ["access", "invite", token] as const,
    currentСоветДоступ: ["access", "current-board-access"] as const,
  },
  auth: {
    session: ["auth", "session"] as const,
  },
  sidebarPreferences: {
    companyOrder: (userId: string) => ["sidebar-preferences", "company-order", userId] as const,
    projectOrder: (companyId: string, userId: string) =>
      ["sidebar-preferences", "project-order", companyId, userId] as const,
  },
  instance: {
    generalНастройки: ["instance", "general-settings"] as const,
    schedulerHeartbeats: ["instance", "scheduler-heartbeats"] as const,
    experimentalНастройки: ["instance", "experimental-settings"] as const,
  },
  health: ["health"] as const,
  secrets: {
    list: (companyId: string) => ["secrets", companyId] as const,
    providers: (companyId: string) => ["secret-providers", companyId] as const,
    providerConfigs: (companyId: string) => ["secret-provider-configs", companyId] as const,
    usage: (secretId: string) => ["secrets", "usage", secretId] as const,
    accessEvents: (secretId: string) => ["secrets", "access-events", secretId] as const,
  },
  companyПоиск: {
    search: (companyId: string, q: string, scope: string, limit: number, offset: number) =>
      ["company-search", companyId, q, scope, limit, offset] as const,
  },
  dashboard: (companyId: string) => ["dashboard", companyId] as const,
  userПрофиль: (companyId: string, userSlug: string) =>
    ["user-profile", companyId, userSlug] as const,
  sidebarBadges: (companyId: string) => ["sidebar-badges", companyId] as const,
  inboxЗакрытьals: (companyId: string) => ["inbox-dismissals", companyId] as const,
  activity: (companyId: string) => ["activity", companyId] as const,
  costs: (companyId: string, from?: string, to?: string) =>
    ["costs", companyId, from, to] as const,
  usageByПровайдер: (companyId: string, from?: string, to?: string) =>
    ["usage-by-provider", companyId, from, to] as const,
  usageByBiller: (companyId: string, from?: string, to?: string) =>
    ["usage-by-biller", companyId, from, to] as const,
  financeSummary: (companyId: string, from?: string, to?: string) =>
    ["finance-summary", companyId, from, to] as const,
  financeByBiller: (companyId: string, from?: string, to?: string) =>
    ["finance-by-biller", companyId, from, to] as const,
  financeByKind: (companyId: string, from?: string, to?: string) =>
    ["finance-by-kind", companyId, from, to] as const,
  financeEvents: (companyId: string, from?: string, to?: string, limit: number = 100) =>
    ["finance-events", companyId, from, to, limit] as const,
  usageWindowSpend: (companyId: string) =>
    ["usage-window-spend", companyId] as const,
  usageQuotaWindows: (companyId: string) =>
    ["usage-quota-windows", companyId] as const,
  heartbeats: (companyId: string, agentId?: string) =>
    ["heartbeats", companyId, agentId] as const,
  runDetail: (runId: string) => ["heartbeat-run", runId] as const,
  runРабочая областьOperations: (runId: string) => ["heartbeat-run", runId, "workspace-operations"] as const,
  liveЗапуститьs: (companyId: string) => ["live-runs", companyId] as const,
  runЗадачи: (runId: string) => ["run-issues", runId] as const,
  org: (companyId: string) => ["org", companyId] as const,
  skills: {
    available: ["skills", "available"] as const,
  },
  plugins: {
    all: ["plugins"] as const,
    examples: ["plugins", "examples"] as const,
    detail: (pluginId: string) => ["plugins", pluginId] as const,
    health: (pluginId: string) => ["plugins", pluginId, "health"] as const,
    uiContributions: ["plugins", "ui-contributions"] as const,
    config: (pluginId: string) => ["plugins", pluginId, "config"] as const,
    localПапкаs: (pluginId: string, companyId: string) =>
      ["plugins", pluginId, "companies", companyId, "local-folders"] as const,
    dashboard: (pluginId: string) => ["plugins", pluginId, "dashboard"] as const,
    logs: (pluginId: string) => ["plugins", pluginId, "logs"] as const,
  },
  adapters: {
    all: ["adapters"] as const,
  },
};
