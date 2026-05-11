import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AGENT_ADAPTER_TYPES } from "@paperclipai/shared";
import type { АгентАдаптерТип, JoinRequest } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { КомпанияPatternIcon } from "@/components/КомпанияPatternIcon";
import { useКомпания } from "@/context/КомпанияContext";
import { Link, useNavigate, useParams } from "@/lib/router";
import { accessApi } from "../api/access";
import { authApi } from "../api/auth";
import { companiesApi } from "../api/companies";
import { healthApi } from "../api/health";
import { getАдаптерLabel } from "../adapters/adapter-display-registry";
import { clearОжиданиеInviteТокен, rememberОжиданиеInviteТокен } from "../lib/invite-memory";
import { queryКлючs } from "../lib/queryКлючs";
import { formatDate } from "../lib/utils";

type AuthMode = "sign_in" | "sign_up";
type AuthFeedback = { tone: "error" | "info"; message: string };

const joinАдаптерOptions: АгентАдаптерТип[] = [...AGENT_ADAPTER_TYPES];
const ENABLED_INVITE_ADAPTERS = new Set([
  "claude_local",
  "codex_local",
  "gemini_local",
  "opencode_local",
  "pi_local",
  "cursor",
]);

function readNestedString(value: unknown, path: string[]): string | null {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" && current.trim().length > 0 ? current : null;
}

const fieldClassИмя =
  "w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500";
const panelClassИмя = "border border-zinc-800 bg-zinc-950/95 p-6";
const modeButtonBaseClassИмя =
  "flex-1 border px-3 py-2 text-sm transition-colors";

function formatЧеловекRole(role: string | null | undefined) {
  if (!role) return null;
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getAuthОшибкаCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.trim().length > 0 ? code : null;
}

function getAuthОшибкаMessage(error: unknown) {
  if (!(error instanceof Ошибка)) return null;
  const message = error.message.trim();
  return message.length > 0 ? message : null;
}

function mapInviteAuthFeedback(
  error: unknown,
  authMode: AuthMode,
  email: string,
): AuthFeedback {
  const code = getAuthОшибкаCode(error);
  const message = getAuthОшибкаMessage(error);
  const emailLabel = email.trim().length > 0 ? email.trim() : "that email";

  if (code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
    return {
      tone: "info",
      message: `An account already exists for ${emailLabel}. Войти below to continue with this invite.`,
    };
  }

  if (code === "INVALID_EMAIL_OR_PASSWORD") {
    return {
      tone: "error",
      message:
        "That email and password did not match an existing Paperclip account. Check both fields, or create an account first if you are new here.",
    };
  }

  if (authMode === "sign_in" && message === "Запрос не удался: 401") {
    return {
      tone: "error",
      message:
        "That email and password did not match an existing Paperclip account. Check both fields, or create an account first if you are new here.",
    };
  }

  if (authMode === "sign_up" && message === "Запрос не удался: 422") {
    return {
      tone: "info",
      message: `An account may already exist for ${emailLabel}. Try signing in instead.`,
    };
  }

  return {
    tone: "error",
    message: message ?? "Authentication failed",
  };
}

function isBootstrapПринятьancePayload(payload: unknown) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "bootstrapПринятьed" in (payload as Record<string, unknown>),
  );
}

function isОдобритьdЧеловекJoinPayload(payload: unknown, showsАгентForm: boolean) {
  if (!payload || typeof payload !== "object" || showsАгентForm) return false;
  const status = (payload as { status?: unknown }).status;
  return status === "approved";
}

type AwaitingJoinСогласованиеPanelProps = {
  companyDisplayИмя: string;
  companyLogoUrl: string | null;
  companyBrandColor: string | null;
  invitedByUserИмя: string | null;
  claimСекрет?: string | null;
  claimApiКлючПуть?: string | null;
  onboardingTextUrl?: string | null;
};

function InviteКомпанияLogo({
  companyDisplayИмя,
  companyLogoUrl,
  companyBrandColor,
  classИмя,
}: {
  companyDisplayИмя: string;
  companyLogoUrl: string | null;
  companyBrandColor: string | null;
  classИмя?: string;
}) {
  return (
    <КомпанияPatternIcon
      companyИмя={companyDisplayИмя}
      logoUrl={companyLogoUrl}
      brandColor={companyBrandColor}
      logoFit="contain"
      classИмя={classИмя}
    />
  );
}

function AwaitingJoinСогласованиеPanel({
  companyDisplayИмя,
  companyLogoUrl,
  companyBrandColor,
  invitedByUserИмя,
  claimСекрет = null,
  claimApiКлючПуть = null,
  onboardingTextUrl = null,
}: AwaitingJoinСогласованиеPanelProps) {
  const approvalUrl = `${window.location.origin}/company/settings/access`;
  const approverLabel = invitedByUserИмя ?? "A company admin";

  return (
    <div classИмя="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div classИмя="mx-auto max-w-md border border-zinc-800 bg-zinc-950 p-6" data-testid="invite-pending-approval">
        <div classИмя="flex items-center gap-3">
          <InviteКомпанияLogo
            companyDisplayИмя={companyDisplayИмя}
            companyLogoUrl={companyLogoUrl}
            companyBrandColor={companyBrandColor}
            classИмя="h-12 w-12 border border-zinc-800 rounded-none"
          />
          <h1 classИмя="text-lg font-semibold">Request to join {companyDisplayИмя}</h1>
        </div>
        <div classИмя="mt-4 space-y-3">
          <p classИмя="text-sm text-zinc-400">
            Your request is still awaiting approval. {approverLabel} must approve your request to join.
          </p>
          <div classИмя="border border-zinc-800 p-3">
            <p classИмя="text-xs text-zinc-500 mb-1">Согласование page</p>
            <a
              href={approvalUrl}
              classИмя="text-sm text-zinc-200 underline underline-offset-2 hover:text-zinc-100"
            >
              Компания Настройки → Доступ
            </a>
          </div>
          <p classИмя="text-sm text-zinc-400">
            Ask them to visit <a href={approvalUrl} classИмя="text-zinc-200 underline underline-offset-2 hover:text-zinc-100">Компания Настройки → Доступ</a> to approve your request.
          </p>
          <p classИмя="text-xs text-zinc-500">
            Обновить this page after you've been approved — you'll be redirected automatically.
          </p>
        </div>
        {claimСекрет && claimApiКлючПуть ? (
          <div classИмя="mt-4 space-y-1 border border-zinc-800 p-3 text-xs text-zinc-400">
            <div classИмя="text-zinc-200">Claim secret</div>
            <div classИмя="font-mono break-all">{claimСекрет}</div>
            <div classИмя="font-mono break-all">POST {claimApiКлючПуть}</div>
          </div>
        ) : null}
        {onboardingTextUrl ? (
          <div classИмя="mt-4 text-xs text-zinc-400">
            Onboarding: <span classИмя="font-mono break-all">{onboardingTextUrl}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function InviteLandingPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setSelectedКомпанияId } = useКомпания();
  const params = useParams();
  const token = (params.token ?? "").trim();
  const [authMode, setAuthMode] = useState<AuthMode>("sign_up");
  const [name, setИмя] = useState("");
  const [email, setПочта] = useState("");
  const [password, setPassword] = useState("");
  const [agentИмя, setАгентИмя] = useState("");
  const [adapterТип, setАдаптерТип] = useState<АгентАдаптерТип>("claude_local");
  const [capabilities, setCapabilities] = useState("");
  const [result, setResult] = useState<{ kind: "bootstrap" | "join"; payload: unknown } | null>(null);
  const [error, setОшибка] = useState<string | null>(null);
  const [authFeedback, setAuthFeedback] = useState<AuthFeedback | null>(null);
  const [autoПринятьЗапущен, setАвтоПринятьЗапущен] = useState(false);

  const healthQuery = useQuery({
    queryКлюч: queryКлючs.health,
    queryFn: () => healthApi.get(),
    retry: false,
  });
  const sessionQuery = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const inviteQuery = useQuery({
    queryКлюч: queryКлючs.access.invite(token),
    queryFn: () => accessApi.getInvite(token),
    enabled: token.length > 0,
    retry: false,
  });

  const companiesQuery = useQuery({
    queryКлюч: queryКлючs.companies.all,
    queryFn: () => companiesApi.list(),
    enabled: !!sessionQuery.data && !!inviteQuery.data?.companyId,
    retry: false,
  });

  useEffect(() => {
    if (token) rememberОжиданиеInviteТокен(token);
  }, [token]);

  useEffect(() => {
    setАвтоПринятьЗапущен(false);
  }, [token]);

  useEffect(() => {
    if (!companiesQuery.data || !inviteQuery.data?.companyId) return;
    const isMember = companiesQuery.data.some(
      (c) => c.id === inviteQuery.data!.companyId
    );
    if (isMember) {
      clearОжиданиеInviteТокен(token);
      navigate("/", { replace: true });
    }
  }, [companiesQuery.data, inviteQuery.data, token, navigate]);

  const invite = inviteQuery.data;
  const isCheckingExistingMembership =
    Boolean(sessionQuery.data) &&
    Boolean(invite?.companyId) &&
    companiesQuery.isЗагрузка;
  const isCurrentMember =
    Boolean(invite?.companyId) &&
    Boolean(
      companiesQuery.data?.some((company) => company.id === invite?.companyId),
    );
  const companyИмя = invite?.companyИмя?.trim() || null;
  const companyDisplayИмя = companyИмя || "this Paperclip company";
  const companyLogoUrl = invite?.companyLogoUrl?.trim() || null;
  const companyBrandColor = invite?.companyBrandColor?.trim() || null;
  const invitedByUserИмя = invite?.invitedByUserИмя?.trim() || null;
  const inviteMessage = invite?.inviteMessage?.trim() || null;
  const requestedЧеловекRole = formatЧеловекRole(invite?.humanRole);
  const inviteJoinRequestСтатус = invite?.joinRequestСтатус ?? null;
  const inviteJoinRequestТип = invite?.joinRequestТип ?? null;
  const requiresЧеловекАккаунт =
    healthQuery.data?.deploymentMode === "authenticated" &&
    !sessionQuery.data &&
    invite?.allowedJoinТипs !== "agent";
  const showsАгентForm = invite?.inviteТип !== "bootstrap_ceo" && invite?.allowedJoinТипs === "agent";
  const shouldАвтоПринятьЧеловекInvite =
    Boolean(sessionQuery.data) &&
    !showsАгентForm &&
    invite?.inviteТип !== "bootstrap_ceo" &&
    !inviteJoinRequestСтатус &&
    !isCheckingExistingMembership &&
    !isCurrentMember &&
    !result &&
    error === null;
  const sessionLabel =
    sessionQuery.data?.user.name?.trim() ||
    sessionQuery.data?.user.email?.trim() ||
    "this account";

  const authCanОтправить =
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    (authMode === "sign_in" || (name.trim().length > 0 && password.trim().length >= 8));

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!invite) throw new Ошибка("Invite not found");
      if (isCheckingExistingMembership) {
        throw new Ошибка("Checking your company access. Попробовать снова in a moment.");
      }
      if (isCurrentMember) {
        throw new Ошибка("This account already belongs to the company.");
      }
      if (invite.inviteТип === "bootstrap_ceo" || invite.allowedJoinТипs !== "agent") {
        return accessApi.acceptInvite(token, { requestТип: "human" });
      }
      return accessApi.acceptInvite(token, {
        requestТип: "agent",
        agentИмя: agentИмя.trim(),
        adapterТип,
        capabilities: capabilities.trim() || null,
      });
    },
    onУспешно: async (payload) => {
      setОшибка(null);
      clearОжиданиеInviteТокен(token);
      const asBootstrap = isBootstrapПринятьancePayload(payload);
      setResult({ kind: asBootstrap ? "bootstrap" : "join", payload });
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.auth.session });
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });
      if (invite?.companyId && isОдобритьdЧеловекJoinPayload(payload, showsАгентForm)) {
        setSelectedКомпанияId(invite.companyId, { source: "manual" });
        navigate("/", { replace: true });
      }
    },
    onОшибка: (err) => {
      setОшибка(err instanceof Ошибка ? err.message : "Ошибка to accept invite");
    },
  });

  useEffect(() => {
    if (!shouldАвтоПринятьЧеловекInvite || autoПринятьЗапущен || acceptMutation.isОжидание) return;
    setАвтоПринятьЗапущен(true);
    setОшибка(null);
    acceptMutation.mutate();
  }, [acceptMutation, autoПринятьЗапущен, shouldАвтоПринятьЧеловекInvite]);

  const authMutation = useMutation({
    mutationFn: async () => {
      if (authMode === "sign_in") {
        await authApi.signInПочта({ email: email.trim(), password });
        return;
      }
      await authApi.signUpПочта({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    },
    onУспешно: async () => {
      setAuthFeedback(null);
      rememberОжиданиеInviteТокен(token);
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.auth.session });
      const companies = await queryClient.fetchQuery({
        queryКлюч: queryКлючs.companies.all,
        queryFn: () => companiesApi.list(),
        retry: false,
      });

      if (invite?.companyId && companies.some((company) => company.id === invite.companyId)) {
        clearОжиданиеInviteТокен(token);
        setSelectedКомпанияId(invite.companyId, { source: "manual" });
        navigate("/", { replace: true });
        return;
      }

      if (!invite || invite.inviteТип !== "bootstrap_ceo") {
        return;
      }

      try {
        const payload = await acceptMutation.mutateAsync();
        if (isBootstrapПринятьancePayload(payload)) {
          navigate("/", { replace: true });
        }
      } catch {
        return;
      }
    },
    onОшибка: (err) => {
      const nextFeedback = mapInviteAuthFeedback(err, authMode, email);
      if (getAuthОшибкаCode(err) === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
        setAuthMode("sign_in");
        setPassword("");
      }
      setAuthFeedback(nextFeedback);
    },
  });

  const joinButtonLabel = useMemo(() => {
    if (!invite) return "Продолжить";
    if (invite.inviteТип === "bootstrap_ceo") return "Принять invite";
    if (showsАгентForm) return "Отправить request";
    return sessionQuery.data ? "Принять invite" : "Продолжить";
  }, [invite, sessionQuery.data, showsАгентForm]);

  if (!token) {
    return <div classИмя="mx-auto max-w-xl py-10 text-sm text-destructive">Invalid invite token.</div>;
  }

  if (inviteQuery.isЗагрузка || healthQuery.isЗагрузка || sessionQuery.isЗагрузка) {
    return <div classИмя="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Загрузка invite...</div>;
  }

  if (isCheckingExistingMembership) {
    return <div classИмя="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Checking your access...</div>;
  }

  if (inviteQuery.error || !invite) {
    return (
      <div classИмя="mx-auto max-w-xl py-10">
        <div classИмя="border border-border bg-card p-6" data-testid="invite-error">
          <h1 classИмя="text-lg font-semibold">Invite not available</h1>
          <p classИмя="mt-2 text-sm text-muted-foreground">
            This invite may be expired, revoked, or already used.
          </p>
        </div>
      </div>
    );
  }

  if (
    inviteJoinRequestСтатус === "approved" &&
    inviteJoinRequestТип === "human" &&
    isCurrentMember
  ) {
    return <div classИмя="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Opening company...</div>;
  }

  if (inviteJoinRequestСтатус === "pending_approval") {
    return (
      <AwaitingJoinСогласованиеPanel
        companyDisplayИмя={companyDisplayИмя}
        companyLogoUrl={companyLogoUrl}
        companyBrandColor={companyBrandColor}
        invitedByUserИмя={invitedByUserИмя}
      />
    );
  }

  if (inviteJoinRequestСтатус) {
    return (
      <div classИмя="mx-auto max-w-xl py-10">
        <div classИмя="border border-border bg-card p-6" data-testid="invite-error">
          <h1 classИмя="text-lg font-semibold">Invite not available</h1>
          <p classИмя="mt-2 text-sm text-muted-foreground">
            {inviteJoinRequestСтатус === "rejected"
              ? "This join request was not approved."
              : "This invite has already been used."}
          </p>
        </div>
      </div>
    );
  }

  if (result?.kind === "bootstrap") {
    return (
      <div classИмя="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
        <div classИмя="mx-auto max-w-md border border-zinc-800 bg-zinc-950 p-6">
          <h1 classИмя="text-lg font-semibold">Bootstrap complete</h1>
          <div classИмя="mt-4">
            <Button asChild classИмя="rounded-none">
              <Link to="/">Open board</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (result?.kind === "join") {
    const payload = result.payload as JoinRequest & {
      claimСекрет?: string;
      claimApiКлючПуть?: string;
      onboarding?: Record<string, unknown>;
    };
    const claimСекрет = typeof payload.claimСекрет === "string" ? payload.claimСекрет : null;
    const claimApiКлючПуть = typeof payload.claimApiКлючПуть === "string" ? payload.claimApiКлючПуть : null;
    const onboardingTextUrl = readNestedString(payload.onboarding, ["textInstructions", "url"]);
    const joinedСейчас = !showsАгентForm && payload.status === "approved";

    return (
      joinedСейчас ? (
        <div classИмя="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
          <div classИмя="mx-auto max-w-md border border-zinc-800 bg-zinc-950 p-6">
            <div classИмя="flex items-center gap-3">
              <InviteКомпанияLogo
                companyDisplayИмя={companyDisplayИмя}
                companyLogoUrl={companyLogoUrl}
                companyBrandColor={companyBrandColor}
                classИмя="h-12 w-12 border border-zinc-800 rounded-none"
              />
              <h1 classИмя="text-lg font-semibold">You joined the company</h1>
            </div>
            <div classИмя="mt-4">
              <Button asChild classИмя="w-full rounded-none">
                <Link to="/">Open board</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <AwaitingJoinСогласованиеPanel
          companyDisplayИмя={companyDisplayИмя}
          companyLogoUrl={companyLogoUrl}
          companyBrandColor={companyBrandColor}
          invitedByUserИмя={invitedByUserИмя}
          claimСекрет={claimСекрет}
          claimApiКлючПуть={claimApiКлючПуть}
          onboardingTextUrl={onboardingTextUrl}
        />
      )
    );
  }

  return (
    <div classИмя="min-h-screen bg-zinc-950 px-6 py-12 text-zinc-100">
      <div classИмя="mx-auto max-w-5xl">
        <div classИмя="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <section classИмя={`${panelClassИмя} space-y-6`}>
            <div classИмя="flex items-start gap-4">
              <InviteКомпанияLogo
                companyDisplayИмя={companyDisplayИмя}
                companyLogoUrl={companyLogoUrl}
                companyBrandColor={companyBrandColor}
                classИмя="h-16 w-16 rounded-none border border-zinc-800"
              />
              <div classИмя="min-w-0">
                <p classИмя="text-xs uppercase tracking-[0.24em] text-zinc-500">
                  You&apos;ve been invited to join Paperclip
                </p>
                <h1 classИмя="mt-2 text-2xl font-semibold">
                  {invite.inviteТип === "bootstrap_ceo" ? "Set up Paperclip" : `Join ${companyDisplayИмя}`}
                </h1>
                <p classИмя="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">
                  {showsАгентForm
                    ? "Review the invite details, then submit the agent information below to start the join request."
                    : requiresЧеловекАккаунт
                      ? "Создайте аккаунт Paperclip first. If you already have one, switch to sign in and continue the invite with the same email."
                      : "Your account is ready. Review the invite details, then accept it to continue."}
                </p>
              </div>
            </div>

            <div classИмя="grid gap-3 sm:grid-cols-2">
              <div classИмя="border border-zinc-800 p-3">
                <div classИмя="text-xs uppercase tracking-[0.2em] text-zinc-500">Компания</div>
                <div classИмя="mt-1 text-sm text-zinc-100">{companyDisplayИмя}</div>
              </div>
              <div classИмя="border border-zinc-800 p-3">
                <div classИмя="text-xs uppercase tracking-[0.2em] text-zinc-500">Invited by</div>
                <div classИмя="mt-1 text-sm text-zinc-100">{invitedByUserИмя ?? "Paperclip board"}</div>
              </div>
              <div classИмя="border border-zinc-800 p-3">
                <div classИмя="text-xs uppercase tracking-[0.2em] text-zinc-500">Requested access</div>
                <div classИмя="mt-1 text-sm text-zinc-100">
                  {showsАгентForm ? "Заявка агента" : requestedЧеловекRole ?? "Компания access"}
                </div>
              </div>
              <div classИмя="border border-zinc-800 p-3">
                <div classИмя="text-xs uppercase tracking-[0.2em] text-zinc-500">Invite expires</div>
                <div classИмя="mt-1 text-sm text-zinc-100">{formatDate(invite.expiresAt)}</div>
              </div>
            </div>

            {inviteMessage ? (
              <div classИмя="border border-amber-500/40 bg-amber-500/10 p-4">
                <div classИмя="text-xs uppercase tracking-[0.2em] text-amber-200/80">Message from inviter</div>
                <p classИмя="mt-2 text-sm leading-6 text-amber-50">{inviteMessage}</p>
              </div>
            ) : null}

            {sessionQuery.data ? (
              <div classИмя="border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-50">
                Выполнен вход as <span classИмя="font-medium">{sessionLabel}</span>.
              </div>
            ) : null}
          </section>

          <section classИмя={`${panelClassИмя} h-fit`}>
            {showsАгентForm ? (
              <div classИмя="space-y-4">
                <div>
                  <h2 classИмя="text-lg font-semibold">Отправить agent details</h2>
                  <p classИмя="mt-1 text-sm text-zinc-400">
                    This invite will create an approval request for a new agent in {companyDisplayИмя}.
                  </p>
                </div>
                <label classИмя="block text-sm">
                  <span classИмя="mb-1 block text-zinc-400">Агент name</span>
                  <input
                    classИмя={fieldClassИмя}
                    value={agentИмя}
                    onChange={(event) => setАгентИмя(event.target.value)}
                  />
                </label>
                <label classИмя="block text-sm">
                  <span classИмя="mb-1 block text-zinc-400">Адаптер type</span>
                  <select
                    classИмя={fieldClassИмя}
                    value={adapterТип}
                    onChange={(event) => setАдаптерТип(event.target.value as АгентАдаптерТип)}
                  >
                    {joinАдаптерOptions.map((type) => (
                      <option key={type} value={type} disabled={!ENABLED_INVITE_ADAPTERS.has(type)}>
                        {getАдаптерLabel(type)}{!ENABLED_INVITE_ADAPTERS.has(type) ? " (Скоро)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label classИмя="block text-sm">
                  <span classИмя="mb-1 block text-zinc-400">Capabilities</span>
                  <textarea
                    classИмя={fieldClassИмя}
                    rows={4}
                    value={capabilities}
                    onChange={(event) => setCapabilities(event.target.value)}
                  />
                </label>
                {error ? <p classИмя="text-xs text-red-400">{error}</p> : null}
                <Button
                  classИмя="w-full rounded-none"
                  disabled={acceptMutation.isОжидание || agentИмя.trim().length === 0}
                  onClick={() => acceptMutation.mutate()}
                >
                  {acceptMutation.isОжидание ? "Работаing..." : joinButtonLabel}
                </Button>
              </div>
            ) : requiresЧеловекАккаунт ? (
              <div classИмя="space-y-5">
                <div>
                  <h2 classИмя="text-lg font-semibold">
                    {authMode === "sign_up" ? "Создайте аккаунт" : "Войдите чтобы продолжить"}
                  </h2>
                  <p classИмя="mt-1 text-sm text-zinc-400">
                    {authMode === "sign_up"
                      ? `Начать with a Paperclip account. After that, you'll come right back here to accept the invite for ${companyDisplayИмя}.`
                      : "Use the Paperclip account that already matches this invite. If you do not have one yet, switch back to create account."}
                  </p>
                </div>

                <div classИмя="flex gap-2">
                  <button
                    type="button"
                    classИмя={`${modeButtonBaseClassИмя} ${
                      authMode === "sign_up"
                        ? "border-zinc-100 bg-zinc-100 text-zinc-950"
                        : "border-zinc-800 text-zinc-300 hover:border-zinc-600"
                    }`}
                    onClick={() => {
                      setAuthFeedback(null);
                      setAuthMode("sign_up");
                    }}
                  >
                    Создать account
                  </button>
                  <button
                    type="button"
                    classИмя={`${modeButtonBaseClassИмя} ${
                      authMode === "sign_in"
                        ? "border-zinc-100 bg-zinc-100 text-zinc-950"
                        : "border-zinc-800 text-zinc-300 hover:border-zinc-600"
                    }`}
                    onClick={() => {
                      setAuthFeedback(null);
                      setAuthMode("sign_in");
                    }}
                  >
                    I already have an account
                  </button>
                </div>

                <form
                  classИмя="space-y-4"
                  method="post"
                  action={authMode === "sign_up" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email"}
                  onОтправить={(event) => {
                    event.preventПо умолчанию();
                    if (authMutation.isОжидание) return;
                    if (!authCanОтправить) {
                      setAuthFeedback({ tone: "error", message: "Заполните все обязательные поля." });
                      return;
                    }
                    authMutation.mutate();
                  }}
                  data-testid="invite-inline-auth"
                >
                  {authMode === "sign_up" ? (
                    <label classИмя="block text-sm">
                      <span classИмя="mb-1 block text-zinc-400">Имя</span>
                      <input
                        name="name"
                        classИмя={fieldClassИмя}
                        value={name}
                        onChange={(event) => {
                          setИмя(event.target.value);
                          setAuthFeedback(null);
                        }}
                        autoComplete="name"
                        autoFocus
                      />
                    </label>
                  ) : null}
                  <label classИмя="block text-sm">
                    <span classИмя="mb-1 block text-zinc-400">Почта</span>
                    <input
                      name="email"
                      type="email"
                      classИмя={fieldClassИмя}
                      value={email}
                      onChange={(event) => {
                        setПочта(event.target.value);
                        setAuthFeedback(null);
                      }}
                      autoComplete="email"
                      autoFocus={authMode === "sign_in"}
                    />
                  </label>
                  <label classИмя="block text-sm">
                    <span classИмя="mb-1 block text-zinc-400">Password</span>
                    <input
                      name="password"
                      type="password"
                      classИмя={fieldClassИмя}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setAuthFeedback(null);
                      }}
                      autoComplete={authMode === "sign_in" ? "current-password" : "new-password"}
                    />
                  </label>
                  {authFeedback ? (
                    <p
                      classИмя={`text-xs ${
                        authFeedback.tone === "info" ? "text-amber-300" : "text-red-400"
                      }`}
                    >
                      {authFeedback.message}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    classИмя="w-full rounded-none"
                    disabled={authMutation.isОжидание}
                    aria-disabled={!authCanОтправить || authMutation.isОжидание}
                  >
                    {authMutation.isОжидание
                      ? "Работаing..."
                      : authMode === "sign_in"
                        ? "Войти и продолжить"
                        : "Создать account and continue"}
                  </Button>
                </form>

                <p classИмя="text-xs leading-5 text-zinc-500">
                  {authMode === "sign_up"
                    ? "Already signed up before? Use the existing-account option instead so the invite lands on the right Paperclip user."
                    : "Нет account yet? Switch back to create account so you can accept the invite with a new login."}
                </p>
              </div>
            ) : (
              <div classИмя="space-y-4">
                <div>
                  <h2 classИмя="text-lg font-semibold">
                    {shouldАвтоПринятьЧеловекInvite
                      ? "Отправитьting join request"
                      : invite.inviteТип === "bootstrap_ceo"
                        ? "Принять bootstrap invite"
                        : "Принять company invite"}
                  </h2>
                  <p classИмя="mt-1 text-sm text-zinc-400">
                    {shouldАвтоПринятьЧеловекInvite
                      ? `Отправитьting your join request for ${companyDisplayИмя}.`
                      : isCurrentMember
                      ? `This account already belongs to ${companyDisplayИмя}.`
                      : `This will ${
                          invite.inviteТип === "bootstrap_ceo" ? "finish setting up Paperclip" : `submit or complete your join request for ${companyDisplayИмя}`
                        }.`}
                  </p>
                </div>
                {error ? <p classИмя="text-xs text-red-400">{error}</p> : null}
                {shouldАвтоПринятьЧеловекInvite ? (
                  <div classИмя="text-sm text-zinc-400">
                    {acceptMutation.isОжидание ? "Отправитьting request..." : "Finishing sign-in..."}
                  </div>
                ) : (
                  <Button
                    classИмя="w-full rounded-none"
                    disabled={acceptMutation.isОжидание || isCurrentMember}
                    onClick={() => acceptMutation.mutate()}
                  >
                    {acceptMutation.isОжидание ? "Работаing..." : joinButtonLabel}
                  </Button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
