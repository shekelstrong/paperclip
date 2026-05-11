import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HUMAN_COMPANY_MEMBERSHIP_ROLE_LABELS,
  PERMISSION_KEYS,
  type Агент,
  type PermissionКлюч,
} from "@paperclipai/shared";
import { ShieldCheck, Trash2, Users } from "lucide-react";
import { accessApi, type КомпанияMember } from "@/api/access";
import { agentsApi } from "@/api/agents";
import { ApiОшибка } from "@/api/client";
import { issuesApi } from "@/api/issues";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogОписание,
  DialogFooter,
  DialogHeader,
  DialogНазвание,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useКомпания } from "@/context/КомпанияContext";
import { useToast } from "@/context/ToastContext";
import { queryКлючs } from "@/lib/queryКлючs";

const permissionЯрлыки: Record<PermissionКлюч, string> = {
  "agents:create": "Создать agents",
  "users:invite": "Invite humans and agents",
  "users:manage_permissions": "Manage members and grants",
  "tasks:assign": "Назначать задачи",
  "tasks:assign_scope": "Assign scoped tasks",
  "tasks:manage_active_checkouts": "Manage active task checkouts",
  "joins:approve": "Одобрить join requests",
  "environments:manage": "Manage environments",
};

function formatGrantSummary(member: КомпанияMember) {
  if (member.grants.length === 0) return "Нет explicit grants";
  return member.grants.map((grant) => permissionЯрлыки[grant.permissionКлюч]).join(", ");
}

const implicitRoleGrantMap: Record<НетnNullable<КомпанияMember["membershipRole"]>, PermissionКлюч[]> = {
  owner: ["agents:create", "users:invite", "users:manage_permissions", "tasks:assign", "joins:approve"],
  admin: ["agents:create", "users:invite", "tasks:assign", "joins:approve"],
  operator: ["tasks:assign"],
  viewer: [],
};

const reassignmentЗадачаСтатусes = "backlog,todo,in_progress,in_review,blocked,failed,timed_out";
type ИзменитьableMemberСтатус = "pending" | "active" | "suspended";

function getImplicitGrantКлючs(role: КомпанияMember["membershipRole"]) {
  return role ? implicitRoleGrantMap[role] : [];
}

export function КомпанияДоступ() {
  const { selectedКомпания, selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [editingMemberId, setИзменитьingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [reassignmentЦель, setReassignmentЦель] = useState<string>("__unassigned");
  const [draftRole, setЧерновикRole] = useState<КомпанияMember["membershipRole"]>(null);
  const [draftСтатус, setЧерновикСтатус] = useState<ИзменитьableMemberСтатус>("active");
  const [draftGrants, setЧерновикGrants] = useState<Set<PermissionКлюч>>(new Set());

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedКомпания?.name ?? "Компания", href: "/dashboard" },
      { label: "Настройки", href: "/company/settings" },
      { label: "Доступ" },
    ]);
  }, [selectedКомпания?.name, setBreadcrumbs]);

  const membersQuery = useQuery({
    queryКлюч: queryКлючs.access.companyMembers(selectedКомпанияId ?? ""),
    queryFn: () => accessApi.listMembers(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const agentsQuery = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId ?? ""),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const joinRequestsQuery = useQuery({
    queryКлюч: queryКлючs.access.joinRequests(selectedКомпанияId ?? "", "pending_approval"),
    queryFn: () => accessApi.listJoinRequests(selectedКомпанияId!, "pending_approval"),
    enabled: !!selectedКомпанияId && !!membersQuery.data?.access.canОдобритьJoinRequests,
  });

  const refreshДоступData = async () => {
    if (!selectedКомпанияId) return;
    await queryClient.invalidateQueries({ queryКлюч: queryКлючs.access.companyMembers(selectedКомпанияId) });
    await queryClient.invalidateQueries({ queryКлюч: queryКлючs.access.companyUserDirectory(selectedКомпанияId) });
    await queryClient.invalidateQueries({ queryКлюч: queryКлючs.access.joinRequests(selectedКомпанияId, "pending_approval") });
  };

  const updateMemberMutation = useMutation({
    mutationFn: async (input: { memberId: string; membershipRole: КомпанияMember["membershipRole"]; status: ИзменитьableMemberСтатус; grants: PermissionКлюч[] }) => {
      return accessApi.updateMemberДоступ(selectedКомпанияId!, input.memberId, {
        membershipRole: input.membershipRole,
        status: input.status,
        grants: input.grants.map((permissionКлюч) => ({ permissionКлюч })),
      });
    },
    onУспешно: async () => {
      setИзменитьingMemberId(null);
      await refreshДоступData();
      pushToast({
        title: "Member updated",
        tone: "success",
      });
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка to update member",
        body: error instanceof Ошибка ? error.message : "Неизвестно error",
        tone: "error",
      });
    },
  });

  const approveJoinRequestMutation = useMutation({
    mutationFn: (requestId: string) => accessApi.approveJoinRequest(selectedКомпанияId!, requestId),
    onУспешно: async () => {
      await refreshДоступData();
      pushToast({
        title: "Join request approved",
        tone: "success",
      });
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка to approve join request",
        body: error instanceof Ошибка ? error.message : "Неизвестно error",
        tone: "error",
      });
    },
  });

  const rejectJoinRequestMutation = useMutation({
    mutationFn: (requestId: string) => accessApi.rejectJoinRequest(selectedКомпанияId!, requestId),
    onУспешно: async () => {
      await refreshДоступData();
      pushToast({
        title: "Join request rejected",
        tone: "success",
      });
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка to reject join request",
        body: error instanceof Ошибка ? error.message : "Неизвестно error",
        tone: "error",
      });
    },
  });

  const editingMember = useMemo(
    () => membersQuery.data?.members.find((member) => member.id === editingMemberId) ?? null,
    [editingMemberId, membersQuery.data?.members],
  );
  const removingMember = useMemo(
    () => membersQuery.data?.members.find((member) => member.id === removingMemberId) ?? null,
    [removingMemberId, membersQuery.data?.members],
  );

  const assignedЗадачиQuery = useQuery({
    queryКлюч: ["access", "member-assigned-issues", selectedКомпанияId ?? "", removingMember?.principalId ?? ""],
    queryFn: () =>
      issuesApi.list(selectedКомпанияId!, {
        assigneeUserId: removingMember!.principalId,
        status: reassignmentЗадачаСтатусes,
      }),
    enabled: !!selectedКомпанияId && !!removingMember,
  });

  const archiveMemberMutation = useMutation({
    mutationFn: async (input: { memberId: string; target: string }) => {
      const reassignment =
        input.target.startsWith("agent:")
          ? { assigneeАгентId: input.target.slice("agent:".length), assigneeUserId: null }
          : input.target.startsWith("user:")
            ? { assigneeАгентId: null, assigneeUserId: input.target.slice("user:".length) }
            : null;
      return accessApi.archiveMember(selectedКомпанияId!, input.memberId, { reassignment });
    },
    onУспешно: async (result) => {
      setRemovingMemberId(null);
      setReassignmentЦель("__unassigned");
      await refreshДоступData();
      if (selectedКомпанияId) {
        await queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.list(selectedКомпанияId) });
        await queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listAssignedToMe(selectedКомпанияId) });
        await queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.listTouchedByMe(selectedКомпанияId) });
      }
      pushToast({
        title: "Member removed",
        body:
          result.reassignedЗадачаCount > 0
            ? `${result.reassignedЗадачаCount} assigned issue${result.reassignedЗадачаCount === 1 ? "" : "s"} cleaned up.`
            : undefined,
        tone: "success",
      });
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка to remove member",
        body: error instanceof Ошибка ? error.message : "Неизвестно error",
        tone: "error",
      });
    },
  });

  useEffect(() => {
    if (!editingMember) return;
    setЧерновикRole(editingMember.membershipRole);
    setЧерновикСтатус(isИзменитьableMemberСтатус(editingMember.status) ? editingMember.status : "suspended");
    setЧерновикGrants(new Set(editingMember.grants.map((grant) => grant.permissionКлюч)));
  }, [editingMember]);

  useEffect(() => {
    if (!removingMember) return;
    setReassignmentЦель("__unassigned");
  }, [removingMember]);

  if (!selectedКомпанияId) {
    return <div classИмя="text-sm text-muted-foreground">Select a company to manage access.</div>;
  }

  if (membersQuery.isЗагрузка) {
    return <div classИмя="text-sm text-muted-foreground">Загрузка company access…</div>;
  }

  if (membersQuery.error) {
    const message =
      membersQuery.error instanceof ApiОшибка && membersQuery.error.status === 403
        ? "You do not have permission to manage company members."
        : membersQuery.error instanceof Ошибка
          ? membersQuery.error.message
          : "Ошибка to load company members.";
    return <div classИмя="text-sm text-destructive">{message}</div>;
  }

  const members = membersQuery.data?.members ?? [];
  const access = membersQuery.data?.access;
  const pendingЧеловекJoinRequests =
    joinRequestsQuery.data?.filter((request) => request.requestТип === "human") ?? [];
  const joinRequestActionОжидание =
    approveJoinRequestMutation.isОжидание || rejectJoinRequestMutation.isОжидание;
  const implicitGrantКлючs = getImplicitGrantКлючs(draftRole);
  const implicitGrantSet = new Set(implicitGrantКлючs);
  const activeReassignmentUsers = members.filter(
    (member) =>
      member.status === "active" &&
      member.principalТип === "user" &&
      member.id !== removingMemberId,
  );
  const activeReassignmentАгенты = (agentsQuery.data ?? []).filter(isAssignableАгент);
  const assignedЗадачи = assignedЗадачиQuery.data ?? [];

  return (
    <div classИмя="max-w-6xl space-y-8">
      <div classИмя="space-y-3">
        <div classИмя="flex items-center gap-2">
          <ShieldCheck classИмя="h-5 w-5 text-muted-foreground" />
          <h1 classИмя="text-lg font-semibold">Компания Доступ</h1>
        </div>
        <p classИмя="max-w-3xl text-sm text-muted-foreground">
          Manage company user memberships, membership status, and explicit permission grants for {selectedКомпания?.name}.
        </p>
      </div>

      {access && !access.currentUserRole && (
        <div classИмя="rounded-xl border border-amber-500/40 px-4 py-3 text-sm text-amber-200">
          This account can manage access here through instance-admin privileges, but it does not currently hold an active company membership.
        </div>
      )}

      <section classИмя="space-y-4">
        <div classИмя="space-y-1">
          <div classИмя="flex items-center gap-2">
            <Users classИмя="h-4 w-4 text-muted-foreground" />
            <h2 classИмя="text-base font-semibold">Люди</h2>
          </div>
          <p classИмя="max-w-3xl text-sm text-muted-foreground">
            Manage human company memberships, status, and grants here.
          </p>
        </div>

        {access?.canОдобритьJoinRequests && pendingЧеловекJoinRequests.length > 0 ? (
          <div classИмя="space-y-3 rounded-xl border border-border px-4 py-4">
            <div classИмя="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 classИмя="text-sm font-semibold">Ожидание human joins</h3>
                <p classИмя="text-sm text-muted-foreground">
                  Review human join requests before they become active company members.
                </p>
              </div>
              <Badge variant="outline">{pendingЧеловекJoinRequests.length} pending</Badge>
            </div>
            <div classИмя="space-y-3">
              {pendingЧеловекJoinRequests.map((request) => (
                <ОжиданиеJoinRequestCard
                  key={request.id}
                  title={
                    request.requesterUser?.name ||
                    request.requestПочтаSnapshot ||
                    request.requestingUserId ||
                    "Неизвестно human requester"
                  }
                  subtitle={
                    request.requesterUser?.email ||
                    request.requestПочтаSnapshot ||
                    request.requestingUserId ||
                    "Нет email available"
                  }
                  context={
                    request.invite
                      ? `${request.invite.allowedJoinТипs} join invite${request.invite.humanRole ? ` • default role ${request.invite.humanRole}` : ""}`
                      : "Invite metadata unavailable"
                  }
                  detail={`Отправитьted ${new Date(request.createdAt).toLocaleString()}`}
                  approveLabel="Одобрить human"
                  rejectLabel="Отклонить human"
                  disabled={joinRequestActionОжидание}
                  onОдобрить={() => approveJoinRequestMutation.mutate(request.id)}
                  onОтклонить={() => rejectJoinRequestMutation.mutate(request.id)}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div classИмя="overflow-hidden rounded-xl border border-border">
          <div classИмя="grid grid-cols-[minmax(0,1.5fr)_120px_120px_minmax(0,1.2fr)_180px] gap-3 border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <div>User account</div>
            <div>Role</div>
            <div>Статус</div>
            <div>Grants</div>
            <div classИмя="text-right">Action</div>
          </div>
          {members.length === 0 ? (
            <div classИмя="px-4 py-8 text-sm text-muted-foreground">Нет user memberships found for this company yet.</div>
          ) : (
            members.map((member) => {
              const removalReason = member.removal?.reason ?? null;
              const canАрхивировать = member.removal?.canАрхивировать ?? true;
              return (
                <div
                  key={member.id}
                  classИмя="grid grid-cols-[minmax(0,1.5fr)_120px_120px_minmax(0,1.2fr)_180px] gap-3 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <div classИмя="min-w-0">
                    <div classИмя="truncate font-medium">{member.user?.name?.trim() || member.user?.email || member.principalId}</div>
                    <div classИмя="truncate text-xs text-muted-foreground">{member.user?.email || member.principalId}</div>
                  </div>
                  <div classИмя="text-sm">
                    {member.membershipRole
                      ? HUMAN_COMPANY_MEMBERSHIP_ROLE_LABELS[member.membershipRole]
                      : "Не задан"}
                  </div>
                  <div>
                    <Badge variant={member.status === "active" ? "secondary" : member.status === "suspended" ? "destructive" : "outline"}>
                      {member.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div classИмя="min-w-0 text-sm text-muted-foreground">{formatGrantSummary(member)}</div>
                  <div classИмя="space-y-1 text-right">
                    <div classИмя="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setИзменитьingMemberId(member.id)}>
                        Изменить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRemovingMemberId(member.id)}
                        disabled={!canАрхивировать}
                        title={removalReason ?? undefined}
                      >
                        <Trash2 classИмя="mr-1 h-3.5 w-3.5" />
                        Удалить
                      </Button>
                    </div>
                    {removalReason ? (
                      <div classИмя="text-xs text-muted-foreground">{removalReason}</div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setИзменитьingMemberId(null)}>
        <DialogContent classИмя="max-w-2xl">
          <DialogHeader>
            <DialogНазвание>Изменить member</DialogНазвание>
            <DialogОписание>
              Обновить company role, membership status, and explicit grants for {editingMember?.user?.name || editingMember?.user?.email || editingMember?.principalId}.
            </DialogОписание>
          </DialogHeader>
          {editingMember && (
            <div classИмя="space-y-5">
              <div classИмя="grid gap-4 md:grid-cols-2">
                <label classИмя="space-y-2 text-sm">
                  <span classИмя="font-medium">Компания role</span>
                  <select
                    classИмя="w-full rounded-md border border-border bg-background px-3 py-2"
                    value={draftRole ?? ""}
                    onChange={(event) =>
                      setЧерновикRole((event.target.value || null) as КомпанияMember["membershipRole"])
                    }
                  >
                    <option value="">Не задан</option>
                    {Object.entries(HUMAN_COMPANY_MEMBERSHIP_ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label classИмя="space-y-2 text-sm">
                  <span classИмя="font-medium">Membership status</span>
                  <select
                    classИмя="w-full rounded-md border border-border bg-background px-3 py-2"
                    value={draftСтатус}
                    onChange={(event) =>
                      setЧерновикСтатус(event.target.value as ИзменитьableMemberСтатус)
                    }
                  >
                    <option value="active">Активен</option>
                    <option value="pending">Ожидание</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>
              </div>

              <div classИмя="space-y-3">
                <div>
                  <h3 classИмя="text-sm font-medium">Grants</h3>
                  <p classИмя="text-sm text-muted-foreground">
                    Roles provide implicit grants automatically. Explicit grants below are only for overrides and extra access that should persist even if the role changes.
                  </p>
                </div>
                <div classИмя="rounded-lg border border-border px-3 py-3">
                  <div classИмя="text-sm font-medium">Implicit grants from role</div>
                  <p classИмя="mt-1 text-sm text-muted-foreground">
                    {draftRole
                      ? `${HUMAN_COMPANY_MEMBERSHIP_ROLE_LABELS[draftRole]} currently includes these permissions automatically.`
                      : "Нет role is selected, so this member has no implicit grants right now."}
                  </p>
                  {implicitGrantКлючs.length > 0 ? (
                    <div classИмя="mt-3 flex flex-wrap gap-2">
                      {implicitGrantКлючs.map((permissionКлюч) => (
                        <Badge key={permissionКлюч} variant="outline">
                          {permissionЯрлыки[permissionКлюч]}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div classИмя="grid gap-3 md:grid-cols-2">
                  {PERMISSION_KEYS.map((permissionКлюч) => (
                    <label
                      key={permissionКлюч}
                      classИмя="flex items-start gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <Checkbox
                        checked={draftGrants.has(permissionКлюч)}
                        onCheckedChange={(checked) => {
                          setЧерновикGrants((current) => {
                            const next = new Set(current);
                            if (checked) next.add(permissionКлюч);
                            else next.delete(permissionКлюч);
                            return next;
                          });
                        }}
                      />
                      <span classИмя="space-y-1">
                        <span classИмя="block text-sm font-medium">{permissionЯрлыки[permissionКлюч]}</span>
                        <span classИмя="block text-xs text-muted-foreground">{permissionКлюч}</span>
                        {implicitGrantSet.has(permissionКлюч) ? (
                          <span classИмя="block text-xs text-muted-foreground">
                            Included implicitly by the {draftRole ? HUMAN_COMPANY_MEMBERSHIP_ROLE_LABELS[draftRole] : "selected"} role. Добавить an explicit grant only if it should stay after the role changes.
                          </span>
                        ) : null}
                        {draftGrants.has(permissionКлюч) ? (
                          <span classИмя="block text-xs text-muted-foreground">
                            Stored explicitly for this member.
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setИзменитьingMemberId(null)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                if (!editingMember) return;
                updateMemberMutation.mutate({
                  memberId: editingMember.id,
                  membershipRole: draftRole,
                  status: draftСтатус,
                  grants: [...draftGrants],
                });
              }}
              disabled={updateMemberMutation.isОжидание}
            >
              {updateMemberMutation.isОжидание ? "Saving…" : "Сохранить access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removingMember} onOpenChange={(open) => !open && setRemovingMemberId(null)}>
        <DialogContent classИмя="max-w-xl">
          <DialogHeader>
            <DialogНазвание>Удалить member</DialogНазвание>
            <DialogОписание>
              Архивировать {memberDisplayИмя(removingMember)} and move active assignments before hiding this user from assignment fields.
            </DialogОписание>
          </DialogHeader>
          {removingMember && (
            <div classИмя="space-y-5">
              <div classИмя="rounded-lg border border-border px-3 py-3">
                <div classИмя="text-sm font-medium">{memberDisplayИмя(removingMember)}</div>
                <div classИмя="text-sm text-muted-foreground">{removingMember.user?.email || removingMember.principalId}</div>
                <div classИмя="mt-2 text-sm text-muted-foreground">
                  {assignedЗадачиQuery.isЗагрузка
                    ? "Checking assigned issues..."
                    : `${assignedЗадачи.length} open assigned issue${assignedЗадачи.length === 1 ? "" : "s"}`}
                </div>
              </div>

              {assignedЗадачи.length > 0 ? (
                <div classИмя="space-y-2">
                  <div classИмя="text-sm font-medium">Задача reassignment</div>
                  <select
                    classИмя="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={reassignmentЦель}
                    onChange={(event) => setReassignmentЦель(event.target.value)}
                  >
                    <option value="__unassigned">Leave unassigned</option>
                    {activeReassignmentUsers.length > 0 ? (
                      <optgroup label="Люди">
                        {activeReassignmentUsers.map((member) => (
                          <option key={member.id} value={`user:${member.principalId}`}>
                            {memberDisplayИмя(member)}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    {activeReassignmentАгенты.length > 0 ? (
                      <optgroup label="Агенты">
                        {activeReassignmentАгенты.map((agent) => (
                          <option key={agent.id} value={`agent:${agent.id}`}>
                            {agent.name} ({agent.role})
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                  <div classИмя="max-h-36 overflow-auto rounded-lg border border-border">
                    {assignedЗадачи.slice(0, 6).map((issue) => (
                      <div key={issue.id} classИмя="border-b border-border px-3 py-2 text-sm last:border-b-0">
                        <div classИмя="font-medium">{issue.identifier ?? issue.id.slice(0, 8)}</div>
                        <div classИмя="truncate text-muted-foreground">{issue.title}</div>
                      </div>
                    ))}
                    {assignedЗадачи.length > 6 ? (
                      <div classИмя="px-3 py-2 text-sm text-muted-foreground">
                        {assignedЗадачи.length - 6} more issue{assignedЗадачи.length - 6 === 1 ? "" : "s"}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemovingMemberId(null)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!removingMember) return;
                archiveMemberMutation.mutate({
                  memberId: removingMember.id,
                  target: reassignmentЦель,
                });
              }}
              disabled={archiveMemberMutation.isОжидание || assignedЗадачиQuery.isЗагрузка}
            >
              {archiveMemberMutation.isОжидание ? "Removing..." : "Удалить member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function memberDisplayИмя(member: КомпанияMember | null) {
  if (!member) return "this member";
  return member.user?.name?.trim() || member.user?.email || member.principalId;
}

function isAssignableАгент(agent: Агент) {
  return agent.status !== "terminated" && agent.status !== "pending_approval";
}

function isИзменитьableMemberСтатус(status: КомпанияMember["status"]): status is ИзменитьableMemberСтатус {
  return status === "pending" || status === "active" || status === "suspended";
}

function ОжиданиеJoinRequestCard({
  title,
  subtitle,
  context,
  detail,
  detailSecondary,
  approveLabel,
  rejectLabel,
  disabled,
  onОдобрить,
  onОтклонить,
}: {
  title: string;
  subtitle: string;
  context: string;
  detail: string;
  detailSecondary?: string;
  approveLabel: string;
  rejectLabel: string;
  disabled: boolean;
  onОдобрить: () => void;
  onОтклонить: () => void;
}) {
  return (
    <div classИмя="rounded-xl border border-border px-4 py-4">
      <div classИмя="flex flex-wrap items-start justify-between gap-4">
        <div classИмя="space-y-2">
          <div>
            <div classИмя="font-medium">{title}</div>
            <div classИмя="text-sm text-muted-foreground">{subtitle}</div>
          </div>
          <div classИмя="text-sm text-muted-foreground">{context}</div>
          <div classИмя="text-sm text-muted-foreground">{detail}</div>
          {detailSecondary ? <div classИмя="text-sm text-muted-foreground">{detailSecondary}</div> : null}
        </div>
        <div classИмя="flex gap-2">
          <Button type="button" variant="outline" onClick={onОтклонить} disabled={disabled}>
            {rejectLabel}
          </Button>
          <Button type="button" onClick={onОдобрить} disabled={disabled}>
            {approveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
