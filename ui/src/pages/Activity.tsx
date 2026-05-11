import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { АктивностьEvent, Агент } from "@paperclipai/shared";
import { activityApi } from "../api/activity";
import { accessApi } from "../api/access";
import { agentsApi } from "../api/agents";
import { buildКомпанияUserПрофильMap } from "../lib/company-members";
import { useКомпания } from "../context/КомпанияContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryКлючs } from "../lib/queryКлючs";
import { EmptyState } from "../components/EmptyState";
import { АктивностьRow } from "../components/АктивностьRow";
import { PageSkeleton } from "../components/PageSkeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectЗначение,
} from "@/components/ui/select";
import { История } from "lucide-react";

const ACTIVITY_PAGE_LIMIT = 200;

function detailString(event: АктивностьEvent, ...keys: string[]) {
  const details = event.details;
  for (const key of keys) {
    const value = details?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function activityEntityИмя(event: АктивностьEvent) {
  if (event.entityТип === "issue") return detailString(event, "identifier", "issueIdentifier");
  if (event.entityТип === "project") return detailString(event, "projectИмя", "name", "title");
  if (event.entityТип === "goal") return detailString(event, "goalНазвание", "title", "name");
  return detailString(event, "name", "title");
}

function activityEntityНазвание(event: АктивностьEvent) {
  if (event.entityТип === "issue") return detailString(event, "issueНазвание", "title");
  return null;
}

export function Активность() {
  const { selectedКомпанияId } = useКомпания();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [filter, setФильтр] = useState("all");

  useEffect(() => {
    setBreadcrumbs([{ label: "Активность" }]);
  }, [setBreadcrumbs]);

  const { data, isЗагрузка, error } = useQuery({
    queryКлюч: [...queryКлючs.activity(selectedКомпанияId!), { limit: ACTIVITY_PAGE_LIMIT }],
    queryFn: () => activityApi.list(selectedКомпанияId!, { limit: ACTIVITY_PAGE_LIMIT }),
    enabled: !!selectedКомпанияId,
  });

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const { data: companyMembers } = useQuery({
    queryКлюч: queryКлючs.access.companyUserDirectory(selectedКомпанияId!),
    queryFn: () => accessApi.listUserDirectory(selectedКомпанияId!),
    enabled: !!selectedКомпанияId,
  });

  const userПрофильMap = useMemo(
    () => buildКомпанияUserПрофильMap(companyMembers?.users),
    [companyMembers?.users],
  );

  const agentMap = useMemo(() => {
    const map = new Map<string, Агент>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityИмяMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const event of data ?? []) {
      const name = activityEntityИмя(event);
      if (name) map.set(`${event.entityТип}:${event.entityId}`, name);
    }
    return map;
  }, [data, agents]);

  const entityНазваниеMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const event of data ?? []) {
      const title = activityEntityНазвание(event);
      if (title) map.set(`${event.entityТип}:${event.entityId}`, title);
    }
    return map;
  }, [data]);

  if (!selectedКомпанияId) {
    return <EmptyState icon={История} message="Select a company to view activity." />;
  }

  if (isЗагрузка) {
    return <PageSkeleton variant="list" />;
  }

  const filtered =
    data && filter !== "all"
      ? data.filter((e) => e.entityТип === filter)
      : data;

  const entityТипs = data
    ? [...new Set(data.map((e) => e.entityТип))].sort()
    : [];

  return (
    <div classИмя="space-y-4">
      <div classИмя="flex items-center justify-end">
        <Select value={filter} onЗначениеChange={setФильтр}>
          <SelectTrigger classИмя="w-[140px] h-8 text-xs">
            <SelectЗначение placeholder="Фильтр by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все types</SelectItem>
            {entityТипs.map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p classИмя="text-sm text-destructive">{error.message}</p>}

      {filtered && filtered.length === 0 && (
        <EmptyState icon={История} message="Нет activity yet." />
      )}

      {filtered && filtered.length > 0 && (
        <div classИмя="border border-border divide-y divide-border">
          {filtered.map((event) => (
            <АктивностьRow
              key={event.id}
              event={event}
              agentMap={agentMap}
              userПрофильMap={userПрофильMap}
              entityИмяMap={entityИмяMap}
              entityНазваниеMap={entityНазваниеMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
