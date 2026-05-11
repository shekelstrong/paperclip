import type { ReactНетde } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardОписание, CardHeader, CardНазвание } from "@/components/ui/card";
import { КомпанияPatternIcon } from "@/components/КомпанияPatternIcon";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  Clock3,
  ExternalLink,
  FlaskConical,
  КлючRound,
  Link2,
  Loader2,
  MailPlus,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

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

const inviteИстория = [
  {
    id: "invite-active",
    state: "Активен",
    humanRole: "operator",
    invitedBy: "Совет User 25",
    email: "board25@paperclip.local",
    createdAt: "Apr 25, 2026, 9:00 AM",
    action: "Revoke",
    relatedLabel: "Review request",
  },
  {
    id: "invite-accepted",
    state: "Принятьed",
    humanRole: "viewer",
    invitedBy: "Совет User 24",
    email: "board24@paperclip.local",
    createdAt: "Apr 24, 2026, 8:15 AM",
    action: "Inactive",
    relatedLabel: "—",
  },
  {
    id: "invite-revoked",
    state: "Revoked",
    humanRole: "admin",
    invitedBy: "Совет User 20",
    email: "board20@paperclip.local",
    createdAt: "Apr 20, 2026, 2:45 PM",
    action: "Inactive",
    relatedLabel: "—",
  },
  {
    id: "invite-expired",
    state: "Expired",
    humanRole: "owner",
    invitedBy: "Совет User 19",
    email: "board19@paperclip.local",
    createdAt: "Apr 19, 2026, 7:10 PM",
    action: "Inactive",
    relatedLabel: "—",
  },
] as const;

const fieldClassИмя =
  "w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500";
const panelClassИмя = "border border-zinc-800 bg-zinc-950/95 p-6";

function LabSection({
  eyebrow,
  title,
  description,
  accentClassИмя,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  accentClassИмя?: string;
  children: ReactНетde;
}) {
  return (
    <section
      classИмя={cn(
        "rounded-[28px] border border-border/70 bg-background/80 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-5",
        accentClassИмя,
      )}
    >
      <div classИмя="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div classИмя="min-w-0">
          <div classИмя="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </div>
          <h2 classИмя="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
          <p classИмя="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function СтатусCard({
  icon,
  title,
  body,
  tone = "default",
}: {
  icon: ReactНетde;
  title: string;
  body: string;
  tone?: "default" | "warn" | "success" | "error";
}) {
  const toneClassИмя = {
    default: "border-border/70 bg-background/85",
    warn: "border-amber-400/40 bg-amber-500/[0.08]",
    success: "border-emerald-400/40 bg-emerald-500/[0.08]",
    error: "border-rose-400/40 bg-rose-500/[0.08]",
  }[tone];

  return (
    <Card classИмя={cn("rounded-[24px] shadow-none", toneClassИмя)}>
      <CardHeader classИмя="space-y-3">
        <div classИмя="flex h-10 w-10 items-center justify-center rounded-full border border-current/10 bg-background/70 text-muted-foreground">
          {icon}
        </div>
        <div>
          <CardНазвание classИмя="text-base">{title}</CardНазвание>
          <CardОписание classИмя="mt-2 text-sm leading-6">{body}</CardОписание>
        </div>
      </CardHeader>
    </Card>
  );
}

function InviteLandingShell({
  left,
  right,
}: {
  left: ReactНетde;
  right: ReactНетde;
}) {
  return (
    <div classИмя="overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-950 shadow-[0_30px_80px_rgba(2,6,23,0.55)]">
      <div classИмя="grid gap-px bg-zinc-800 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section classИмя={cn(panelClassИмя, "space-y-6 bg-zinc-950")}>{left}</section>
        <section classИмя={cn(panelClassИмя, "h-full bg-zinc-950")}>{right}</section>
      </div>
    </div>
  );
}

function InviteSummaryPanel({
  title,
  description,
  inviteMessage,
  requestedДоступ,
  signedInLabel,
}: {
  title: string;
  description: string;
  inviteMessage?: string;
  requestedДоступ: string;
  signedInLabel?: string;
}) {
  return (
    <>
      <div classИмя="flex items-start gap-4">
        <КомпанияPatternIcon
          companyИмя="Acme Robotics"
          logoUrl="/api/invites/pcp_invite_test/logo"
          brandColor="#114488"
          classИмя="h-16 w-16 rounded-none border border-zinc-800"
        />
        <div classИмя="min-w-0">
          <p classИмя="text-xs uppercase tracking-[0.24em] text-zinc-500">You&apos;ve been invited to join Paperclip</p>
          <h3 classИмя="mt-2 text-2xl font-semibold text-zinc-100">{title}</h3>
          <p classИмя="mt-2 max-w-2xl text-sm leading-6 text-zinc-300">{description}</p>
        </div>
      </div>

      <div classИмя="grid gap-3 sm:grid-cols-2">
        <MetaCard label="Компания" value="Acme Robotics" />
        <MetaCard label="Invited by" value="Совет User" />
        <MetaCard label="Requested access" value={requestedДоступ} />
        <MetaCard label="Invite expires" value="Mar 7, 2027" />
      </div>

      {inviteMessage ? (
        <div classИмя="border border-amber-500/40 bg-amber-500/10 p-4">
          <div classИмя="text-xs uppercase tracking-[0.2em] text-amber-200/80">Message from inviter</div>
          <p classИмя="mt-2 text-sm leading-6 text-amber-50">{inviteMessage}</p>
        </div>
      ) : null}

      {signedInLabel ? (
        <div classИмя="border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-50">
          Выполнен вход as <span classИмя="font-medium">{signedInLabel}</span>.
        </div>
      ) : null}
    </>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div classИмя="border border-zinc-800 p-3">
      <div classИмя="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</div>
      <div classИмя="mt-1 text-sm text-zinc-100">{value}</div>
    </div>
  );
}

function InlineAuthПредпросмотр({
  mode,
  feedback,
  working,
}: {
  mode: "sign_up" | "sign_in";
  feedback?: { tone: "info" | "error"; text: string };
  working?: boolean;
}) {
  return (
    <div classИмя="space-y-5">
      <div>
        <h3 classИмя="text-lg font-semibold text-zinc-100">
          {mode === "sign_up" ? "Создайте аккаунт" : "Войдите чтобы продолжить"}
        </h3>
        <p classИмя="mt-1 text-sm text-zinc-400">
          {mode === "sign_up"
            ? "Начать with a Paperclip account. After that, you'll come right back here to accept the invite for Acme Robotics."
            : "Use the Paperclip account that already matches this invite. If you do not have one yet, switch back to create account."}
        </p>
      </div>

      <div classИмя="flex gap-2">
        <button
          type="button"
          classИмя={cn(
            "flex-1 border px-3 py-2 text-sm transition-colors",
            mode === "sign_up"
              ? "border-zinc-100 bg-zinc-100 text-zinc-950"
              : "border-zinc-800 text-zinc-300 hover:border-zinc-600",
          )}
        >
          Создать account
        </button>
        <button
          type="button"
          classИмя={cn(
            "flex-1 border px-3 py-2 text-sm transition-colors",
            mode === "sign_in"
              ? "border-zinc-100 bg-zinc-100 text-zinc-950"
              : "border-zinc-800 text-zinc-300 hover:border-zinc-600",
          )}
        >
          I already have an account
        </button>
      </div>

      <form classИмя="space-y-4">
        {mode === "sign_up" ? (
          <label classИмя="block text-sm">
            <span classИмя="mb-1 block text-zinc-400">Имя</span>
            <input name="name" classИмя={fieldClassИмя} defaultЗначение="Jane Example" readOnly />
          </label>
        ) : null}
        <label classИмя="block text-sm">
          <span classИмя="mb-1 block text-zinc-400">Почта</span>
          <input name="email" type="email" classИмя={fieldClassИмя} defaultЗначение="jane@example.com" readOnly />
        </label>
        <label classИмя="block text-sm">
          <span classИмя="mb-1 block text-zinc-400">Password</span>
          <input name="password" type="password" classИмя={fieldClassИмя} defaultЗначение="supersecret" readOnly />
        </label>
        {feedback ? (
          <p classИмя={cn("text-xs", feedback.tone === "info" ? "text-amber-300" : "text-red-400")}>
            {feedback.text}
          </p>
        ) : null}
        <Button type="button" classИмя="w-full rounded-none" disabled={working}>
          {working ? "Работаing..." : mode === "sign_in" ? "Войти и продолжить" : "Создать account and continue"}
        </Button>
      </form>

      <p classИмя="text-xs leading-5 text-zinc-500">
        {mode === "sign_up"
          ? "Already signed up before? Use the existing-account option instead so the invite lands on the right Paperclip user."
          : "Нет account yet? Switch back to create account so you can accept the invite with a new login."}
      </p>
    </div>
  );
}

function АгентRequestПредпросмотр() {
  return (
    <div classИмя="space-y-4">
      <div>
        <h3 classИмя="text-lg font-semibold text-zinc-100">Отправить agent details</h3>
        <p classИмя="mt-1 text-sm text-zinc-400">
          This invite will create an approval request for a new agent in Acme Robotics.
        </p>
      </div>
      <label classИмя="block text-sm">
        <span classИмя="mb-1 block text-zinc-400">Агент name</span>
        <input classИмя={fieldClassИмя} defaultЗначение="Acme Ops Агент" readOnly />
      </label>
      <label classИмя="block text-sm">
        <span classИмя="mb-1 block text-zinc-400">Адаптер type</span>
        <select classИмя={fieldClassИмя} defaultЗначение="codex_local" disabled>
          <option value="codex_local">Codex</option>
          <option value="claude_local">Claude Code</option>
          <option value="cursor">Cursor</option>
        </select>
      </label>
      <label classИмя="block text-sm">
        <span classИмя="mb-1 block text-zinc-400">Capabilities</span>
        <textarea
          classИмя={fieldClassИмя}
          rows={4}
          defaultЗначение="Reviews invites, triages requests, and keeps the board queue moving."
          readOnly
        />
      </label>
      <Button type="button" classИмя="w-full rounded-none">
        Отправить request
      </Button>
    </div>
  );
}

function ПринятьInviteПредпросмотр({
  autoПринять,
  isCurrentMember,
  error,
}: {
  autoПринять?: boolean;
  isCurrentMember?: boolean;
  error?: string;
}) {
  return (
    <div classИмя="space-y-4">
      <div>
        <h3 classИмя="text-lg font-semibold text-zinc-100">Принять company invite</h3>
        <p classИмя="mt-1 text-sm text-zinc-400">
          {autoПринять
            ? "Отправитьting your join request for Acme Robotics."
            : isCurrentMember
              ? "This account already belongs to Acme Robotics."
              : "This will submit or complete your join request for Acme Robotics."}
        </p>
      </div>
      {error ? <p classИмя="text-xs text-red-400">{error}</p> : null}
      {autoПринять ? (
        <div classИмя="text-sm text-zinc-400">Отправитьting request...</div>
      ) : (
        <Button type="button" classИмя="w-full rounded-none" disabled={isCurrentMember}>
          Принять invite
        </Button>
      )}
    </div>
  );
}

function InviteResultПредпросмотр({
  title,
  description,
  claimСекрет,
  onboardingTextUrl,
  joinedСейчас = false,
}: {
  title: string;
  description: string;
  claimСекрет?: string;
  onboardingTextUrl?: string;
  joinedСейчас?: boolean;
}) {
  return (
    <div classИмя="mx-auto max-w-md border border-zinc-800 bg-zinc-950 p-6 text-zinc-100">
      <div classИмя="flex items-center gap-3">
        <КомпанияPatternIcon
          companyИмя="Acme Robotics"
          logoUrl="/api/invites/pcp_invite_test/logo"
          brandColor="#114488"
          classИмя="h-12 w-12 rounded-none border border-zinc-800"
        />
        <h3 classИмя="text-lg font-semibold">{title}</h3>
      </div>
      <div classИмя="mt-4 space-y-3">
        <p classИмя="text-sm text-zinc-400">{description}</p>
        {joinedСейчас ? (
          <Button type="button" classИмя="w-full rounded-none">
            Open board
          </Button>
        ) : (
          <>
            <div classИмя="border border-zinc-800 p-3">
              <p classИмя="mb-1 text-xs text-zinc-500">Согласование page</p>
              <a classИмя="text-sm text-zinc-200 underline underline-offset-2" href="/company/settings/access">
                Компания Настройки → Доступ
              </a>
            </div>
            <p classИмя="text-xs text-zinc-500">
              Обновить this page after you&apos;ve been approved — you&apos;ll be redirected automatically.
            </p>
          </>
        )}
        {claimСекрет ? (
          <div classИмя="space-y-1 border border-zinc-800 p-3 text-xs text-zinc-400">
            <div classИмя="text-zinc-200">Claim secret</div>
            <div classИмя="font-mono break-all">{claimСекрет}</div>
            <div classИмя="font-mono break-all">POST /api/agents/claim-api-key</div>
          </div>
        ) : null}
        {onboardingTextUrl ? (
          <div classИмя="text-xs text-zinc-400">
            Onboarding: <span classИмя="font-mono break-all">{onboardingTextUrl}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AuthScreenПредпросмотр({ mode, error }: { mode: "sign_in" | "sign_up"; error?: string }) {
  return (
    <div classИмя="overflow-hidden rounded-[28px] border border-border/70 bg-background shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <div classИмя="grid gap-px bg-border/60 md:grid-cols-2">
        <div classИмя="flex min-h-[420px] flex-col justify-center bg-background px-8 py-10">
          <div classИмя="mx-auto w-full max-w-md">
            <div classИмя="mb-8 flex items-center gap-2">
              <FlaskConical classИмя="h-4 w-4 text-muted-foreground" />
              <span classИмя="text-sm font-medium">Paperclip</span>
            </div>
            <h3 classИмя="text-xl font-semibold">
              {mode === "sign_in" ? "Вход в Paperclip" : "Создайте аккаунт Paperclip"}
            </h3>
            <p classИмя="mt-1 text-sm text-muted-foreground">
              {mode === "sign_in"
                ? "Use your email and password to access this instance."
                : "Создать an account for this instance. Почта confirmation is not required in v1."}
            </p>
            <div classИмя="mt-6 space-y-4">
              {mode === "sign_up" ? (
                <label classИмя="block">
                  <span classИмя="mb-1 block text-xs text-muted-foreground">Имя</span>
                  <input
                    classИмя="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                    defaultЗначение="Jane Example"
                    readOnly
                  />
                </label>
              ) : null}
              <label classИмя="block">
                <span classИмя="mb-1 block text-xs text-muted-foreground">Почта</span>
                <input
                  classИмя="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                  defaultЗначение="jane@example.com"
                  readOnly
                />
              </label>
              <label classИмя="block">
                <span classИмя="mb-1 block text-xs text-muted-foreground">Password</span>
                <input
                  classИмя="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                  defaultЗначение="supersecret"
                  readOnly
                />
              </label>
              {error ? <p classИмя="text-xs text-destructive">{error}</p> : null}
              <Button type="button" classИмя="w-full">
                {mode === "sign_in" ? "Войти" : "Создать аккаунт"}
              </Button>
            </div>
            <div classИмя="mt-5 text-sm text-muted-foreground">
              {mode === "sign_in" ? "Нужен аккаунт?" : "Уже есть аккаунт?"}{" "}
              <span classИмя="font-medium text-foreground underline underline-offset-2">
                {mode === "sign_in" ? "Создать задачу" : "Войти"}
              </span>
            </div>
          </div>
        </div>
        <div classИмя="hidden min-h-[420px] items-center justify-center bg-[radial-gradient(circle_at_top,rgba(8,145,178,0.18),transparent_48%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,1))] px-8 py-10 md:flex">
          <div classИмя="max-w-sm space-y-4 text-zinc-200">
            <div classИмя="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/[0.08] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-cyan-200">
              Auth preview
            </div>
            <div classИмя="text-2xl font-semibold">Side-by-side signup styling review</div>
            <p classИмя="text-sm leading-6 text-zinc-400">
              This frame mirrors the production auth surface so spacing, label density, button treatments, and desktop composition are easy to compare.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function КомпанияInvitesПредпросмотр() {
  return (
    <div classИмя="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <Card classИмя="rounded-[28px] shadow-none">
        <CardHeader classИмя="space-y-3">
          <div classИмя="flex items-center gap-2 text-sm text-muted-foreground">
            <MailPlus classИмя="h-4 w-4" />
            Компания Invites
          </div>
          <div>
            <CardНазвание>Создать invite</CardНазвание>
            <CardОписание classИмя="mt-2">
              Generate a human invite link and choose the default access it should request.
            </CardОписание>
          </div>
        </CardHeader>
        <CardContent classИмя="space-y-4">
          <fieldset classИмя="space-y-3">
            <legend classИмя="text-sm font-medium">Choose a role</legend>
            <div classИмя="rounded-2xl border border-border">
              {inviteRoleOptions.map((option, index) => (
                <label
                  key={option.value}
                  classИмя={cn("flex cursor-default gap-3 px-4 py-4", index > 0 && "border-t border-border")}
                >
                  <input
                    type="radio"
                    readOnly
                    checked={option.value === "operator"}
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
              ))}
            </div>
          </fieldset>

          <div classИмя="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
            Each invite link is single-use. The first successful use consumes the link and creates or reuses the matching join request before approval.
          </div>

          <div classИмя="flex flex-wrap items-center gap-3">
            <Button type="button">Создать invite</Button>
            <span classИмя="text-sm text-muted-foreground">Invite history below keeps the audit trail.</span>
          </div>

          <div classИмя="space-y-3 rounded-2xl border border-border px-4 py-4">
            <div classИмя="flex items-center justify-between gap-3">
              <div>
                <div classИмя="text-sm font-medium">Latest invite link</div>
                <div classИмя="text-sm text-muted-foreground">
                  This URL includes the current Paperclip domain returned by the server.
                </div>
              </div>
              <div classИмя="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                <Check classИмя="h-3.5 w-3.5" />
                Copied
              </div>
            </div>
            <button
              type="button"
              classИмя="w-full rounded-md border border-border bg-muted/60 px-3 py-2 text-left text-sm break-all"
            >
              https://paperclip.local/invite/new-token
            </button>
            <div classИмя="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline">
                <ExternalLink classИмя="h-4 w-4" />
                Open invite
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card classИмя="rounded-[28px] shadow-none">
        <CardHeader classИмя="space-y-3">
          <div classИмя="flex items-center justify-between gap-3">
            <div>
              <CardНазвание>Invite history</CardНазвание>
              <CardОписание classИмя="mt-2">
                Review invite status, role, inviter, and any linked join request.
              </CardОписание>
            </div>
            <a href="/inbox/requests" classИмя="text-sm underline underline-offset-4">
              Open join request queue
            </a>
          </div>
        </CardHeader>
        <CardContent classИмя="space-y-4">
          <div classИмя="overflow-x-auto rounded-2xl border border-border">
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
                        {invite.state}
                      </span>
                    </td>
                    <td classИмя="px-5 py-3 align-top">{invite.humanRole}</td>
                    <td classИмя="px-5 py-3 align-top">
                      <div>{invite.invitedBy}</div>
                      <div classИмя="text-xs text-muted-foreground">{invite.email}</div>
                    </td>
                    <td classИмя="px-5 py-3 align-top text-muted-foreground">{invite.createdAt}</td>
                    <td classИмя="px-5 py-3 align-top">
                      {invite.relatedLabel === "Review request" ? (
                        <a href="/inbox/requests" classИмя="underline underline-offset-4">
                          {invite.relatedLabel}
                        </a>
                      ) : (
                        <span classИмя="text-muted-foreground">{invite.relatedLabel}</span>
                      )}
                    </td>
                    <td classИмя="px-5 py-3 text-right align-top">
                      {invite.action === "Revoke" ? (
                        <Button type="button" size="sm" variant="outline">
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

          <div classИмя="grid gap-3 md:grid-cols-2">
            <div classИмя="rounded-2xl border border-border p-4">
              <div classИмя="text-sm font-medium">Empty history state</div>
              <div classИмя="mt-2 text-sm text-muted-foreground">
                Нет invites have been created for this company yet.
              </div>
            </div>
            <div classИмя="rounded-2xl border border-rose-400/40 bg-rose-500/[0.07] p-4">
              <div classИмя="text-sm font-medium text-foreground">Permission error</div>
              <div classИмя="mt-2 text-sm text-muted-foreground">
                You do not have permission to manage company invites.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function InviteUxLab() {
  return (
    <div classИмя="space-y-6">
      <div classИмя="overflow-hidden rounded-[32px] border border-border/70 bg-[linear-gradient(135deg,rgba(8,145,178,0.10),transparent_28%),linear-gradient(180deg,rgba(245,158,11,0.10),transparent_44%),var(--background)] shadow-[0_30px_80px_rgba(15,23,42,0.10)]">
        <div classИмя="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_320px]">
          <div classИмя="p-6 sm:p-7">
            <div classИмя="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/[0.08] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300">
              <FlaskConical classИмя="h-3.5 w-3.5" />
              Invite UX Lab
            </div>
            <h1 classИмя="mt-4 text-3xl font-semibold tracking-tight">Invite and signup UX review surface</h1>
            <p classИмя="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              This page collects the current invite landing, signup, approval-result, and company invite-management states in one place so styling changes can be reviewed without recreating each backend condition by hand.
            </p>

            <div classИмя="mt-5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" classИмя="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
                /tests/ux/invites
              </Badge>
              <Badge variant="outline" classИмя="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
                signup + invite states
              </Badge>
              <Badge variant="outline" classИмя="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
                fixture-backed preview
              </Badge>
            </div>
          </div>

          <aside classИмя="border-t border-border/60 bg-background/70 p-6 lg:border-l lg:border-t-0">
            <div classИмя="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Covered states
            </div>
            <div classИмя="space-y-3">
              {[
                "Invite loading, access-check, missing-token, and unavailable states",
                "Inline account creation and sign-in variants, including feedback/error copy",
                "Человек accept, agent request, and auto-accept transitions",
                "Ожидание approval, joined-now, claim secret, and onboarding result screens",
                "Компания invite creation, copied-link, history, empty, and permission-error states",
              ].map((highlight) => (
                <div
                  key={highlight}
                  classИмя="rounded-2xl border border-border/70 bg-background/85 px-4 py-3 text-sm text-muted-foreground"
                >
                  {highlight}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      <LabSection
        eyebrow="Top-level states"
        title="Landing state coverage"
        description="Small cards for the fast-return invite states that do not render the full split-screen layout."
        accentClassИмя="bg-[linear-gradient(180deg,rgba(59,130,246,0.05),transparent_30%),var(--background)]"
      >
        <div classИмя="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <СтатусCard
            icon={<Loader2 classИмя="h-4 w-4 animate-spin" />}
            title="Загрузка invite"
            body="Shown while invite summary, deployment mode, or auth session data is still loading."
          />
          <СтатусCard
            icon={<Clock3 classИмя="h-4 w-4" />}
            title="Checking your access"
            body="Shown after sign-in while the app verifies whether the current user already belongs to the invited company."
          />
          <СтатусCard
            icon={<КлючRound classИмя="h-4 w-4" />}
            title="Invalid invite token"
            body="The token is missing entirely, so the page short-circuits before any invite lookup."
            tone="error"
          />
          <СтатусCard
            icon={<Link2 classИмя="h-4 w-4" />}
            title="Invite not available"
            body="Used for expired, revoked, already-consumed, or otherwise missing invites."
            tone="warn"
          />
          <СтатусCard
            icon={<ShieldCheck classИмя="h-4 w-4" />}
            title="Bootstrap complete"
            body="Result screen for bootstrap CEO invites after setup has been accepted successfully."
            tone="success"
          />
          <СтатусCard
            icon={<ArrowRight classИмя="h-4 w-4" />}
            title="Авто-accept in progress"
            body="Signed-in human users skip the extra button click and move straight into join submission."
          />
          <СтатусCard
            icon={<Users classИмя="h-4 w-4" />}
            title="Already a member"
            body="Принятьance stays disabled and the page redirects into the company once membership is confirmed."
          />
          <СтатусCard
            icon={<UserPlus classИмя="h-4 w-4" />}
            title="Invite result surfaces"
            body="Ботh pending-approval and joined-now confirmations are included below with claim and onboarding extras."
            tone="success"
          />
        </div>
      </LabSection>

      <LabSection
        eyebrow="Invite landing"
        title="Split-screen invite flows"
        description="These frames mirror the production invite surface closely enough to review spacing, hierarchy, and control states while keeping data fixture-driven."
        accentClassИмя="bg-[linear-gradient(180deg,rgba(234,179,8,0.06),transparent_28%),var(--background)]"
      >
        <div classИмя="space-y-5">
          <InviteLandingShell
            left={
              <InviteSummaryPanel
                title="Join Acme Robotics"
                description="Создайте аккаунт Paperclip first. If you already have one, switch to sign in and continue the invite with the same email."
                inviteMessage="Welcome aboard."
                requestedДоступ="Operator"
              />
            }
            right={<InlineAuthПредпросмотр mode="sign_up" />}
          />

          <InviteLandingShell
            left={
              <InviteSummaryPanel
                title="Join Acme Robotics"
                description="Создайте аккаунт Paperclip first. If you already have one, switch to sign in and continue the invite with the same email."
                inviteMessage="Welcome aboard."
                requestedДоступ="Operator"
              />
            }
            right={
              <InlineAuthПредпросмотр
                mode="sign_in"
                feedback={{
                  tone: "info",
                  text: "An account already exists for jane@example.com. Войти below to continue with this invite.",
                }}
              />
            }
          />

          <InviteLandingShell
            left={
              <InviteSummaryPanel
                title="Join Acme Robotics"
                description="Your account is ready. Review the invite details, then accept it to continue."
                inviteMessage="Welcome aboard."
                requestedДоступ="Operator"
                signedInLabel="Jane Example"
              />
            }
            right={<ПринятьInviteПредпросмотр autoПринять />}
          />

          <InviteLandingShell
            left={
              <InviteSummaryPanel
                title="Join Acme Robotics"
                description="Review the invite details, then submit the agent information below to start the join request."
                requestedДоступ="Заявка агента"
              />
            }
            right={<АгентRequestПредпросмотр />}
          />

          <InviteLandingShell
            left={
              <InviteSummaryPanel
                title="Join Acme Robotics"
                description="Your account is ready. Review the invite details, then accept it to continue."
                requestedДоступ="Operator"
                signedInLabel="Jane Example"
              />
            }
            right={<ПринятьInviteПредпросмотр error="This account already belongs to the company." isCurrentMember />}
          />
        </div>
      </LabSection>

      <LabSection
        eyebrow="Result states"
        title="Согласование and completion screens"
        description="These are the post-submit states returned from invite acceptance, including optional claim and onboarding metadata."
        accentClassИмя="bg-[linear-gradient(180deg,rgba(16,185,129,0.06),transparent_30%),var(--background)]"
      >
        <div classИмя="grid gap-5 xl:grid-cols-3">
          <InviteResultПредпросмотр
            title="Request to join Acme Robotics"
            description="Совет User must approve your request to join."
            claimСекрет="pcp_claim_secret_demo"
            onboardingTextUrl="/api/invites/pcp_invite_test/onboarding.txt"
          />
          <InviteResultПредпросмотр
            title="You joined the company"
            description="Your account already matched the approved invite, so the board can be opened immediately."
            joinedСейчас
          />
          <InviteResultПредпросмотр
            title="Request to join Acme Robotics"
            description="Ask them to visit Компания Настройки → Доступ to approve your request."
          />
        </div>
      </LabSection>

      <LabSection
        eyebrow="Standalone auth"
        title="Auth page states"
        description="The general `/auth` page uses a different composition from invite landing. These previews keep both sign-in and sign-up variants visible."
        accentClassИмя="bg-[linear-gradient(180deg,rgba(168,85,247,0.06),transparent_28%),var(--background)]"
      >
        <div classИмя="space-y-5">
          <AuthScreenПредпросмотр mode="sign_in" error="Invalid email or password" />
          <AuthScreenПредпросмотр mode="sign_up" />
        </div>
      </LabSection>

      <LabSection
        eyebrow="Компания settings"
        title="Компания invite management"
        description="This section captures the board-side invite creation flow, copied-link state, audit table, and the edge states that are otherwise tedious to stage."
        accentClassИмя="bg-[linear-gradient(180deg,rgba(244,114,182,0.06),transparent_28%),var(--background)]"
      >
        <КомпанияInvitesПредпросмотр />
      </LabSection>
    </div>
  );
}
