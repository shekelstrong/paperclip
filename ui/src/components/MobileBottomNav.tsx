import { useMemo } from "react";
import { NavLink, useLocation } from "@/lib/router";
import {
  House,
  CircleDot,
  SquarePen,
  Users,
  Входящие,
} from "lucide-react";
import { useКомпания } from "../context/КомпанияContext";
import { useDialogActions } from "../context/DialogContext";
import { SIDEBAR_SCROLL_RESET_STATE } from "../lib/navigation-scroll";
import { cn } from "../lib/utils";
import { useВходящиеBadge } from "../hooks/useВходящиеBadge";

interface MobileБотtomNavProps {
  visible: boolean;
}

interface MobileNavLinkItem {
  type: "link";
  to: string;
  label: string;
  icon: typeof House;
  badge?: number;
}

interface MobileNavActionItem {
  type: "action";
  label: string;
  icon: typeof SquarePen;
  onClick: () => void;
}

type MobileNavItem = MobileNavLinkItem | MobileNavActionItem;

export function MobileБотtomNav({ visible }: MobileБотtomNavProps) {
  const location = useLocation();
  const { selectedКомпанияId } = useКомпания();
  const { openNewЗадача } = useDialogActions();
  const inboxBadge = useВходящиеBadge(selectedКомпанияId);

  const items = useMemo<MobileNavItem[]>(
    () => [
      { type: "link", to: "/dashboard", label: "Home", icon: House },
      { type: "link", to: "/issues", label: "Задачи", icon: CircleDot },
      { type: "action", label: "Создать", icon: SquarePen, onClick: () => openNewЗадача() },
      { type: "link", to: "/agents/all", label: "Агенты", icon: Users },
      {
        type: "link",
        to: "/inbox",
        label: "Входящие",
        icon: Входящие,
        badge: inboxBadge.inbox,
      },
    ],
    [openNewЗадача, inboxBadge.inbox],
  );

  return (
    <nav
      classИмя={cn(
        "fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 transition-transform duration-200 ease-out md:hidden pb-[env(safe-area-inset-bottom)]",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      aria-label="Mobile navigation"
    >
      <div classИмя="grid h-16 grid-cols-5 px-1">
        {items.map((item) => {
          if (item.type === "action") {
            const Icon = item.icon;
            const active = /\/issues\/new(?:\/|$)/.test(location.pathname);
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                classИмя={cn(
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon classИмя="h-[18px] w-[18px]" />
                <span classИмя="truncate">{item.label}</span>
              </button>
            );
          }

          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              state={SIDEBAR_SCROLL_RESET_STATE}
              classИмя={({ isАктивен }) =>
                cn(
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-medium transition-colors",
                  isАктивен
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {({ isАктивен }) => (
                <>
                  <span classИмя="relative">
                    <Icon classИмя={cn("h-[18px] w-[18px]", isАктивен && "stroke-[2.3]")} />
                    {item.badge != null && item.badge > 0 && (
                      <span classИмя="absolute -right-2 -top-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none text-primary-foreground">
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </span>
                  <span classИмя="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
