import { PageTabBar } from "@/components/PageTabBar";
import { Tabs } from "@/components/ui/tabs";
import { useLocation, useNavigate } from "@/lib/router";

const items = [
  { value: "general", label: "Общие", href: "/company/settings" },
  { value: "environments", label: "Окружения", href: "/company/settings/environments" },
  { value: "access", label: "Доступ", href: "/company/settings/access" },
  { value: "invites", label: "Invites", href: "/company/settings/invites" },
] as const;

type КомпанияНастройкиTab = (typeof items)[number]["value"];

export function getКомпанияНастройкиTab(pathname: string): КомпанияНастройкиTab {
  if (pathname.includes("/company/settings/environments")) {
    return "environments";
  }

  if (pathname.includes("/company/settings/access")) {
    return "access";
  }

  if (pathname.includes("/company/settings/invites")) {
    return "invites";
  }

  return "general";
}

export function КомпанияНастройкиNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getКомпанияНастройкиTab(location.pathname);

  function handleTabChange(value: string) {
    const nextTab = items.find((item) => item.value === value);
    if (!nextTab || nextTab.value === activeTab) return;
    navigate(nextTab.href);
  }

  return (
    <Tabs value={activeTab} onЗначениеChange={handleTabChange}>
      <PageTabBar
        items={items.map(({ value, label }) => ({ value, label }))}
        value={activeTab}
        onЗначениеChange={handleTabChange}
        align="start"
      />
    </Tabs>
  );
}
