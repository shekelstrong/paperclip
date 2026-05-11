import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, MailPlus } from "lucide-react";
import { accessApi } from "@/api/access";
import { ApiОшибка } from "@/api/client";
import { Button } from "@/components/ui/button";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useКомпания } from "@/context/КомпанияContext";
import { useToast } from "@/context/ToastContext";
import { Link } from "@/lib/router";
import { queryКлючs } from "@/lib/queryКлючs";

const inviteRoleOptions = [
  {
    value: "viewer",
    label: "Viewer",
    description: "Can view company work and follow along without operational permissions.",
    gets: "Нет built-in grants.",
  },
  {
    value: "operator",
    label: "Operator",
    description: "Recommended for people who need to help run work without managing access.",
    gets: "Can assign tasks.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Recommended for operators who need to invite people, create agents, and approve joins.",
    gets: "Can create agents, invite users, assign tasks, and approve join requests.",
  },
  {
    value: "owner",
    label: "Владелец",
    description: "Full company access, including membership and permission management.",
    gets: "Everything in Admin, plus managing members and permission grants.",
  },
] as const;

const INVITE_HISTORY_PAGE_SIZE = 5;

function isInviteИсторияRow(value: unknown): value is Awaited<ReturnТип<typeof accessApi.listInvites>>["invites"][number] {
  if (!value || typeof value !== "object") return false;
  return "id" in value && "state" in value && "createdAt" in value;
}

export function КомпанияInvites() {
  const { selectedКомпания, selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [humanRole, setЧеловекRole] = useState<"owner" | "admin" | "operator" | "viewer">("operator");
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [latestInviteCopied, setLatestInviteCopied] = useState(false);

  useEffect(() => {
    if (!latestInviteCopied) return;
    const timeout = window.setTimeout(() => {
      setLatestInviteCopied(false);
    }, 1600);
    return () => window.clearTimeout(timeout);
  }, [latestInviteCopied]);

  async function copyInviteUrl(url: string) {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return true;
      }
    } catch {
      // Fall through to the unavailable message below.
    }

    pushToast({
      title: "Clipboard unavailable",
      body: "Копировать the invite URL manually from the field below.",
      tone: "warn",
    });
    return false;
  }

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedКомпания?.name ?? "Компания", href: "/dashboard" },
      { label: "Настройки", href: "/company/settings" },
      { label: "Invites" },
    ]);
  }, [selectedКомпания?.name, setBreadcrumbs]);

  const inviteИсторияQueryКлюч = queryКлючs.access.invites(selectedКомпанияId ?? "", "all", INVITE_HISTORY_PAGE_SIZE);
  const invitesQuery = useInfiniteQuery({
    queryКлюч: inviteИсторияQueryКлюч,
    queryFn: ({ pageParam }) =>
      accessApi.listInvites(selectedКомпанияId!, {
        limit: INVITE_HISTORY_PAGE_SIZE,
        offset: pageParam,
      }),
    enabled: !!selectedКомпанияId,
    initialPageParam: 0,
    getДалееPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
  });
  const inviteИстория = useMemo(
    () =>
      invitesQuery.data?.pages.flatMap((page) =>
        Array.isArray(page?.invites) ? page.invites.filter(isInviteИсторияRow) : [],
      ) ?? [],
    [invitesQuery.data?.pages],
  );

  const createInviteMutation = useMutation({
    mutationFn: () =>
      accessApi.createКомпанияInvite(selectedКомпанияId!, {
        allowedJoinТипs: "human",
        humanRole,
        agentMessage: null,
      }),
    onУспешно: async (invite) => {
      setLatestInviteUrl(invite.inviteUrl);
      setLatestInviteCopied(false);
      const copied = await copyInviteUrl(invite.inviteUrl);

      await queryClient.invalidateQueries({ queryКлюч: inviteИсторияQueryКлюч });
      pushToast({
        title: "Invite created",
        body: copied ? "Invite ready below and copied to clipboard." : "Invite ready below.",
        tone: "success",
      });
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка to create invite",
        body: error instanceof Ошибка ? error.message : "Неизвестно error",
        tone: "error",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => accessApi.revokeInvite(inviteId),
    onУспешно: async () => {
      await queryClient.invalidateQueries({ queryКлюч: inviteИсторияQueryКлюч });
      pushToast({ title: "Invite revoked", tone: "success" });
    },
    onОшибка: (error) => {
      pushToast({
        title: "Ошибка to revoke invite",
        body: error instanceof Ошибка ? error.message : "Неизвестно error",
        tone: "error",
      });
    },
  });

  if (!selectedКомпанияId) {
    return <div classИмя="text-sm text-muted-foreground">Select a company to manage invites.</div>;
  }

  if (invitesQuery.isЗагрузка) {
    return <div classИмя="text-sm text-muted-foreground">Загрузка invites…</div>;
  }

  if (invitesQuery.error) {
    const message =
      invitesQuery.error instanceof ApiОшибка && invitesQuery.error.status === 403
        ? "You do not have permission to manage company invites."
        : invitesQuery.error instanceof Ошибка
          ? invitesQuery.error.message
          : "Ошибка to load invites.";
    return <div classИмя="text-sm text-destructive">{message}</div>;
  }

  return (
    <div classИмя="max-w-5xl space-y-8">
      <div classИмя="space-y-3">
        <div classИмя="flex items-center gap-2">
          <MailPlus classИмя="h-5 w-5 text-muted-foreground" />
          <h1 classИмя="text-lg font-semibold">Компания Invites</h1>
        </div>
        <p classИмя="max-w-3xl text-sm text-muted-foreground">
          Создать human invite links for company access. New invite links are copied to your clipboard when they are generated.
        </p>
      </div>

      <section classИмя="space-y-4 rounded-xl border border-border p-5">
        <div classИмя="space-y-1">
          <h2 classИмя="text-sm font-semibold">Создать invite</h2>
          <p classИмя="text-sm text-muted-foreground">
            Generate a human invite link and choose the default access it should request.
          </p>
        </div>

        <fieldset classИмя="space-y-3">
          <legend classИмя="text-sm font-medium">Choose a role</legend>
          <div classИмя="rounded-xl border border-border">
            {inviteRoleOptions.map((option, index) => {
              const checked = humanRole === option.value;
              return (
                <label
                  key={option.value}
                  classИмя={`flex cursor-pointer gap-3 px-4 py-4 ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    value={option.value}
                    checked={checked}
                    onChange={() => setЧеловекRole(option.value)}
                    classИмя="mt-1 h-4 w-4 border-border text-foreground"
                  />
                  <span classИмя="min-w-0 space-y-1">
                    <span classИмя="flex flex-wrap items-center gap-2">
                      <span classИмя="text-sm font-medium">{option.label}</span>
                      {option.value === "operator" ? (
                        <span classИмя="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          По умолчанию
                        </span>
                      ) : null}
                    </span>
                    <span classИмя="block max-w-2xl text-sm text-muted-foreground">{option.description}</span>
                    <span classИмя="block text-sm text-foreground">{option.gets}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div classИмя="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground">
          Each invite link is single-use. The first successful use consumes the link and creates or reuses the matching join request before approval.
        </div>

        <div classИмя="flex flex-wrap items-center gap-3">
          <Button onClick={() => createInviteMutation.mutate()} disabled={createInviteMutation.isОжидание}>
            {createInviteMutation.isОжидание ? "Creating…" : "Создать invite"}
          </Button>
          <span classИмя="text-sm text-muted-foreground">Invite history below keeps the audit trail.</span>
        </div>

        {latestInviteUrl ? (
          <div classИмя="space-y-3 rounded-lg border border-border px-4 py-4">
            <div classИмя="space-y-1">
              <div classИмя="flex items-center justify-between gap-3">
                <div classИмя="text-sm font-medium">Latest invite link</div>
                {latestInviteCopied ? (
                  <div classИмя="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                    <Check classИмя="h-3.5 w-3.5" />
                    Copied
                  </div>
                ) : null}
              </div>
              <div classИмя="text-sm text-muted-foreground">
                This URL includes the current Paperclip domain returned by the server.
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                const copied = await copyInviteUrl(latestInviteUrl);
                setLatestInviteCopied(copied);
              }}
              classИмя="w-full rounded-md border border-border bg-muted/60 px-3 py-2 text-left text-sm break-all transition-colors hover:bg-background"
            >
              {latestInviteUrl}
            </button>
            <div classИмя="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={latestInviteUrl} target="_blank" rel="noreferrer">
                  <ExternalLink classИмя="h-4 w-4" />
                  Open invite
                </a>
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section classИмя="rounded-xl border border-border">
        <div classИмя="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div classИмя="space-y-1">
            <h2 classИмя="text-sm font-semibold">Invite history</h2>
            <p classИмя="text-sm text-muted-foreground">
              Review invite status, role, inviter, and any linked join request.
            </p>
          </div>
          <Link to="/inbox/requests" classИмя="text-sm underline underline-offset-4">
            Open join request queue
          </Link>
        </div>

        {inviteИстория.length === 0 ? (
          <div classИмя="border-t border-border px-5 py-8 text-sm text-muted-foreground">
            Нет invites have been created for this company yet.
          </div>
        ) : (
          <div classИмя="border-t border-border">
            <div classИмя="overflow-x-auto">
              <table classИмя="min-w-full text-left text-sm">
                <thead>
                  <tr classИмя="border-b border-border">
                    <th classИмя="px-5 py-3 font-medium text-muted-foreground">State</th>
                    <th classИмя="px-5 py-3 font-medium text-muted-foreground">Role</th>
                    <th classИмя="px-5 py-3 font-medium text-muted-foreground">Invited by</th>
                    <th classИмя="px-5 py-3 font-medium text-muted-foreground">Создано</th>
                    <th classИмя="px-5 py-3 font-medium text-muted-foreground">Join request</th>
                    <th classИмя="px-5 py-3 text-right font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inviteИстория.map((invite) => (
                    <tr key={invite.id} classИмя="border-b border-border last:border-b-0">
                      <td classИмя="px-5 py-3 align-top">
                        <span classИмя="inline-flex rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                          {formatInviteState(invite.state)}
                        </span>
                      </td>
                      <td classИмя="px-5 py-3 align-top">{invite.humanRole ?? "—"}</td>
                      <td classИмя="px-5 py-3 align-top">
                        <div>{invite.invitedByUser?.name || invite.invitedByUser?.email || "Неизвестно inviter"}</div>
                        {invite.invitedByUser?.email && invite.invitedByUser.name ? (
                          <div classИмя="text-xs text-muted-foreground">{invite.invitedByUser.email}</div>
                        ) : null}
                      </td>
                      <td classИмя="px-5 py-3 align-top text-muted-foreground">
                        {new Date(invite.createdAt).toLocaleString()}
                      </td>
                      <td classИмя="px-5 py-3 align-top">
                        {invite.relatedJoinRequestId ? (
                          <Link to="/inbox/requests" classИмя="underline underline-offset-4">
                            Review request
                          </Link>
                        ) : (
                          <span classИмя="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td classИмя="px-5 py-3 text-right align-top">
                        {invite.state === "active" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => revokeMutation.mutate(invite.id)}
                            disabled={revokeMutation.isОжидание}
                          >
                            Revoke
                          </Button>
                        ) : (
                          <span classИмя="text-xs text-muted-foreground">Inactive</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {invitesQuery.hasДалееPage ? (
              <div classИмя="flex justify-center border-t border-border px-5 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => invitesQuery.fetchДалееPage()}
                  disabled={invitesQuery.isFetchingДалееPage}
                >
                  {invitesQuery.isFetchingДалееPage ? "Загрузка more…" : "Показать больше"}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function formatInviteState(state: "active" | "accepted" | "expired" | "revoked") {
  return state.charAt(0).toUpperCase() + state.slice(1);
}
