import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useКомпания } from "../context/КомпанияContext";
import { useDialogActions } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { companiesApi } from "../api/companies";
import { queryКлючs } from "../lib/queryКлючs";
import { formatCents, relativeTime } from "../lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pencil,
  Check,
  X,
  Plus,
  MoreHorizontal,
  Trash2,
  Users,
  CircleDot,
  DollarSign,
  Calendar,
} from "lucide-react";

export function Компании() {
  const {
    companies,
    selectedКомпанияId,
    setSelectedКомпанияId,
    loading,
    error,
  } = useКомпания();
  const { openOnboarding } = useDialogActions();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryКлюч: queryКлючs.companies.stats,
    queryFn: () => companiesApi.stats(),
  });

  // Inline edit state
  const [editingId, setИзменитьingId] = useState<string | null>(null);
  const [editИмя, setИзменитьИмя] = useState("");
  const [confirmУдалитьId, setПодтвердитьУдалитьId] = useState<string | null>(null);

  const editMutation = useMutation({
    mutationFn: ({ id, newИмя }: { id: string; newИмя: string }) =>
      companiesApi.update(id, { name: newИмя }),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });
      setИзменитьingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companiesApi.remove(id),
    onУспешно: () => {
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });
      queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.stats });
      setПодтвердитьУдалитьId(null);
    },
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Компании" }]);
  }, [setBreadcrumbs]);

  function startИзменить(companyId: string, currentИмя: string) {
    setИзменитьingId(companyId);
    setИзменитьИмя(currentИмя);
  }

  function saveИзменить() {
    if (!editingId || !editИмя.trim()) return;
    editMutation.mutate({ id: editingId, newИмя: editИмя.trim() });
  }

  function cancelИзменить() {
    setИзменитьingId(null);
    setИзменитьИмя("");
  }

  return (
    <div classИмя="space-y-6">
      <div classИмя="flex items-center justify-end">
        <Button size="sm" onClick={() => openOnboarding()}>
          <Plus classИмя="h-3.5 w-3.5 mr-1.5" />
          New Компания
        </Button>
      </div>

      <div classИмя="h-6">
        {loading && <p classИмя="text-sm text-muted-foreground">Загрузка companies...</p>}
        {error && <p classИмя="text-sm text-destructive">{error.message}</p>}
      </div>

      <div classИмя="grid gap-4">
        {companies.map((company) => {
          const selected = company.id === selectedКомпанияId;
          const isИзменитьing = editingId === company.id;
          const isПодтвердитьingУдалить = confirmУдалитьId === company.id;
          const companyStats = stats?.[company.id];
          const agentCount = companyStats?.agentCount ?? 0;
          const issueCount = companyStats?.issueCount ?? 0;
          const budgetPct =
            company.budgetMonthlyCents > 0
              ? Math.round(
                  (company.spentMonthlyCents / company.budgetMonthlyCents) * 100,
                )
              : 0;

          return (
            <div
              key={company.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedКомпанияId(company.id)}
              onКлючDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventПо умолчанию();
                  setSelectedКомпанияId(company.id);
                }
              }}
              classИмя={`group text-left bg-card border rounded-lg p-5 transition-colors cursor-pointer ${
                selected
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              {/* Header row: name + menu */}
              <div classИмя="flex items-start justify-between gap-3">
                <div classИмя="flex-1 min-w-0">
                  {isИзменитьing ? (
                    <div
                      classИмя="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Input
                        value={editИмя}
                        onChange={(e) => setИзменитьИмя(e.target.value)}
                        classИмя="h-7 text-sm"
                        autoFocus
                        onКлючDown={(e) => {
                          if (e.key === "Enter") saveИзменить();
                          if (e.key === "Escape") cancelИзменить();
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={saveИзменить}
                        disabled={editMutation.isОжидание}
                      >
                        <Check classИмя="h-3.5 w-3.5 text-green-500" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={cancelИзменить}>
                        <X classИмя="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <div classИмя="flex items-center gap-2">
                      <h3 classИмя="font-semibold text-base">{company.name}</h3>
                      <span
                        classИмя={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          company.status === "active"
                            ? "bg-green-500/10 text-green-600 dark:text-green-400"
                            : company.status === "paused"
                              ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {company.status}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        classИмя="text-muted-foreground opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          startИзменить(company.id, company.name);
                        }}
                      >
                        <Pencil classИмя="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {company.description && !isИзменитьing && (
                    <p classИмя="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {company.description}
                    </p>
                  )}
                </div>

                {/* Three-dot menu */}
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        classИмя="text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal classИмя="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => startИзменить(company.id, company.name)}
                      >
                        <Pencil classИмя="h-3.5 w-3.5" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setПодтвердитьУдалитьId(company.id)}
                      >
                        <Trash2 classИмя="h-3.5 w-3.5" />
                        Удалить Компания
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Stats row */}
              <div classИмя="flex items-center gap-3 sm:gap-5 mt-4 text-sm text-muted-foreground flex-wrap">
                <div classИмя="flex items-center gap-1.5">
                  <Users classИмя="h-3.5 w-3.5" />
                  <span>
                    {agentCount} {agentCount === 1 ? "agent" : "agents"}
                  </span>
                </div>
                <div classИмя="flex items-center gap-1.5">
                  <CircleDot classИмя="h-3.5 w-3.5" />
                  <span>
                    {issueCount} {issueCount === 1 ? "issue" : "issues"}
                  </span>
                </div>
                <div classИмя="flex items-center gap-1.5 tabular-nums">
                  <DollarSign classИмя="h-3.5 w-3.5" />
                  <span>
                    {formatCents(company.spentMonthlyCents)}
                    {company.budgetMonthlyCents > 0
                      ? <> / {formatCents(company.budgetMonthlyCents)} <span classИмя="text-xs">({budgetPct}%)</span></>
                      : <span classИмя="text-xs ml-1">Безлимит budget</span>}
                  </span>
                </div>
                <div classИмя="flex items-center gap-1.5 ml-auto">
                  <Calendar classИмя="h-3.5 w-3.5" />
                  <span>Создано {relativeTime(company.createdAt)}</span>
                </div>
              </div>

              {/* Удалить confirmation */}
              {isПодтвердитьingУдалить && (
                <div
                  classИмя="mt-4 flex items-center justify-between bg-destructive/5 border border-destructive/20 rounded-md px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p classИмя="text-sm text-destructive font-medium">
                    Удалить this company and all its data? This cannot be undone.
                  </p>
                  <div classИмя="flex items-center gap-2 ml-4 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setПодтвердитьУдалитьId(null)}
                      disabled={deleteMutation.isОжидание}
                    >
                      Отмена
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(company.id)}
                      disabled={deleteMutation.isОжидание}
                    >
                      {deleteMutation.isОжидание ? "Deleting…" : "Удалить"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
