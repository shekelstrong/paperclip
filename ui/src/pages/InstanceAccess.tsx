import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldCheck } from "lucide-react";
import { accessApi } from "@/api/access";
import { ApiОшибка } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useКомпания } from "@/context/КомпанияContext";
import { useToast } from "@/context/ToastContext";
import { queryКлючs } from "@/lib/queryКлючs";

export function InstanceДоступ() {
  const { companies } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setПоиск] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedКомпанияIds, setSelectedКомпанияIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setBreadcrumbs([
      { label: "Instance Настройки", href: "/instance/settings/general" },
      { label: "Доступ" },
    ]);
  }, [setBreadcrumbs]);

  const usersQuery = useQuery({
    queryКлюч: queryКлючs.access.adminUsers(search),
    queryFn: () => accessApi.searchAdminUsers(search),
  });

  const selectedUser = useMemo(
    () => usersQuery.data?.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, usersQuery.data],
  );

  const userДоступQuery = useQuery({
    queryКлюч: queryКлючs.access.userКомпанияДоступ(selectedUserId ?? ""),
    queryFn: () => accessApi.getUserКомпанияДоступ(selectedUserId!),
    enabled: !!selectedUserId,
  });

  useEffect(() => {
    if (!selectedUserId && usersQuery.data?.[0]) {
      setSelectedUserId(usersQuery.data[0].id);
    }
  }, [selectedUserId, usersQuery.data]);

  useEffect(() => {
    if (!userДоступQuery.data) return;
    setSelectedКомпанияIds(
      new Set(
        userДоступQuery.data.companyДоступ
          .filter((membership) => membership.status === "active")
          .map((membership) => membership.companyId),
      ),
    );
  }, [userДоступQuery.data]);

  const updateКомпанияДоступMutation = useMutation({
    mutationFn: () => accessApi.setUserКомпанияДоступ(selectedUserId!, [...selectedКомпанияIds]),
    onУспешно: async () => {
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.access.userКомпанияДоступ(selectedUserId!) });
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.access.adminUsers(search) });
      pushToast({ title: "Компания access updated", tone: "success" });
    },
  });

  const setAdminMutation = useMutation({
    mutationFn: async (makeAdmin: boolean) => {
      if (!selectedUserId) throw new Ошибка("Нет user selected");
      if (makeAdmin) return accessApi.promoteInstanceAdmin(selectedUserId);
      return accessApi.demoteInstanceAdmin(selectedUserId);
    },
    onУспешно: async () => {
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.access.adminUsers(search) });
      if (selectedUserId) {
        await queryClient.invalidateQueries({ queryКлюч: queryКлючs.access.userКомпанияДоступ(selectedUserId) });
      }
      pushToast({ title: "Instance role updated", tone: "success" });
    },
  });

  if (usersQuery.isЗагрузка) {
    return <div classИмя="text-sm text-muted-foreground">Загрузка instance users…</div>;
  }

  if (usersQuery.error) {
    const message =
      usersQuery.error instanceof ApiОшибка && usersQuery.error.status === 403
        ? "Instance admin access is required to manage users."
        : usersQuery.error instanceof Ошибка
          ? usersQuery.error.message
          : "Ошибка to load users.";
    return <div classИмя="text-sm text-destructive">{message}</div>;
  }

  return (
    <div classИмя="max-w-6xl space-y-6">
      <div classИмя="space-y-3">
        <div classИмя="flex items-center gap-2">
          <Shield classИмя="h-5 w-5 text-muted-foreground" />
          <h1 classИмя="text-lg font-semibold">Instance Доступ</h1>
        </div>
        <p classИмя="max-w-3xl text-sm text-muted-foreground">
          Поиск users, manage instance-admin status, and control which companies they can access.
        </p>
      </div>

      <div classИмя="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section classИмя="space-y-4 rounded-xl border border-border bg-card p-4">
          <label classИмя="block space-y-2 text-sm">
            <span classИмя="font-medium">Поиск users</span>
            <input
              classИмя="w-full rounded-md border border-border bg-background px-3 py-2"
              value={search}
              onChange={(event) => setПоиск(event.target.value)}
              placeholder="Поиск by name or email"
            />
          </label>
          <div classИмя="space-y-2">
            {(usersQuery.data ?? []).map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedUserId(user.id)}
                classИмя={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                  user.id === selectedUserId
                    ? "border-foreground bg-accent"
                    : "border-border hover:bg-accent/40"
                }`}
              >
                <div classИмя="flex items-center justify-between gap-2">
                  <div classИмя="min-w-0">
                    <div classИмя="truncate font-medium">{user.name || user.email || user.id}</div>
                    <div classИмя="truncate text-sm text-muted-foreground">{user.email || user.id}</div>
                  </div>
                  {user.isInstanceAdmin ? (
                    <ShieldCheck classИмя="h-4 w-4 text-emerald-600" />
                  ) : null}
                </div>
                <div classИмя="mt-2 text-xs text-muted-foreground">
                  {user.activeКомпанияMembershipCount} active company memberships
                </div>
              </button>
            ))}
          </div>
        </section>

        <section classИмя="space-y-4 rounded-xl border border-border bg-card p-5">
          {!selectedUserId ? (
            <div classИмя="text-sm text-muted-foreground">Select a user to inspect instance access.</div>
          ) : userДоступQuery.isЗагрузка ? (
            <div classИмя="text-sm text-muted-foreground">Загрузка user access…</div>
          ) : userДоступQuery.error ? (
            <div classИмя="text-sm text-destructive">
              {userДоступQuery.error instanceof Ошибка ? userДоступQuery.error.message : "Ошибка to load user access."}
            </div>
          ) : (
            <>
              <div classИмя="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div classИмя="text-lg font-semibold">
                    {selectedUser?.name || selectedUser?.email || selectedUserId}
                  </div>
                  <div classИмя="text-sm text-muted-foreground">
                    {selectedUser?.email || selectedUserId}
                  </div>
                </div>
                <Button
                  variant={selectedUser?.isInstanceAdmin ? "outline" : "default"}
                  onClick={() => setAdminMutation.mutate(!(selectedUser?.isInstanceAdmin ?? false))}
                  disabled={setAdminMutation.isОжидание}
                >
                  {selectedUser?.isInstanceAdmin ? "Удалить instance admin" : "Promote to instance admin"}
                </Button>
              </div>

              <div classИмя="space-y-3">
                <div>
                  <h2 classИмя="text-sm font-semibold">Компания access</h2>
                  <p classИмя="text-sm text-muted-foreground">
                    Toggle company membership for this user. New access defaults to an active operator membership.
                  </p>
                </div>
                <div classИмя="grid gap-3 md:grid-cols-2">
                  {companies.map((company) => (
                    <label
                      key={company.id}
                      classИмя="flex items-start gap-3 rounded-lg border border-border px-3 py-3"
                    >
                      <Checkbox
                        checked={selectedКомпанияIds.has(company.id)}
                        onCheckedChange={(checked) => {
                          setSelectedКомпанияIds((current) => {
                            const next = new Set(current);
                            if (checked) next.add(company.id);
                            else next.delete(company.id);
                            return next;
                          });
                        }}
                      />
                      <span classИмя="space-y-1">
                        <span classИмя="block text-sm font-medium">{company.name}</span>
                        <span classИмя="block text-xs text-muted-foreground">{company.issuePrefix}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div classИмя="flex justify-end">
                  <Button
                    onClick={() => updateКомпанияДоступMutation.mutate()}
                    disabled={updateКомпанияДоступMutation.isОжидание}
                  >
                    {updateКомпанияДоступMutation.isОжидание ? "Saving…" : "Сохранить company access"}
                  </Button>
                </div>
              </div>

              <div classИмя="space-y-2">
                <h2 classИмя="text-sm font-semibold">Current memberships</h2>
                <div classИмя="space-y-2">
                  {(userДоступQuery.data?.companyДоступ ?? []).map((membership) => (
                    <div
                      key={membership.id}
                      classИмя="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <div classИмя="font-medium">{membership.companyИмя || membership.companyId}</div>
                        <div classИмя="text-muted-foreground">
                          {membership.membershipRole || "unset"} • {membership.status}
                        </div>
                      </div>
                      <div classИмя="text-xs text-muted-foreground">
                        {new Date(membership.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
