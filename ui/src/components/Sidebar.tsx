import {
  Входящие,
  CircleDot,
  Цель,
  LayoutПанель управления,
  DollarSign,
  История,
  Поиск,
  SquarePen,
  Network,
  Boxes,
  Repeat,
  GitВетка,
  Настройки,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/lib/router";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarПроекты } from "./SidebarПроекты";
import { SidebarАгенты } from "./SidebarАгенты";
import { useDialogActions } from "../context/DialogContext";
import { useКомпания } from "../context/КомпанияContext";
import { heartbeatsApi } from "../api/heartbeats";
import { instanceНастройкиApi } from "../api/instanceНастройки";
import { queryКлючs } from "../lib/queryКлючs";
import { useВходящиеBadge } from "../hooks/useВходящиеBadge";
import { Button } from "@/components/ui/button";
import { PluginSlotOutlet } from "@/plugins/slots";
import { SidebarКомпанияMenu } from "./SidebarКомпанияMenu";

export function Sidebar() {
  const { openNewЗадача } = useDialogActions();
  const { selectedКомпанияId, selectedКомпания } = useКомпания();
  const inboxBadge = useВходящиеBadge(selectedКомпанияId);
  const { data: experimentalНастройки } = useQuery({
    queryКлюч: queryКлючs.instance.experimentalНастройки,
    queryFn: () => instanceНастройкиApi.getExperimental(),
  });
  const { data: liveЗапуститьs } = useQuery({
    queryКлюч: queryКлючs.liveЗапуститьs(selectedКомпанияId!),
    queryFn: () => heartbeatsApi.liveЗапуститьsForКомпания(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
    refetchInterval: 10_000,
  });
  const liveЗапуститьCount = liveЗапуститьs?.length ?? 0;
  const showРабочие областиLink = experimentalНастройки?.enableIsolatedРабочие области === true;

  const pluginContext = {
    companyId: selectedКомпанияId,
    companyPrefix: selectedКомпания?.issuePrefix ?? null,
  };

  return (
    <aside classИмя="w-full h-full min-h-0 border-r border-border bg-background flex flex-col">
      {/* Top bar: Компания name (bold) + Поиск — aligned with top sections (no visible border) */}
      <div classИмя="flex items-center gap-1 px-3 h-12 shrink-0">
        <SidebarКомпанияMenu />
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          classИмя="text-muted-foreground shrink-0"
          aria-label="Поиск"
          title="Поиск"
        >
          <NavLink to="/search">
            <Поиск classИмя="h-4 w-4" />
          </NavLink>
        </Button>
      </div>

      <nav classИмя="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 px-3 py-2">
        <div classИмя="flex flex-col gap-0.5">
          {/* Новая задача button aligned with nav items */}
          <button
            onClick={() => openNewЗадача()}
            classИмя="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            <SquarePen classИмя="h-4 w-4 shrink-0" />
            <span classИмя="truncate">Новая задача</span>
          </button>
          <SidebarNavItem to="/dashboard" label="Панель управления" icon={LayoutПанель управления} liveCount={liveЗапуститьCount} />
          <SidebarNavItem
            to="/inbox"
            label="Входящие"
            icon={Входящие}
            badge={inboxBadge.inbox}
            badgeTone={inboxBadge.failedЗапуститьs > 0 ? "danger" : "default"}
            alert={inboxBadge.failedЗапуститьs > 0}
          />
          <PluginSlotOutlet
            slotТипs={["sidebar"]}
            context={pluginContext}
            classИмя="flex flex-col gap-0.5"
            itemClassИмя="text-[13px] font-medium"
            missingBehavior="placeholder"
          />
        </div>

        <SidebarSection label="Работа">
          <SidebarNavItem to="/issues" label="Задачи" icon={CircleDot} />
          <SidebarNavItem to="/routines" label="Процедуры" icon={Repeat} />
          <SidebarNavItem to="/goals" label="Цели" icon={Цель} />
          {showРабочие областиLink ? (
            <SidebarNavItem to="/workspaces" label="Рабочие области" icon={GitВетка} />
          ) : null}
        </SidebarSection>

        <SidebarПроекты />

        <SidebarАгенты />

        <SidebarSection label="Компания">
          <SidebarNavItem to="/org" label="Оргструктура" icon={Network} />
          <SidebarNavItem to="/skills" label="Навыки" icon={Boxes} />
          <SidebarNavItem to="/costs" label="Расходы" icon={DollarSign} />
          <SidebarNavItem to="/activity" label="Активность" icon={История} />
          <SidebarNavItem to="/company/settings" label="Настройки" icon={Настройки} />
        </SidebarSection>

        <PluginSlotOutlet
          slotТипs={["sidebarPanel"]}
          context={pluginContext}
          classИмя="flex flex-col gap-3"
          itemClassИмя="rounded-lg border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>
    </aside>
  );
}
