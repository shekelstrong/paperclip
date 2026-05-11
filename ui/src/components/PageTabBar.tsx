import type { ReactНетde } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSidebar } from "../context/SidebarContext";

export interface PageTabItem {
  value: string;
  label: ReactНетde;
}

interface PageTabBarProps {
  items: PageTabItem[];
  value?: string;
  onЗначениеChange?: (value: string) => void;
  align?: "center" | "start";
}

export function PageTabBar({ items, value, onЗначениеChange, align = "center" }: PageTabBarProps) {
  const { isMobile } = useSidebar();

  if (isMobile && value !== undefined && onЗначениеChange) {
    return (
      <select
        value={value}
        onChange={(e) => onЗначениеChange(e.target.value)}
        classИмя="h-9 rounded-md border border-border bg-background px-2 py-1 text-base focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {typeof item.label === "string" ? item.label : item.value}
          </option>
        ))}
      </select>
    );
  }

  return (
    <TabsList variant="line" classИмя={align === "start" ? "justify-start" : undefined}>
      {items.map((item) => (
        <TabsTrigger key={item.value} value={item.value}>
          {item.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
