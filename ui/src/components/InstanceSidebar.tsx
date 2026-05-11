import { useQuery } from "@tanstack/react-query";
import { Clock3, Cpu, FlaskConical, Puzzle, Настройки, Shield, SlidersHorizontal, UserRoundPen } from "lucide-react";
import { NavLink } from "@/lib/router";
import { pluginsApi } from "@/api/plugins";
import { queryКлючs } from "@/lib/queryКлючs";
import { SIDEBAR_SCROLL_RESET_STATE } from "@/lib/navigation-scroll";
import { SidebarNavItem } from "./SidebarNavItem";

export function InstanceSidebar() {
  const { data: plugins } = useQuery({
    queryКлюч: queryКлючs.plugins.all,
    queryFn: () => pluginsApi.list(),
  });

  return (
    <aside classИмя="w-full h-full min-h-0 border-r border-border bg-background flex flex-col">
      <div classИмя="flex items-center gap-2 px-3 h-12 shrink-0">
        <Настройки classИмя="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
        <span classИмя="flex-1 text-sm font-bold text-foreground truncate">
          Instance Настройки
        </span>
      </div>

      <nav classИмя="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 px-3 py-2">
        <div classИмя="flex flex-col gap-0.5">
          <SidebarNavItem to="/instance/settings/profile" label="Профиль" icon={UserRoundPen} end />
          <SidebarNavItem to="/instance/settings/general" label="Общие" icon={SlidersHorizontal} end />
          <SidebarNavItem to="/instance/settings/access" label="Доступ" icon={Shield} end />
          <SidebarNavItem to="/instance/settings/heartbeats" label="Heartbeats" icon={Clock3} end />
          <SidebarNavItem to="/instance/settings/experimental" label="Experimental" icon={FlaskConical} />
          <SidebarNavItem to="/instance/settings/plugins" label="Plugins" icon={Puzzle} />
          <SidebarNavItem to="/instance/settings/adapters" label="Адаптеры" icon={Cpu} />
          {(plugins ?? []).length > 0 ? (
            <div classИмя="ml-4 mt-1 flex flex-col gap-0.5 border-l border-border/70 pl-3">
              {(plugins ?? []).map((plugin) => (
                <NavLink
                  key={plugin.id}
                  to={`/instance/settings/plugins/${plugin.id}`}
                  state={SIDEBAR_SCROLL_RESET_STATE}
                  classИмя={({ isАктивен }) =>
                    [
                      "rounded-md px-2 py-1.5 text-xs transition-colors",
                      isАктивен
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    ].join(" ")
                  }
                >
                  {plugin.manifestJson.displayИмя ?? plugin.packageИмя}
                </NavLink>
              ))}
            </div>
          ) : null}
        </div>
      </nav>
    </aside>
  );
}
