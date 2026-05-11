import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, КлючRound, MailPlus, MonitorCog, Настройки, Shield, SlidersHorizontal } from "lucide-react";
import { sidebarBadgesApi } from "@/api/sidebarBadges";
import { ApiОшибка } from "@/api/client";
import { Link } from "@/lib/router";
import { queryКлючs } from "@/lib/queryКлючs";
import { useКомпания } from "@/context/КомпанияContext";
import { useSidebar } from "@/context/SidebarContext";
import { SidebarNavItem } from "./SidebarNavItem";

export function КомпанияНастройкиSidebar() {
  const { selectedКомпания, selectedКомпанияId } = useКомпания();
  const { isMobile, setSidebarOpen } = useSidebar();
  const { data: badges } = useQuery({
    queryКлюч: selectedКомпанияId
      ? queryКлючs.sidebarBadges(selectedКомпанияId)
      : ["sidebar-badges", "__disabled__"] as const,
    queryFn: async () => {
      try {
        return await sidebarBadgesApi.get(selectedКомпанияId!);
      } catch (error) {
        if (error instanceof ApiОшибка && (error.status === 401 || error.status === 403)) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!selectedКомпанияId,
    retry: false,
    refetchInterval: 15_000,
  });

  return (
    <aside classИмя="w-full h-full min-h-0 border-r border-border bg-background flex flex-col">
      <div classИмя="flex flex-col gap-1 px-3 py-3 shrink-0">
        <Link
          to="/dashboard"
          onClick={() => {
            if (isMobile) setSidebarOpen(false);
          }}
          classИмя="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <ChevronLeft classИмя="h-3.5 w-3.5 shrink-0" />
          <span classИмя="truncate">{selectedКомпания?.name ?? "Компания"}</span>
        </Link>
        <div classИмя="flex items-center gap-2 px-2 py-1">
          <Настройки classИмя="h-4 w-4 text-muted-foreground shrink-0" />
          <span classИмя="flex-1 truncate text-sm font-bold text-foreground">
            Компания Настройки
          </span>
        </div>
      </div>

      <nav classИмя="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide px-3 py-2">
        <div classИмя="flex flex-col gap-0.5">
          <SidebarNavItem to="/company/settings" label="Общие" icon={SlidersHorizontal} end />
          <SidebarNavItem
            to="/company/settings/environments"
            label="Окружения"
            icon={MonitorCog}
            end
          />
          <SidebarNavItem
            to="/company/settings/access"
            label="Доступ"
            icon={Shield}
            badge={badges?.joinRequests ?? 0}
            end
          />
          <SidebarNavItem to="/company/settings/invites" label="Invites" icon={MailPlus} end />
          <SidebarNavItem to="/company/settings/secrets" label="Секреты" icon={КлючRound} end />
        </div>
      </nav>
    </aside>
  );
}
