import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Layout } from "./components/Layout";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { CloudДоступGate } from "./components/CloudДоступGate";
import { Панель управления } from "./pages/Панель управления";
import { Панель управленияLive } from "./pages/Панель управленияLive";
import { Компании } from "./pages/Компании";
import { Агенты } from "./pages/Агенты";
import { АгентDetail } from "./pages/АгентDetail";
import { Проекты } from "./pages/Проекты";
import { ProjectDetail } from "./pages/ProjectDetail";
import { ProjectРабочая областьDetail } from "./pages/ProjectРабочая областьDetail";
import { Рабочие области } from "./pages/Рабочие области";
import { Задачи } from "./pages/Задачи";
import { Поиск } from "./pages/Поиск";
import { ЗадачаDetail } from "./pages/ЗадачаDetail";
import { ЗадачаChatLongThreadPerf } from "./pages/ЗадачаChatLongThreadPerf";
import { Процедуры } from "./pages/Процедуры";
import { ПроцедураDetail } from "./pages/ПроцедураDetail";
import { UserПрофиль } from "./pages/UserПрофиль";
import { ExecutionРабочая областьDetail } from "./pages/ExecutionРабочая областьDetail";
import { Цели } from "./pages/Цели";
import { ЦельDetail } from "./pages/ЦельDetail";
import { Согласования } from "./pages/Согласования";
import { СогласованиеDetail } from "./pages/СогласованиеDetail";
import { Расходы } from "./pages/Расходы";
import { Активность } from "./pages/Активность";
import { Входящие } from "./pages/Входящие";
import { КомпанияНастройки } from "./pages/КомпанияНастройки";
import { КомпанияОкружения } from "./pages/КомпанияОкружения";
import { КомпанияДоступ } from "./pages/КомпанияДоступ";
import { КомпанияInvites } from "./pages/КомпанияInvites";
import { КомпанияНавыки } from "./pages/КомпанияНавыки";
import { Секреты } from "./pages/Секреты";
import { КомпанияЭкспорт } from "./pages/КомпанияЭкспорт";
import { КомпанияИмпорт } from "./pages/КомпанияИмпорт";
import { DesignGuide } from "./pages/DesignGuide";
import { InstanceОбщиеНастройки } from "./pages/InstanceОбщиеНастройки";
import { InstanceДоступ } from "./pages/InstanceДоступ";
import { InstanceНастройки } from "./pages/InstanceНастройки";
import { InstanceExperimentalНастройки } from "./pages/InstanceExperimentalНастройки";
import { ПрофильНастройки } from "./pages/ПрофильНастройки";
import { PluginManager } from "./pages/PluginManager";
import { PluginНастройки } from "./pages/PluginНастройки";
import { АдаптерManager } from "./pages/АдаптерManager";
import { PluginPage } from "./pages/PluginPage";
import { ОргструктураChart } from "./pages/ОргструктураChart";
import { NewАгент } from "./pages/NewАгент";
import { AuthPage } from "./pages/Auth";
import { СоветClaimPage } from "./pages/СоветClaim";
import { CliAuthPage } from "./pages/CliAuth";
import { InviteLandingPage } from "./pages/InviteLanding";
import { JoinRequestQueue } from "./pages/JoinRequestQueue";
import { НетtFoundPage } from "./pages/НетtFound";
import { useКомпания } from "./context/КомпанияContext";
import { useDialogActions } from "./context/DialogContext";
import { loadLastВходящиеTab } from "./lib/inbox";
import { shouldRedirectКомпанияlessRouteToOnboarding } from "./lib/onboarding-route";

function boardRoutes() {
  return (
    <>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Панель управления />} />
      <Route path="dashboard/live" element={<Панель управленияLive />} />
      <Route path="onboarding" element={<OnboardingRoutePage />} />
      <Route path="companies" element={<Компании />} />
      <Route path="company/settings" element={<КомпанияНастройки />} />
      <Route path="company/settings/environments" element={<КомпанияОкружения />} />
      <Route path="company/settings/access" element={<КомпанияДоступ />} />
      <Route path="company/settings/invites" element={<КомпанияInvites />} />
      <Route path="company/export/*" element={<КомпанияЭкспорт />} />
      <Route path="company/import" element={<КомпанияИмпорт />} />
      <Route path="company/settings/secrets" element={<Секреты />} />
      <Route path="skills/*" element={<КомпанияНавыки />} />
      <Route path="settings" element={<LegacyНастройкиRedirect />} />
      <Route path="settings/*" element={<LegacyНастройкиRedirect />} />
      <Route path="plugins/:pluginId" element={<PluginPage />} />
      <Route path="org" element={<ОргструктураChart />} />
      <Route path="agents" element={<Navigate to="/agents/all" replace />} />
      <Route path="agents/all" element={<Агенты />} />
      <Route path="agents/active" element={<Агенты />} />
      <Route path="agents/paused" element={<Агенты />} />
      <Route path="agents/error" element={<Агенты />} />
      <Route path="agents/new" element={<NewАгент />} />
      <Route path="agents/:agentId" element={<АгентDetail />} />
      <Route path="agents/:agentId/:tab" element={<АгентDetail />} />
      <Route path="agents/:agentId/runs/:runId" element={<АгентDetail />} />
      <Route path="projects" element={<Проекты />} />
      <Route path="projects/:projectId" element={<ProjectDetail />} />
      <Route path="projects/:projectId/overview" element={<ProjectDetail />} />
      <Route path="projects/:projectId/issues" element={<ProjectDetail />} />
      <Route path="projects/:projectId/issues/:filter" element={<ProjectDetail />} />
      <Route path="projects/:projectId/workspaces/:workspaceId" element={<ProjectРабочая областьDetail />} />
      <Route path="projects/:projectId/workspaces" element={<ProjectDetail />} />
      <Route path="projects/:projectId/configuration" element={<ProjectDetail />} />
      <Route path="projects/:projectId/budget" element={<ProjectDetail />} />
      <Route path="workspaces" element={<Рабочие области />} />
      <Route path="issues" element={<Задачи />} />
      <Route path="search" element={<Поиск />} />
      <Route path="issues/all" element={<Navigate to="/issues" replace />} />
      <Route path="issues/active" element={<Navigate to="/issues" replace />} />
      <Route path="issues/backlog" element={<Navigate to="/issues" replace />} />
      <Route path="issues/done" element={<Navigate to="/issues" replace />} />
      <Route path="issues/recent" element={<Navigate to="/issues" replace />} />
      <Route path="issues/:issueId" element={<ЗадачаDetail />} />
      {import.meta.env.DEV ? (
        <Route path="tests/perf/long-thread" element={<ЗадачаChatLongThreadPerf />} />
      ) : null}
      <Route path="routines" element={<Процедуры />} />
      <Route path="routines/:routineId" element={<ПроцедураDetail />} />
      <Route path="execution-workspaces/:workspaceId" element={<ExecutionРабочая областьDetail />} />
      <Route path="execution-workspaces/:workspaceId/services" element={<ExecutionРабочая областьDetail />} />
      <Route path="execution-workspaces/:workspaceId/configuration" element={<ExecutionРабочая областьDetail />} />
      <Route path="execution-workspaces/:workspaceId/runtime-logs" element={<ExecutionРабочая областьDetail />} />
      <Route path="execution-workspaces/:workspaceId/issues" element={<ExecutionРабочая областьDetail />} />
      <Route path="execution-workspaces/:workspaceId/routines" element={<ExecutionРабочая областьDetail />} />
      <Route path="goals" element={<Цели />} />
      <Route path="goals/:goalId" element={<ЦельDetail />} />
      <Route path="approvals" element={<Navigate to="/approvals/pending" replace />} />
      <Route path="approvals/pending" element={<Согласования />} />
      <Route path="approvals/all" element={<Согласования />} />
      <Route path="approvals/:approvalId" element={<СогласованиеDetail />} />
      <Route path="costs" element={<Расходы />} />
      <Route path="activity" element={<Активность />} />
      <Route path="inbox" element={<ВходящиеRootRedirect />} />
      <Route path="inbox/mine" element={<Входящие />} />
      <Route path="inbox/recent" element={<Входящие />} />
      <Route path="inbox/unread" element={<Входящие />} />
      <Route path="inbox/all" element={<Входящие />} />
      <Route path="inbox/requests" element={<JoinRequestQueue />} />
      <Route path="inbox/new" element={<Navigate to="/inbox/mine" replace />} />
      <Route path="u/:userSlug" element={<UserПрофиль />} />
      <Route path="design-guide" element={<DesignGuide />} />
      <Route path="instance/settings/adapters" element={<АдаптерManager />} />
      <Route path=":pluginRouteПуть/*" element={<PluginPage />} />
      <Route path="*" element={<НетtFoundPage scope="board" />} />
    </>
  );
}

function ВходящиеRootRedirect() {
  return <Navigate to={`/inbox/${loadLastВходящиеTab()}`} replace />;
}

function LegacyНастройкиRedirect() {
  const location = useLocation();
  return <Navigate to={`/instance/settings/general${location.search}${location.hash}`} replace />;
}

function OnboardingRoutePage() {
  const { companies } = useКомпания();
  const { openOnboarding } = useDialogActions();
  const { companyPrefix } = useParams<{ companyPrefix?: string }>();
  const matchedКомпания = companyPrefix
    ? companies.find((company) => company.issuePrefix.toUpperCase() === companyPrefix.toUpperCase()) ?? null
    : null;

  const title = matchedКомпания
    ? `Добавить another agent to ${matchedКомпания.name}`
    : companies.length > 0
      ? "Создать another company"
      : "Создать your first company";
  const description = matchedКомпания
    ? "Запустить onboarding again to add an agent and a starter task for this company."
    : companies.length > 0
      ? "Запустить onboarding again to create another company and seed its first agent."
      : "Get started by creating a company and your first agent.";

  return (
    <div classИмя="mx-auto max-w-xl py-10">
      <div classИмя="rounded-lg border border-border bg-card p-6">
        <h1 classИмя="text-xl font-semibold">{title}</h1>
        <p classИмя="mt-2 text-sm text-muted-foreground">{description}</p>
        <div classИмя="mt-4">
          <Button
            onClick={() =>
              matchedКомпания
                ? openOnboarding({ initialStep: 2, companyId: matchedКомпания.id })
                : openOnboarding()
            }
          >
            {matchedКомпания ? "Добавить агента" : "Начать Onboarding"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function КомпанияRootRedirect() {
  const { companies, selectedКомпания, loading } = useКомпания();
  const location = useLocation();

  if (loading) {
    return <div classИмя="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Загрузка...</div>;
  }

  const targetКомпания = selectedКомпания ?? companies[0] ?? null;
  if (!targetКомпания) {
    if (
      shouldRedirectКомпанияlessRouteToOnboarding({
        pathname: location.pathname,
        hasКомпании: false,
      })
    ) {
      return <Navigate to="/onboarding" replace />;
    }
    return <НетКомпанииНачатьPage />;
  }

  return <Navigate to={`/${targetКомпания.issuePrefix}/dashboard`} replace />;
}

function UnprefixedСоветRedirect() {
  const location = useLocation();
  const { companies, selectedКомпания, loading } = useКомпания();

  if (loading) {
    return <div classИмя="mx-auto max-w-xl py-10 text-sm text-muted-foreground">Загрузка...</div>;
  }

  const targetКомпания = selectedКомпания ?? companies[0] ?? null;
  if (!targetКомпания) {
    if (
      shouldRedirectКомпанияlessRouteToOnboarding({
        pathname: location.pathname,
        hasКомпании: false,
      })
    ) {
      return <Navigate to="/onboarding" replace />;
    }
    return <НетКомпанииНачатьPage />;
  }

  return (
    <Navigate
      to={`/${targetКомпания.issuePrefix}${location.pathname}${location.search}${location.hash}`}
      replace
    />
  );
}

function НетКомпанииНачатьPage() {
  const { openOnboarding } = useDialogActions();

  return (
    <div classИмя="mx-auto max-w-xl py-10">
      <div classИмя="rounded-lg border border-border bg-card p-6">
        <h1 classИмя="text-xl font-semibold">Создать your first company</h1>
        <p classИмя="mt-2 text-sm text-muted-foreground">
          Get started by creating a company.
        </p>
        <div classИмя="mt-4">
          <Button onClick={() => openOnboarding()}>New Компания</Button>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <>
      <Routes>
        <Route path="auth" element={<AuthPage />} />
        <Route path="board-claim/:token" element={<СоветClaimPage />} />
        <Route path="cli-auth/:id" element={<CliAuthPage />} />
        <Route path="invite/:token" element={<InviteLandingPage />} />
        <Route path="tests/perf/long-thread" element={<ЗадачаChatLongThreadPerf />} />

        <Route element={<CloudДоступGate />}>
          <Route index element={<КомпанияRootRedirect />} />
          <Route path="onboarding" element={<OnboardingRoutePage />} />
          <Route path="instance" element={<Navigate to="/instance/settings/general" replace />} />
          <Route path="instance/settings" element={<Layout />}>
            <Route index element={<Navigate to="general" replace />} />
            <Route path="profile" element={<ПрофильНастройки />} />
            <Route path="general" element={<InstanceОбщиеНастройки />} />
            <Route path="access" element={<InstanceДоступ />} />
            <Route path="heartbeats" element={<InstanceНастройки />} />
            <Route path="experimental" element={<InstanceExperimentalНастройки />} />
            <Route path="plugins" element={<PluginManager />} />
            <Route path="plugins/:pluginId" element={<PluginНастройки />} />
            <Route path="adapters" element={<АдаптерManager />} />
          </Route>
          <Route path="companies" element={<UnprefixedСоветRedirect />} />
          <Route path="issues" element={<UnprefixedСоветRedirect />} />
          <Route path="issues/:issueId" element={<UnprefixedСоветRedirect />} />
          <Route path="routines" element={<UnprefixedСоветRedirect />} />
          <Route path="routines/:routineId" element={<UnprefixedСоветRedirect />} />
          <Route path="u/:userSlug" element={<UnprefixedСоветRedirect />} />
          <Route path="skills/*" element={<UnprefixedСоветRedirect />} />
          <Route path="settings" element={<LegacyНастройкиRedirect />} />
          <Route path="settings/*" element={<LegacyНастройкиRedirect />} />
          <Route path="agents" element={<UnprefixedСоветRedirect />} />
          <Route path="agents/new" element={<UnprefixedСоветRedirect />} />
          <Route path="agents/:agentId" element={<UnprefixedСоветRedirect />} />
          <Route path="agents/:agentId/:tab" element={<UnprefixedСоветRedirect />} />
          <Route path="agents/:agentId/runs/:runId" element={<UnprefixedСоветRedirect />} />
          <Route path="projects" element={<UnprefixedСоветRedirect />} />
          <Route path="projects/:projectId" element={<UnprefixedСоветRedirect />} />
          <Route path="projects/:projectId/overview" element={<UnprefixedСоветRedirect />} />
          <Route path="projects/:projectId/issues" element={<UnprefixedСоветRedirect />} />
          <Route path="projects/:projectId/issues/:filter" element={<UnprefixedСоветRedirect />} />
          <Route path="projects/:projectId/workspaces" element={<UnprefixedСоветRedirect />} />
          <Route path="projects/:projectId/workspaces/:workspaceId" element={<UnprefixedСоветRedirect />} />
          <Route path="projects/:projectId/configuration" element={<UnprefixedСоветRedirect />} />
          <Route path="workspaces" element={<UnprefixedСоветRedirect />} />
          <Route path="execution-workspaces/:workspaceId" element={<UnprefixedСоветRedirect />} />
          <Route path="execution-workspaces/:workspaceId/services" element={<UnprefixedСоветRedirect />} />
          <Route path="execution-workspaces/:workspaceId/configuration" element={<UnprefixedСоветRedirect />} />
          <Route path="execution-workspaces/:workspaceId/runtime-logs" element={<UnprefixedСоветRedirect />} />
          <Route path="execution-workspaces/:workspaceId/issues" element={<UnprefixedСоветRedirect />} />
          <Route path="execution-workspaces/:workspaceId/routines" element={<UnprefixedСоветRedirect />} />
          <Route path=":companyPrefix" element={<Layout />}>
            {boardRoutes()}
          </Route>
          <Route path="*" element={<НетtFoundPage scope="global" />} />
        </Route>
      </Routes>
      <OnboardingWizard />
    </>
  );
}
