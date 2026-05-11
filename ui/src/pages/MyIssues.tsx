import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryКлючs } from "../lib/queryКлючs";
import { СтатусIcon } from "../components/СтатусIcon";

import { EntityRow } from "../components/EntityRow";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDate } from "../lib/utils";
import { ListTodo } from "lucide-react";

export function MyЗадачи() {
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Мои задачи" }]);
  }, [setBreadcrumbs]);

  const { data: issues, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.issues.list(selectedКомпанияId!),
    queryFn: () => issuesApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  if (!selectedКомпанияId) {
    return <EmptyState icon={ListTodo} message="Select a company to view your issues." />;
  }

  if (isЗагрузка) {
    return <PageSkeleton variant="list" />;
  }

  // Show issues that are not assigned (user-created or unassigned)
  const myЗадачи = (issues ?? []).filter(
    (i) => !i.assigneeАгентId && !["done", "cancelled"].includes(i.status)
  );

  return (
    <div classИмя="space-y-4">
      {error && <p classИмя="text-sm text-destructive">{error.message}</p>}

      {myЗадачи.length === 0 && (
        <EmptyState icon={ListTodo} message="Нет назначенных вам задач." />
      )}

      {myЗадачи.length > 0 && (
        <div classИмя="border border-border">
          {myЗадачи.map((issue) => (
            <EntityRow
              key={issue.id}
              identifier={issue.identifier ?? issue.id.slice(0, 8)}
              title={issue.title}
              to={`/issues/${issue.identifier ?? issue.id}`}
              leading={
                <СтатусIcon status={issue.status} blockerAttention={issue.blockerAttention} />
              }
              trailing={
                <span classИмя="text-xs text-muted-foreground">
                  {formatDate(issue.createdAt)}
                </span>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
