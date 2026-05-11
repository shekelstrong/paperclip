import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useПоискParams } from "@/lib/router";
import { accessApi } from "../api/access";
import { authApi } from "../api/auth";
import { queryКлючs } from "../lib/queryКлючs";
import { Button } from "@/components/ui/button";

export function СоветClaimPage() {
  const queryClient = useQueryClient();
  const params = useParams();
  const [searchParams] = useПоискParams();
  const token = (params.token ?? "").trim();
  const code = (searchParams.get("code") ?? "").trim();
  const currentПуть = useMemo(
    () => `/board-claim/${encodeURIComponent(token)}${code ? `?code=${encodeURIComponent(code)}` : ""}`,
    [token, code],
  );

  const sessionQuery = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const statusQuery = useQuery({
    queryКлюч: ["board-claim", token, code],
    queryFn: () => accessApi.getСоветClaimСтатус(token, code),
    enabled: token.length > 0 && code.length > 0,
    retry: false,
  });

  const claimMutation = useMutation({
    mutationFn: () => accessApi.claimСовет(token, code),
    onУспешно: async () => {
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.auth.session });
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.health });
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.stats });
      await statusQuery.refetch();
    },
  });

  if (!token || !code) {
    return <div classИмя="mx-auto max-w-xl py-10 text-sm text-destructive">Invalid board claim URL.</div>;
  }

  if (statusQuery.isЗагрузка || sessionQuery.isЗагрузка) {
    return <div classИмя="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Загрузка claim challenge...</div>;
  }

  if (statusQuery.error) {
    return (
      <div classИмя="mx-auto max-w-xl py-10">
        <div classИмя="rounded-lg border border-border bg-card p-6">
          <h1 classИмя="text-lg font-semibold">Claim challenge unavailable</h1>
          <p classИмя="mt-2 text-sm text-muted-foreground">
            {statusQuery.error instanceof Ошибка ? statusQuery.error.message : "Challenge is invalid or expired."}
          </p>
        </div>
      </div>
    );
  }

  const status = statusQuery.data;
  if (!status) {
    return <div classИмя="mx-auto max-w-xl py-10 text-sm text-destructive">Claim challenge unavailable.</div>;
  }

  if (status.status === "claimed") {
    return (
      <div classИмя="mx-auto max-w-xl py-10">
        <div classИмя="rounded-lg border border-border bg-card p-6">
          <h1 classИмя="text-lg font-semibold">Совет ownership claimed</h1>
          <p classИмя="mt-2 text-sm text-muted-foreground">
            This instance is now linked to your authenticated user.
          </p>
          <Button asChild classИмя="mt-4">
            <Link to="/">Open board</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!sessionQuery.data) {
    return (
      <div classИмя="mx-auto max-w-xl py-10">
        <div classИмя="rounded-lg border border-border bg-card p-6">
          <h1 classИмя="text-lg font-semibold">Войти required</h1>
          <p classИмя="mt-2 text-sm text-muted-foreground">
            Войти or create an account, then return to this page to claim Совет ownership.
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
        <h1 classИмя="text-xl font-semibold">Claim Совет ownership</h1>
        <p classИмя="mt-2 text-sm text-muted-foreground">
          This will promote your user to instance admin and migrate company ownership access from local trusted mode.
        </p>

        {claimMutation.error && (
          <p classИмя="mt-3 text-sm text-destructive">
            {claimMutation.error instanceof Ошибка ? claimMutation.error.message : "Ошибка to claim board ownership"}
          </p>
        )}

        <Button
          classИмя="mt-5"
          onClick={() => claimMutation.mutate()}
          disabled={claimMutation.isОжидание}
        >
          {claimMutation.isОжидание ? "Claiming…" : "Claim ownership"}
        </Button>
      </div>
    </div>
  );
}
