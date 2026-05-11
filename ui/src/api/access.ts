import type { АгентАдаптерТип, JoinRequest, PermissionКлюч } from "@paperclipai/shared";
import { api } from "./client";

export type ЧеловекКомпанияRole = "owner" | "admin" | "operator" | "viewer";

type InviteSummary = {
  id: string;
  companyId: string | null;
  companyИмя?: string | null;
  companyLogoUrl?: string | null;
  companyBrandColor?: string | null;
  inviteТип: "company_join" | "bootstrap_ceo";
  allowedJoinТипs: "human" | "agent" | "both";
  humanRole?: ЧеловекКомпанияRole | null;
  expiresAt: string;
  onboardingПуть?: string;
  onboardingUrl?: string;
  onboardingTextПуть?: string;
  onboardingTextUrl?: string;
  skillIndexПуть?: string;
  skillIndexUrl?: string;
  inviteMessage?: string | null;
  invitedByUserИмя?: string | null;
  joinRequestСтатус?: JoinRequest["status"] | null;
  joinRequestТип?: JoinRequest["requestТип"] | null;
};

type ПринятьInviteInput =
  | { requestТип: "human" }
  | {
    requestТип: "agent";
    agentИмя: string;
    adapterТип?: АгентАдаптерТип;
    capabilities?: string | null;
    agentПо умолчаниюsPayload?: Record<string, unknown> | null;
  };

type АгентJoinRequestПринятьed = JoinRequest & {
  claimСекрет: string;
  claimApiКлючПуть: string;
  onboarding?: Record<string, unknown>;
  diagnostics?: Array<{
    code: string;
    level: "info" | "warn";
    message: string;
    hint?: string;
  }>;
};

type InviteOnboardingManifest = {
  invite: InviteSummary;
  onboarding: {
    inviteMessage?: string | null;
    connectivity?: {
      guidance?: string;
      connectionCandidates?: string[];
      testResolutionEndpoint?: {
        method?: string;
        path?: string;
        url?: string;
      };
    };
    textInstructions?: {
      url?: string;
    };
  };
};

type СоветClaimСтатус = {
  status: "available" | "claimed" | "expired";
  requiresSignIn: boolean;
  expiresAt: string | null;
  claimedByUserId: string | null;
};

type CliAuthChallengeСтатус = {
  id: string;
  status: "pending" | "approved" | "cancelled" | "expired";
  command: string;
  clientИмя: string | null;
  requestedДоступ: "board" | "instance_admin_required";
  requestedКомпанияId: string | null;
  requestedКомпанияИмя: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  expiresAt: string;
  approvedByUser: { id: string; name: string; email: string } | null;
  requiresSignIn: boolean;
  canОдобрить: boolean;
  currentUserId: string | null;
};

type КомпанияInviteСоздано = {
  id: string;
  token: string;
  inviteUrl: string;
  expiresAt: string;
  allowedJoinТипs: "human" | "agent" | "both";
  humanRole?: ЧеловекКомпанияRole | null;
  companyИмя?: string | null;
  onboardingTextПуть?: string;
  onboardingTextUrl?: string;
  inviteMessage?: string | null;
};

export type КомпанияMemberGrant = {
  id: string;
  companyId: string;
  principalТип: "user";
  principalId: string;
  permissionКлюч: PermissionКлюч;
  scope: Record<string, unknown> | null;
  grantedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type КомпанияMember = {
  id: string;
  companyId: string;
  principalТип: "user";
  principalId: string;
  status: "pending" | "active" | "suspended" | "archived";
  membershipRole: ЧеловекКомпанияRole | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string | null; name: string | null; image: string | null } | null;
  grants: КомпанияMemberGrant[];
  removal?: {
    canАрхивировать: boolean;
    reason: string | null;
  };
};

export type АрхивироватьКомпанияMemberResponse = {
  member: КомпанияMember;
  reassignedЗадачаCount: number;
};

export type КомпанияMembersResponse = {
  members: КомпанияMember[];
  access: {
    currentUserRole: ЧеловекКомпанияRole | null;
    canManageMembers: boolean;
    canInviteUsers: boolean;
    canОдобритьJoinRequests: boolean;
  };
};

export type КомпанияUserDirectoryEntry = {
  principalId: string;
  status: "active";
  user: { id: string; email: string | null; name: string | null; image: string | null } | null;
};

export type КомпанияUserDirectoryResponse = {
  users: КомпанияUserDirectoryEntry[];
};

export type КомпанияInviteRecord = {
  id: string;
  companyId: string | null;
  companyИмя: string | null;
  inviteТип: "company_join" | "bootstrap_ceo";
  allowedJoinТипs: "human" | "agent" | "both";
  humanRole: ЧеловекКомпанияRole | null;
  defaultsPayload: Record<string, unknown> | null;
  expiresAt: string;
  invitedByUserId: string | null;
  revokedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  inviteMessage: string | null;
  state: "active" | "revoked" | "accepted" | "expired";
  invitedByUser: { id: string; email: string | null; name: string | null; image: string | null } | null;
  relatedJoinRequestId: string | null;
};

export type КомпанияInviteListResponse = {
  invites: КомпанияInviteRecord[];
  nextOffset: number | null;
};

export type КомпанияJoinRequest = JoinRequest & {
  requesterUser: { id: string; email: string | null; name: string | null; image: string | null } | null;
  approvedByUser: { id: string; email: string | null; name: string | null; image: string | null } | null;
  rejectedByUser: { id: string; email: string | null; name: string | null; image: string | null } | null;
  invite: {
    id: string;
    inviteТип: "company_join" | "bootstrap_ceo";
    allowedJoinТипs: "human" | "agent" | "both";
    humanRole: ЧеловекКомпанияRole | null;
    inviteMessage: string | null;
    createdAt: string;
    expiresAt: string;
    revokedAt: string | null;
    acceptedAt: string | null;
    invitedByUser: { id: string; email: string | null; name: string | null; image: string | null } | null;
  } | null;
};

export type AdminUserDirectoryEntry = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  isInstanceAdmin: boolean;
  activeКомпанияMembershipCount: number;
};

export type UserКомпанияДоступEntry = {
  id: string;
  companyId: string;
  principalТип: "user";
  principalId: string;
  status: "pending" | "active" | "suspended" | "archived";
  membershipRole: ЧеловекКомпанияRole | "member" | null;
  createdAt: string;
  updatedAt: string;
  companyИмя: string | null;
  companyСтатус: "active" | "paused" | "archived" | null;
};

export type UserКомпанияДоступResponse = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    isInstanceAdmin: boolean;
  } | null;
  companyДоступ: UserКомпанияДоступEntry[];
};

export type CurrentСоветДоступ = {
  user: { id: string; email: string | null; name: string | null; image: string | null } | null;
  userId: string;
  isInstanceAdmin: boolean;
  companyIds: string[];
  memberships?: Array<{
    companyId: string;
    membershipRole: ЧеловекКомпанияRole | "member" | null;
    status: "pending" | "active" | "suspended" | "archived";
  }>;
  source: string;
  keyId: string | null;
};

function buildInviteListQuery(options: {
  state?: "active" | "revoked" | "accepted" | "expired";
  limit?: number;
  offset?: number;
}) {
  const params = new URLПоискParams();
  if (options.state) params.set("state", options.state);
  if (options.limit) params.set("limit", String(options.limit));
  if (options.offset) params.set("offset", String(options.offset));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const accessApi = {
  createКомпанияInvite: (
    companyId: string,
    input: {
      allowedJoinТипs?: "human" | "agent" | "both";
      humanRole?: ЧеловекКомпанияRole | null;
      defaultsPayload?: Record<string, unknown> | null;
      agentMessage?: string | null;
    } = {},
  ) =>
    api.post<КомпанияInviteСоздано>(`/companies/${companyId}/invites`, input),

  createOpenClawInvitePrompt: (
    companyId: string,
    input: {
      agentMessage?: string | null;
    } = {},
  ) =>
    api.post<КомпанияInviteСоздано>(
      `/companies/${companyId}/openclaw/invite-prompt`,
      input,
    ),

  getInvite: (token: string) => api.get<InviteSummary>(`/invites/${token}`),
  getInviteOnboarding: (token: string) =>
    api.get<InviteOnboardingManifest>(`/invites/${token}/onboarding`),

  acceptInvite: (token: string, input: ПринятьInviteInput) =>
    api.post<АгентJoinRequestПринятьed | JoinRequest | { bootstrapПринятьed: true; userId: string }>(
      `/invites/${token}/accept`,
      input,
    ),

  listInvites: (
    companyId: string,
    options: {
      state?: "active" | "revoked" | "accepted" | "expired";
      limit?: number;
      offset?: number;
    } = {},
  ) =>
    api.get<КомпанияInviteListResponse>(
      `/companies/${companyId}/invites${buildInviteListQuery(options)}`,
    ),

  revokeInvite: (inviteId: string) => api.post(`/invites/${inviteId}/revoke`, {}),

  listJoinRequests: (
    companyId: string,
    status: "pending_approval" | "approved" | "rejected" = "pending_approval",
    requestТип?: "human" | "agent",
  ) =>
    api.get<КомпанияJoinRequest[]>(
      `/companies/${companyId}/join-requests?status=${status}${requestТип ? `&requestТип=${requestТип}` : ""}`,
    ),

  listMembers: (companyId: string) =>
    api.get<КомпанияMembersResponse>(`/companies/${companyId}/members`),

  listUserDirectory: (companyId: string) =>
    api.get<КомпанияUserDirectoryResponse>(`/companies/${companyId}/user-directory`),

  updateMember: (
    companyId: string,
    memberId: string,
    input: {
      membershipRole?: ЧеловекКомпанияRole | null;
      status?: "pending" | "active" | "suspended";
    },
  ) => api.patch<КомпанияMember>(`/companies/${companyId}/members/${memberId}`, input),

  updateMemberPermissions: (
    companyId: string,
    memberId: string,
    input: {
      grants: Array<{
        permissionКлюч: PermissionКлюч;
        scope?: Record<string, unknown> | null;
      }>;
    },
  ) => api.patch<КомпанияMember>(`/companies/${companyId}/members/${memberId}/permissions`, input),

  updateMemberДоступ: (
    companyId: string,
    memberId: string,
    input: {
      membershipRole?: ЧеловекКомпанияRole | null;
      status?: "pending" | "active" | "suspended";
      grants: Array<{
        permissionКлюч: PermissionКлюч;
        scope?: Record<string, unknown> | null;
      }>;
    },
  ) => api.patch<КомпанияMember>(`/companies/${companyId}/members/${memberId}/role-and-grants`, input),

  archiveMember: (
    companyId: string,
    memberId: string,
    input: {
      reassignment?: {
        assigneeАгентId?: string | null;
        assigneeUserId?: string | null;
      } | null;
    } = {},
  ) => api.post<АрхивироватьКомпанияMemberResponse>(`/companies/${companyId}/members/${memberId}/archive`, input),

  approveJoinRequest: (companyId: string, requestId: string) =>
    api.post<JoinRequest>(`/companies/${companyId}/join-requests/${requestId}/approve`, {}),

  rejectJoinRequest: (companyId: string, requestId: string) =>
    api.post<JoinRequest>(`/companies/${companyId}/join-requests/${requestId}/reject`, {}),

  claimJoinRequestApiКлюч: (requestId: string, claimСекрет: string) =>
    api.post<{ keyId: string; token: string; agentId: string; createdAt: string }>(
      `/join-requests/${requestId}/claim-api-key`,
      { claimСекрет },
    ),

  getСоветClaimСтатус: (token: string, code: string) =>
    api.get<СоветClaimСтатус>(`/board-claim/${token}?code=${encodeURIComponent(code)}`),

  claimСовет: (token: string, code: string) =>
    api.post<{ claimed: true; userId: string }>(`/board-claim/${token}/claim`, { code }),

  getCliAuthChallenge: (id: string, token: string) =>
    api.get<CliAuthChallengeСтатус>(`/cli-auth/challenges/${id}?token=${encodeURIComponent(token)}`),

  approveCliAuthChallenge: (id: string, token: string) =>
    api.post<{ approved: boolean; status: string; userId: string; keyId: string | null; expiresAt: string }>(
      `/cli-auth/challenges/${id}/approve`,
      { token },
    ),

  cancelCliAuthChallenge: (id: string, token: string) =>
    api.post<{ cancelled: boolean; status: string }>(`/cli-auth/challenges/${id}/cancel`, { token }),

  searchAdminUsers: (query: string) =>
    api.get<AdminUserDirectoryEntry[]>(`/admin/users?query=${encodeURIComponent(query)}`),

  promoteInstanceAdmin: (userId: string) =>
    api.post(`/admin/users/${userId}/promote-instance-admin`, {}),

  demoteInstanceAdmin: (userId: string) =>
    api.post(`/admin/users/${userId}/demote-instance-admin`, {}),

  getUserКомпанияДоступ: (userId: string) =>
    api.get<UserКомпанияДоступResponse>(`/admin/users/${userId}/company-access`),

  setUserКомпанияДоступ: (userId: string, companyIds: string[]) =>
    api.put<UserКомпанияДоступResponse>(`/admin/users/${userId}/company-access`, { companyIds }),

  getCurrentСоветДоступ: () =>
    api.get<CurrentСоветДоступ>("/cli-auth/me"),
};
