import { useEffect } from "react";
import { ArrowLeft, RadioTower } from "lucide-react";
import { Link } from "@/lib/router";
import { АктивенАгентыPanel } from "../components/АктивенАгентыPanel";
import { EmptyState } from "../components/EmptyState";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useКомпания } from "../context/КомпанияContext";

const DASHBOARD_LIVE_RUN_LIMIT = 50;

export function Панель управленияLive() {
  const { selectedКомпанияId, companies } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([
      { label: "Панель управления", href: "/dashboard" },
      { label: "Live runs" },
    ]);
  }, [setBreadcrumbs]);

  if (!selectedКомпанияId) {
    return (
      <EmptyState
        icon={RadioTower}
        message={companies.length === 0 ? "Создать a company to view live runs." : "Select a company to view live runs."}
      />
    );
  }

  return (
    <div classИмя="space-y-5">
      <div classИмя="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to="/dashboard"
            classИмя="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft classИмя="h-3.5 w-3.5" />
            Панель управления
          </Link>
          <h1 classИмя="mt-2 text-2xl font-semibold tracking-normal text-foreground">Live agent runs</h1>
          <p classИмя="mt-1 text-sm text-muted-foreground">
            Активен runs first, followed by the most recent completed runs.
          </p>
        </div>
        <div classИмя="text-sm text-muted-foreground">Showing up to {DASHBOARD_LIVE_RUN_LIMIT}</div>
      </div>

      <АктивенАгентыPanel
        companyId={selectedКомпанияId}
        title="Активные / недавние"
        minЗапуститьCount={DASHBOARD_LIVE_RUN_LIMIT}
        fetchLimit={DASHBOARD_LIVE_RUN_LIMIT}
        cardLimit={DASHBOARD_LIVE_RUN_LIMIT}
        gridClassИмя="gap-3 md:grid-cols-2 2xl:grid-cols-3"
        cardClassИмя="h-[420px]"
        emptyMessage="Нет active or recent agent runs."
        queryОбласть="dashboard-live"
        showMoreLink={false}
      />
    </div>
  );
}
