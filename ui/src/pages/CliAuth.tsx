import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useПоискParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { accessApi } from "../api/access";
import { authApi } from "../api/auth";
import { queryКлючs } from "../lib/queryКлючs";

export function CliAuthPage() {
  const queryClient = useQueryClient();
  const params = useParams();
  const [searchParams] = useПоискParams();
  const challengeId = (params.id ?? "").trim();
  const token = (searchParams.get("token") ?? "").trim();
  const currentПуть = useMemo(
    () => `/cli-auth/${encodeURIComponent(challengeId)}${token ? `?token=${encodeURIComponent(token)}` : ""}`,
    [challengeId, token],
  );

  const sessionQuery = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const challengeQuery = useQuery({
    queryКлюч: ["cli-auth-challenge", challengeId, token],
    queryFn: () => accessApi.getCliAuthChallenge(challengeId, token),
    enabled: challengeId.length > 0 && token.length > 0,
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: () => accessApi.approveCliAuthChallenge(challengeId, token),
    onУспешно: async () => {
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.auth.session });
      await challengeQuery.refetch();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => accessApi.cancelCliAuthChallenge(challengeId, token),
    onУспешно: async () => {
      await challengeQuery.refetch();
    },
  });

  if (!challengeId || !token) {
    return <div classИмя="mx-auto max-w-xl py-10 text-sm text-destructive">Invalid CLI auth URL.</div>;
  }

  if (sessionQuery.isЗагрузка || challengeQuery.isЗагрузка) {
    return <div classИмя="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Загрузка CLI auth challenge...</div>;
  }

  if (challengeQuery.error) {
    return (
      <div classИмя="mx-auto max-w-xl py-10">
        <div classИмя="rounded-lg border border-border bg-card p-6">
          <h1 classИмя="text-lg font-semibold">CLI auth challenge unavailable</h1>
          <p classИмя="mt-2 text-sm text-muted-foreground">
            {challengeQuery.error instanceof Ошибка ? challengeQuery.error.message : "Challenge is invalid or expired."}
          </p>
        </div>
      </div>
    );
  }

  const challenge = challengeQuery.data;
  if (!challenge) {
    return <div classИмя="mx-auto max-w-xl py-10 text-sm text-destructive">CLI auth challenge unavailable.</div>;
  }

  if (challenge.status === "approved") {
    return (
      <div classИмя="mx-auto max-w-xl py-10">
        <div classИмя="rounded-lg border border-border bg-card p-6">
          <h1 classИмя="text-xl font-semibold">CLI access approved</h1>
          <p classИмя="mt-2 text-sm text-muted-foreground">
            The Paperclip CLI can now finish authentication on the requesting machine.
          </p>
          <p classИмя="mt-4 text-sm text-muted-foreground">
            Команда: <span classИмя="font-mono text-foreground">{challenge.command}</span>
          </p>
        </div>
      </div>
    );
  }

  if (challenge.status === "cancelled" || challenge.status === "expired") {
    return (
      <div classИмя="mx-auto max-w-xl py-10">
        <div classИмя="rounded-lg border border-border bg-card p-6">
          <h1 classИмя="text-xl font-semibold">
            {challenge.status === "expired" ? "CLI auth challenge expired" : "CLI auth challenge cancelled"}
          </h1>
          <p classИмя="mt-2 text-sm text-muted-foreground">
            Начать the CLI auth flow again from your terminal to generate a new approval request.
          </p>
        </div>
      </div>
    );
  }

  if (challenge.requiresSignIn || !sessionQuery.data) {
    return (
      <div classИмя="mx-auto max-w-xl py-10">
        <div classИмя="rounded-lg border border-border bg-card p-6">
          <h1 classИмя="text-xl font-semibold">Войти required</h1>
          <p classИмя="mt-2 text-sm text-muted-foreground">
            Войти or create an account, then return to this page to approve the CLI access request.
          </p>
          <Button asChild classИмя="mt-4">
            <Link to={`/auth?next=${encodeURIComponent(currentПуть)}`}>Войти / Создать account</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div classИмя="mx-auto max-w-xl py-10">
      <div classИмя="rounded-lg border border-border bg-card p-6">
        <h1 classИмя="text-xl font-semibold">Одобрить Paperclip CLI access</h1>
        <p classИмя="mt-2 text-sm text-muted-foreground">
          A local Paperclip CLI process is requesting board access to this instance.
        </p>

        <div classИмя="mt-5 space-y-3 text-sm">
          <div>
            <div classИмя="text-muted-foreground">Команда</div>
            <div classИмя="font-mono text-foreground">{challenge.command}</div>
          </div>
          <div>
            <div classИмя="text-muted-foreground">Client</div>
            <div classИмя="text-foreground">{challenge.clientИмя ?? "paperclipai cli"}</div>
          </div>
          <div>
            <div classИмя="text-muted-foreground">Requested access</div>
            <div classИмя="text-foreground">
              {challenge.requestedДоступ === "instance_admin_required" ? "Instance admin" : "Совет"}
            </div>
          </div>
          {challenge.requestedКомпанияИмя && (
            <div>
              <div classИмя="text-muted-foreground">Requested company</div>
              <div classИмя="text-foreground">{challenge.requestedКомпанияИмя}</div>
            </div>
          )}
        </div>

        {(approveMutation.error || cancelMutation.error) && (
          <p classИмя="mt-4 text-sm text-destructive">
            {(approveMutation.error ?? cancelMutation.error) instanceof Ошибка
              ? ((approveMutation.error ?? cancelMutation.error) as Ошибка).message
              : "Ошибка to update CLI auth challenge"}
          </p>
        )}

        {!challenge.canОдобрить && (
          <p classИмя="mt-4 text-sm text-destructive">
            This challenge requires instance-admin access. Войти with an instance admin account to approve it.
          </p>
        )}

        <div classИмя="mt-5 flex gap-3">
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={!challenge.canОдобрить || approveMutation.isОжидание || cancelMutation.isОжидание}
          >
            {approveMutation.isОжидание ? "Approving..." : "Одобрить CLI access"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => cancelMutation.mutate()}
            disabled={approveMutation.isОжидание || cancelMutation.isОжидание}
          >
            {cancelMutation.isОжидание ? "Отменаling..." : "Отмена"}
          </Button>
        </div>
      </div>
    </div>
  );
}
