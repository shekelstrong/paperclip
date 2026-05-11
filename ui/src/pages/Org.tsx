import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { agentsApi, type ОргструктураНетde } from "../api/agents";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryКлючs } from "../lib/queryКлючs";
import { СтатусBadge } from "../components/СтатусBadge";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { ChevronRight, GitВетка } from "lucide-react";
import { cn } from "../lib/utils";

function ОргструктураTree({
  nodes,
  depth = 0,
  hrefFn,
}: {
  nodes: ОргструктураНетde[];
  depth?: number;
  hrefFn: (id: string) => string;
}) {
  return (
    <div>
      {nodes.map((node) => (
        <ОргструктураTreeНетde key={node.id} node={node} depth={depth} hrefFn={hrefFn} />
      ))}
    </div>
  );
}

function ОргструктураTreeНетde({
  node,
  depth,
  hrefFn,
}: {
  node: ОргструктураНетde;
  depth: number;
  hrefFn: (id: string) => string;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.reports.length > 0;

  return (
    <div>
      <Link
        to={hrefFn(node.id)}
        classИмя="flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer hover:bg-accent/50 no-underline text-inherit"
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {hasChildren ? (
          <button
            classИмя="p-0.5"
            onClick={(e) => {
              e.preventПо умолчанию();
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            <ChevronRight
              classИмя={cn("h-3 w-3 transition-transform", expanded && "rotate-90")}
            />
          </button>
        ) : (
          <span classИмя="w-4" />
        )}
        <span
          classИмя={cn(
            "h-2 w-2 rounded-full shrink-0",
            node.status === "active"
              ? "bg-green-400"
              : node.status === "paused"
                ? "bg-yellow-400"
                : node.status === "pending_approval"
                  ? "bg-amber-400"
                : node.status === "error"
                  ? "bg-red-400"
                  : "bg-neutral-400"
          )}
        />
        <span classИмя="font-medium flex-1">{node.name}</span>
        <span classИмя="text-xs text-muted-foreground">{node.role}</span>
        <СтатусBadge status={node.status} />
      </Link>
      {hasChildren && expanded && (
        <ОргструктураTree nodes={node.reports} depth={depth + 1} hrefFn={hrefFn} />
      )}
    </div>
  );
}

export function Оргструктура() {
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Оргструктура Chart" }]);
  }, [setBreadcrumbs]);

  const { data, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.org(selectedКомпанияId!),
    queryFn: () => agentsApi.org(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  if (!selectedКомпанияId) {
    return <EmptyState icon={GitВетка} message="Select a company to view org chart." />;
  }

  if (isЗагрузка) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div classИмя="space-y-4">
      {error && <p classИмя="text-sm text-destructive">{error.message}</p>}

      {data && data.length === 0 && (
        <EmptyState
          icon={GitВетка}
          message="Нет agents in the organization. Создать agents to build your org chart."
        />
      )}

      {data && data.length > 0 && (
        <div classИмя="border border-border py-1">
          <ОргструктураTree nodes={data} hrefFn={(id) => `/agents/${id}`} />
        </div>
      )}
    </div>
  );
}
