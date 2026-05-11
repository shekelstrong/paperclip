import { useEffect } from "react";
import { Link, useLocation } from "@/lib/router";
import { AlertTriangle, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useКомпания } from "../context/КомпанияContext";

type НетtFoundОбласть = "board" | "invalid_company_prefix" | "global";

interface НетtFoundPageProps {
  scope?: НетtFoundОбласть;
  requestedPrefix?: string;
}

export function НетtFoundPage({ scope = "global", requestedPrefix }: НетtFoundPageProps) {
  const location = useLocation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { companies, selectedКомпания } = useКомпания();

  useEffect(() => {
    setBreadcrumbs([{ label: "Не найдено" }]);
  }, [setBreadcrumbs]);

  const fallbackКомпания = selectedКомпания ?? companies[0] ?? null;
  const dashboardHref = fallbackКомпания ? `/${fallbackКомпания.issuePrefix}/dashboard` : "/";
  const currentПуть = `${location.pathname}${location.search}${location.hash}`;
  const normalizedPrefix = requestedPrefix?.toUpperCase();

  const title = scope === "invalid_company_prefix" ? "Компания not found" : "Страница не найдена";
  const description =
    scope === "invalid_company_prefix"
      ? `Нет company matches prefix "${normalizedPrefix ?? "unknown"}".`
      : "Этого маршрута не существует.";

  return (
    <div classИмя="mx-auto max-w-2xl py-10">
      <div classИмя="rounded-lg border border-border bg-card p-6">
        <div classИмя="flex items-center gap-3">
          <div classИмя="rounded-md border border-destructive/20 bg-destructive/10 p-2">
            <AlertTriangle classИмя="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 classИмя="text-xl font-semibold">{title}</h1>
            <p classИмя="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div classИмя="mt-4 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Requested path: <code classИмя="font-mono">{currentПуть}</code>
        </div>

        <div classИмя="mt-5 flex flex-wrap gap-2">
          <Button asChild>
            <Link to={dashboardHref}>
              <Compass classИмя="mr-1.5 h-4 w-4" />
              Open dashboard
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
