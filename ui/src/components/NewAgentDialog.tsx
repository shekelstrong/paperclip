import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { useDialog } from "../context/DialogContext";
import { useКомпания } from "../context/КомпанияContext";
import { agentsApi } from "../api/agents";
import { adaptersApi } from "../api/adapters";
import { queryКлючs } from "@/lib/queryКлючs";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Бот,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listUIАдаптеры } from "../adapters";
import { isVisualАдаптерChoice } from "../adapters/metadata";
import { getАдаптерDisplay } from "../adapters/adapter-display-registry";
import { useОтключитьdАдаптерыSync } from "../adapters/use-disabled-adapters";

/**
 * Адаптер types that are suitable for agent creation (excludes internal
 * system adapters like "process" and "http").
 */
const SYSTEM_ADAPTER_TYPES = new Set(["process", "http"]);

function isАгентАдаптерТип(type: string): boolean {
  return !SYSTEM_ADAPTER_TYPES.has(type);
}

export function NewАгентDialog() {
  const { newАгентOpen, closeNewАгент, openNewЗадача } = useDialog();
  const { selectedКомпанияId } = useКомпания();
  const navigate = useNavigate();
  const [showДополнительноCards, setShowДополнительноCards] = useState(false);
  const disabledТипs = useОтключитьdАдаптерыSync();

  // Fetch registered adapters from server (syncs disabled store + provides data)
  const { data: serverАдаптеры } = useQuery({
    queryКлюч: queryКлючs.adapters.all,
    queryFn: () => adaptersApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch existing agents for the "Ask CEO" flow
  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId && newАгентOpen,
  });

  const ceoАгент = (agents ?? []).find((a) => a.role === "ceo");

  // Build the adapter grid from the UI registry merged with display metadata.
  // This automatically includes external/plugin adapters.
  const adapterGrid = useMemo(() => {
    const registered = listUIАдаптеры()
      .filter((a) =>
        isАгентАдаптерТип(a.type) &&
        !disabledТипs.has(a.type) &&
        isVisualАдаптерChoice(a.type)
      );

    // Сортировка: recommended first, then alphabetical
    return registered
      .map((a) => {
        const display = getАдаптерDisplay(a.type);
        return {
          value: a.type,
          label: display.label,
          desc: display.description,
          icon: display.icon,
          recommended: display.recommended,
          comingSoon: display.comingSoon,
          disabledLabel: display.disabledLabel,
        };
      })
      .sort((a, b) => {
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        return a.label.localeCompare(b.label);
      });
  }, [disabledТипs, serverАдаптеры]);

  function handleAskCeo() {
    closeNewАгент();
    openNewЗадача({
      assigneeАгентId: ceoАгент?.id,
      title: "Создать a new agent",
      description: "(type in what kind of agent you want here)",
    });
  }

  function handleДополнительноConfig() {
    setShowДополнительноCards(true);
  }

  function handleДополнительноАдаптерPick(adapterТип: string) {
    closeNewАгент();
    setShowДополнительноCards(false);
    navigate(`/agents/new?adapterТип=${encodeURIComponent(adapterТип)}`);
  }

  return (
    <Dialog
      open={newАгентOpen}
      onOpenChange={(open) => {
        if (!open) {
          setShowДополнительноCards(false);
          closeNewАгент();
        }
      }}
    >
      <DialogContent
        showЗакрытьButton={false}
        classИмя="sm:max-w-md p-0 gap-0 overflow-hidden"
      >
        {/* Header */}
        <div classИмя="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <span classИмя="text-sm text-muted-foreground">Добавить a new agent</span>
          <Button
            variant="ghost"
            size="icon-xs"
            classИмя="text-muted-foreground"
            onClick={() => {
              setShowДополнительноCards(false);
              closeNewАгент();
            }}
          >
            <span classИмя="text-lg leading-none">&times;</span>
          </Button>
        </div>

        <div classИмя="p-6 space-y-6">
          {!showДополнительноCards ? (
            <>
              {/* Recommendation */}
              <div classИмя="text-center space-y-3">
                <div classИмя="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent">
                  <Бот classИмя="h-6 w-6 text-foreground" />
                </div>
                <p classИмя="text-sm text-muted-foreground">
                  We recommend letting your CEO handle agent setup — they know the
                  org structure and can configure reporting, permissions, and
                  adapters.
                </p>
              </div>

              <Button classИмя="w-full" size="lg" onClick={handleAskCeo}>
                <Бот classИмя="h-4 w-4 mr-2" />
                Ask the CEO to create a new agent
              </Button>

              {/* Дополнительно link */}
              <div classИмя="text-center">
                <button
                  classИмя="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  onClick={handleДополнительноConfig}
                >
                  I want advanced configuration myself
                </button>
              </div>
            </>
          ) : (
            <>
              <div classИмя="space-y-2">
                <button
                  classИмя="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowДополнительноCards(false)}
                >
                  <ArrowLeft classИмя="h-3.5 w-3.5" />
                  Назад
                </button>
                <p classИмя="text-sm text-muted-foreground">
                  Choose your adapter type for advanced setup.
                </p>
              </div>

              <div classИмя="grid grid-cols-2 gap-2">
                {adapterGrid.map((opt) => (
                  <button
                    key={opt.value}
                    classИмя={cn(
                      "flex flex-col items-center gap-1.5 rounded-md border border-border p-3 text-xs transition-colors hover:bg-accent/50 relative",
                      opt.comingSoon && "opacity-40 cursor-not-allowed",
                    )}
                    disabled={!!opt.comingSoon}
                    title={opt.comingSoon ? opt.disabledLabel : undefined}
                    onClick={() => {
                      if (!opt.comingSoon) handleДополнительноАдаптерPick(opt.value);
                    }}
                  >
                    {opt.recommended && (
                      <span classИмя="absolute -top-1.5 right-1.5 bg-green-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                        Recommended
                      </span>
                    )}
                    <opt.icon classИмя="h-4 w-4" />
                    <span classИмя="font-medium">{opt.label}</span>
                    <span classИмя="text-muted-foreground text-[10px]">
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
