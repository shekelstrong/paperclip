import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { goalsApi } from "../api/goals";
import { useКомпания } from "../context/КомпанияContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryКлючs } from "../lib/queryКлючs";
import { ЦельTree } from "../components/ЦельTree";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Цель, Plus } from "lucide-react";

export function Цели() {
  const { selectedКомпанияId } = useКомпания();
  const { openNewЦель } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Цели" }]);
  }, [setBreadcrumbs]);

  const { data: goals, isЗагрузка, error } = useQuery({
    queryКлюч: queryКлючs.goals.list(selectedКомпанияId!),
    queryFn: () => goalsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  if (!selectedКомпанияId) {
    return <EmptyState icon={Цель} message="Select a company to view goals." />;
  }

  if (isЗагрузка) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div classИмя="space-y-4">
      {error && <p classИмя="text-sm text-destructive">{error.message}</p>}

      {goals && goals.length === 0 && (
        <EmptyState
          icon={Цель}
          message="Пока нет целей."
          action="Добавить цель"
          onAction={() => openNewЦель()}
        />
      )}

      {goals && goals.length > 0 && (
        <>
          <div classИмя="flex items-center justify-start">
            <Button size="sm" variant="outline" onClick={() => openNewЦель()}>
              <Plus classИмя="h-3.5 w-3.5 mr-1.5" />
              New Цель
            </Button>
          </div>
          <ЦельTree goals={goals} goalLink={(goal) => `/goals/${goal.id}`} />
        </>
      )}
    </div>
  );
}
