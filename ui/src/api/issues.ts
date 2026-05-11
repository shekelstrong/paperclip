import type {
  AskUserQuestionsAnswer,
  Согласование,
  СоздатьЗадачаTreeHold,
  DocumentRevision,
  FeedbackЦельТип,
  FeedbackTrace,
  FeedbackVote,
  Задача,
  ЗадачаAttachment,
  ЗадачаCostSummary,
  ЗадачаComment,
  ЗадачаDocument,
  ЗадачаLabel,
  ЗадачаПовторитьСейчасResponse,
  ЗадачаThreadInteraction,
  ЗадачаTreeControlПредпросмотр,
  ЗадачаTreeHold,
  ЗадачаРаботаProduct,
  ПредпросмотрЗадачаTreeControl,
  ReleaseЗадачаTreeHold,
  UpsertЗадачаDocument,
} from "@paperclipai/shared";
import { api } from "./client";

export type ЗадачаОбновитьResponse = Задача & {
  comment?: ЗадачаComment | null;
};

export const issuesApi = {
  list: (
    companyId: string,
    filters?: {
      status?: string;
      projectId?: string;
      parentId?: string;
      assigneeАгентId?: string;
      participantАгентId?: string;
      assigneeUserId?: string;
      touchedByUserId?: string;
      inboxАрхивированByUserId?: string;
      unreadForUserId?: string;
      labelId?: string;
      workspaceId?: string;
      executionРабочая областьId?: string;
      originKind?: string;
      originKindPrefix?: string;
      originId?: string;
      descendantOf?: string;
      includeПроцедураExecutions?: boolean;
      includeЗаблокированBy?: boolean;
      q?: string;
      limit?: number;
      offset?: number;
    },
  ) => {
    const params = new URLПоискParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.projectId) params.set("projectId", filters.projectId);
    if (filters?.parentId) params.set("parentId", filters.parentId);
    if (filters?.assigneeАгентId) params.set("assigneeАгентId", filters.assigneeАгентId);
    if (filters?.participantАгентId) params.set("participantАгентId", filters.participantАгентId);
    if (filters?.assigneeUserId) params.set("assigneeUserId", filters.assigneeUserId);
    if (filters?.touchedByUserId) params.set("touchedByUserId", filters.touchedByUserId);
    if (filters?.inboxАрхивированByUserId) params.set("inboxАрхивированByUserId", filters.inboxАрхивированByUserId);
    if (filters?.unreadForUserId) params.set("unreadForUserId", filters.unreadForUserId);
    if (filters?.labelId) params.set("labelId", filters.labelId);
    if (filters?.workspaceId) params.set("workspaceId", filters.workspaceId);
    if (filters?.executionРабочая областьId) params.set("executionРабочая областьId", filters.executionРабочая областьId);
    if (filters?.originKind) params.set("originKind", filters.originKind);
    if (filters?.originKindPrefix) params.set("originKindPrefix", filters.originKindPrefix);
    if (filters?.originId) params.set("originId", filters.originId);
    if (filters?.descendantOf) params.set("descendantOf", filters.descendantOf);
    if (filters?.includeПроцедураExecutions) params.set("includeПроцедураExecutions", "true");
    if (filters?.includeЗаблокированBy) params.set("includeЗаблокированBy", "true");
    if (filters?.q) params.set("q", filters.q);
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.offset !== undefined) params.set("offset", String(filters.offset));
    const qs = params.toString();
    return api.get<Задача[]>(`/companies/${companyId}/issues${qs ? `?${qs}` : ""}`);
  },
  listЯрлыки: (companyId: string) => api.get<ЗадачаLabel[]>(`/companies/${companyId}/labels`),
  createLabel: (companyId: string, data: { name: string; color: string }) =>
    api.post<ЗадачаLabel>(`/companies/${companyId}/labels`, data),
  deleteLabel: (id: string) => api.delete<ЗадачаLabel>(`/labels/${id}`),
  get: (id: string) => api.get<Задача>(`/issues/${id}`),
  markRead: (id: string) => api.post<{ id: string; lastReadAt: Date }>(`/issues/${id}/read`, {}),
  markUnread: (id: string) => api.delete<{ id: string; removed: boolean }>(`/issues/${id}/read`),
  archiveFromВходящие: (id: string) =>
    api.post<{ id: string; archivedAt: Date }>(`/issues/${id}/inbox-archive`, {}),
  unarchiveFromВходящие: (id: string) =>
    api.delete<{ id: string; archivedAt: Date } | { ok: true }>(`/issues/${id}/inbox-archive`),
  create: (companyId: string, data: Record<string, unknown>) =>
    api.post<Задача>(`/companies/${companyId}/issues`, data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch<ЗадачаОбновитьResponse>(`/issues/${id}`, data),
  previewTreeControl: (id: string, data: ПредпросмотрЗадачаTreeControl) =>
    api.post<ЗадачаTreeControlПредпросмотр>(`/issues/${id}/tree-control/preview`, data),
  createTreeHold: (id: string, data: СоздатьЗадачаTreeHold) =>
    api.post<{ hold: ЗадачаTreeHold; preview: ЗадачаTreeControlПредпросмотр }>(`/issues/${id}/tree-holds`, data),
  getTreeHold: (id: string, holdId: string) =>
    api.get<ЗадачаTreeHold>(`/issues/${id}/tree-holds/${holdId}`),
  listTreeHolds: (
    id: string,
    filters?: {
      status?: "active" | "released";
      mode?: "pause" | "resume" | "cancel" | "restore";
      includeMembers?: boolean;
    },
  ) => {
    const params = new URLПоискParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.mode) params.set("mode", filters.mode);
    if (filters?.includeMembers) params.set("includeMembers", "true");
    const qs = params.toString();
    return api.get<ЗадачаTreeHold[]>(`/issues/${id}/tree-holds${qs ? `?${qs}` : ""}`);
  },
  getTreeControlState: (id: string) =>
    api.get<{
      activeПаузаHold: {
        holdId: string;
        rootЗадачаId: string;
        issueId: string;
        isRoot: boolean;
        mode: "pause";
        reason: string | null;
        releasePolicy: { strategy: "manual" | "after_active_runs_finish"; note?: string | null } | null;
      } | null;
    }>(`/issues/${id}/tree-control/state`),
  releaseTreeHold: (id: string, holdId: string, data: ReleaseЗадачаTreeHold) =>
    api.post<ЗадачаTreeHold>(`/issues/${id}/tree-holds/${holdId}/release`, data),
  checkMonitorСейчас: (id: string) => api.post<{ ok: true }>(`/issues/${id}/monitor/check-now`, {}),
  retryРасписаниеdПовторитьСейчас: (id: string) =>
    api.post<ЗадачаПовторитьСейчасResponse>(`/issues/${id}/scheduled-retry/retry-now`, {}),
  remove: (id: string) => api.delete<Задача>(`/issues/${id}`),
  checkout: (id: string, agentId: string) =>
    api.post<Задача>(`/issues/${id}/checkout`, {
      agentId,
      expectedСтатусes: ["todo", "backlog", "blocked", "in_review"],
    }),
  release: (id: string) => api.post<Задача>(`/issues/${id}/release`, {}),
  listКомментарии: (
    id: string,
    filters?: {
      after?: string;
      order?: "asc" | "desc";
      limit?: number;
    },
  ) => {
    const params = new URLПоискParams();
    if (filters?.after) params.set("after", filters.after);
    if (filters?.order) params.set("order", filters.order);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString();
    return api.get<ЗадачаComment[]>(`/issues/${id}/comments${qs ? `?${qs}` : ""}`);
  },
  listInteractions: (id: string) =>
    api.get<ЗадачаThreadInteraction[]>(`/issues/${id}/interactions`),
  createInteraction: (id: string, data: Record<string, unknown>) =>
    api.post<ЗадачаThreadInteraction>(`/issues/${id}/interactions`, data),
  acceptInteraction: (
    id: string,
    interactionId: string,
    data?: { selectedClientКлючs?: string[] },
  ) =>
    api.post<ЗадачаThreadInteraction>(`/issues/${id}/interactions/${interactionId}/accept`, data ?? {}),
  rejectInteraction: (id: string, interactionId: string, reason?: string) =>
    api.post<ЗадачаThreadInteraction>(`/issues/${id}/interactions/${interactionId}/reject`, reason ? { reason } : {}),
  cancelInteraction: (id: string, interactionId: string, reason?: string) =>
    api.post<ЗадачаThreadInteraction>(`/issues/${id}/interactions/${interactionId}/cancel`, reason ? { reason } : {}),
  respondToInteraction: (
    id: string,
    interactionId: string,
    data: { answers: AskUserQuestionsAnswer[]; summaryMarkdown?: string | null },
  ) =>
    api.post<ЗадачаThreadInteraction>(`/issues/${id}/interactions/${interactionId}/respond`, data),
  getComment: (id: string, commentId: string) =>
    api.get<ЗадачаComment>(`/issues/${id}/comments/${commentId}`),
  listFeedbackVotes: (id: string) => api.get<FeedbackVote[]>(`/issues/${id}/feedback-votes`),
  getCostSummary: (id: string, options: { excludeRoot?: boolean } = {}) => {
    const qs = options.excludeRoot ? "?excludeRoot=true" : "";
    return api.get<ЗадачаCostSummary>(`/issues/${id}/cost-summary${qs}`);
  },
  listFeedbackTraces: (id: string, filters?: Record<string, string | boolean | undefined>) => {
    const params = new URLПоискParams();
    for (const [key, value] of Object.entries(filters ?? {})) {
      if (value === undefined) continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    return api.get<FeedbackTrace[]>(`/issues/${id}/feedback-traces${qs ? `?${qs}` : ""}`);
  },
  upsertFeedbackVote: (
    id: string,
    data: {
      targetТип: FeedbackЦельТип;
      targetId: string;
      vote: "up" | "down";
      reason?: string;
      allowSharing?: boolean;
    },
  ) => api.post<FeedbackVote>(`/issues/${id}/feedback-votes`, data),
  addComment: (id: string, body: string, reopen?: boolean, interrupt?: boolean) =>
    api.post<ЗадачаComment>(
      `/issues/${id}/comments`,
      {
        body,
        ...(reopen === undefined ? {} : { reopen }),
        ...(interrupt === undefined ? {} : { interrupt }),
      },
    ),
  cancelComment: (id: string, commentId: string) =>
    api.delete<ЗадачаComment>(`/issues/${id}/comments/${commentId}`),
  listДокументы: (id: string, options?: { includeSystem?: boolean }) =>
    api.get<ЗадачаDocument[]>(
      `/issues/${id}/documents${options?.includeSystem ? "?includeSystem=true" : ""}`,
    ),
  getDocument: (id: string, key: string) => api.get<ЗадачаDocument>(`/issues/${id}/documents/${encodeURIComponent(key)}`),
  upsertDocument: (id: string, key: string, data: UpsertЗадачаDocument) =>
    api.put<ЗадачаDocument>(`/issues/${id}/documents/${encodeURIComponent(key)}`, data),
  listDocumentRevisions: (id: string, key: string) =>
    api.get<DocumentRevision[]>(`/issues/${id}/documents/${encodeURIComponent(key)}/revisions`),
  restoreDocumentRevision: (id: string, key: string, revisionId: string) =>
    api.post<ЗадачаDocument>(`/issues/${id}/documents/${encodeURIComponent(key)}/revisions/${revisionId}/restore`, {}),
  deleteDocument: (id: string, key: string) =>
    api.delete<{ ok: true }>(`/issues/${id}/documents/${encodeURIComponent(key)}`),
  listAttachments: (id: string) => api.get<ЗадачаAttachment[]>(`/issues/${id}/attachments`),
  uploadAttachment: (
    companyId: string,
    issueId: string,
    file: File,
    issueCommentId?: string | null,
  ) => {
    const form = new FormData();
    form.append("file", file);
    if (issueCommentId) {
      form.append("issueCommentId", issueCommentId);
    }
    return api.postForm<ЗадачаAttachment>(`/companies/${companyId}/issues/${issueId}/attachments`, form);
  },
  deleteAttachment: (id: string) => api.delete<{ ok: true }>(`/attachments/${id}`),
  listСогласования: (id: string) => api.get<Согласование[]>(`/issues/${id}/approvals`),
  linkСогласование: (id: string, approvalId: string) =>
    api.post<Согласование[]>(`/issues/${id}/approvals`, { approvalId }),
  unlinkСогласование: (id: string, approvalId: string) =>
    api.delete<{ ok: true }>(`/issues/${id}/approvals/${approvalId}`),
  listРаботаProducts: (id: string) => api.get<ЗадачаРаботаProduct[]>(`/issues/${id}/work-products`),
  createРаботаProduct: (id: string, data: Record<string, unknown>) =>
    api.post<ЗадачаРаботаProduct>(`/issues/${id}/work-products`, data),
  updateРаботаProduct: (id: string, data: Record<string, unknown>) =>
    api.patch<ЗадачаРаботаProduct>(`/work-products/${id}`, data),
  deleteРаботаProduct: (id: string) => api.delete<ЗадачаРаботаProduct>(`/work-products/${id}`),
};
