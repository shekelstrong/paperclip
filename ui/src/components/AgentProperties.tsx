import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { AGENT_ROLE_LABELS, type Агент, type АгентЗапуститьtimeState } from "@paperclipai/shared";
import { agentsApi } from "../api/agents";
import { useКомпания } from "../context/КомпанияContext";
import { getАдаптерLabel } from "../adapters/adapter-display-registry";
import { queryКлючs } from "../lib/queryКлючs";
import { СтатусBadge } from "./СтатусBadge";
import { Identity } from "./Identity";
import { formatDate, agentUrl } from "../lib/utils";
import { Separator } from "@/components/ui/separator";

interface АгентPropertiesProps {
  agent: Агент;
  runtimeState?: АгентЗапуститьtimeState;
}

const roleЯрлыки = AGENT_ROLE_LABELS as Record<string, string>;

function PropertyRow({ label, children }: { label: string; children: React.ReactНетde }) {
  return (
    <div classИмя="flex items-start gap-3 py-1.5">
      <span classИмя="text-xs text-muted-foreground shrink-0 w-20 mt-0.5">{label}</span>
      <div classИмя="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">{children}</div>
    </div>
  );
}

export function АгентProperties({ agent, runtimeState }: АгентPropertiesProps) {
  const { selectedКомпанияId } = useКомпания();

  const { data: agents } = useQuery({
    queryКлюч: queryКлючs.agents.list(selectedКомпанияId!),
    queryFn: () => agentsApi.list(selectedКомпанияId!),
    enabled: !!selectedКомпанияId && !!agent.reportsTo,
  });

  const reportsToАгент = agent.reportsTo ? agents?.find((a) => a.id === agent.reportsTo) : null;

  return (
    <div classИмя="space-y-4">
      <div classИмя="space-y-1">
        <PropertyRow label="Статус">
          <СтатусBadge status={agent.status} />
        </PropertyRow>
        <PropertyRow label="Role">
          <span classИмя="text-sm">{roleЯрлыки[agent.role] ?? agent.role}</span>
        </PropertyRow>
        {agent.title && (
          <PropertyRow label="Название">
            <span classИмя="text-sm">{agent.title}</span>
          </PropertyRow>
        )}
        <PropertyRow label="Адаптер">
          <span classИмя="text-sm font-mono">{getАдаптерLabel(agent.adapterТип)}</span>
        </PropertyRow>
      </div>

      <Separator />

      <div classИмя="space-y-1">
        {(runtimeState?.sessionDisplayId ?? runtimeState?.sessionId) && (
          <PropertyRow label="Session">
            <span classИмя="text-xs font-mono">
              {String(runtimeState.sessionDisplayId ?? runtimeState.sessionId).slice(0, 12)}...
            </span>
          </PropertyRow>
        )}
        {runtimeState?.lastОшибка && (
          <PropertyRow label="Last error">
            <span classИмя="text-xs text-red-600 dark:text-red-400 break-words min-w-0">{runtimeState.lastОшибка}</span>
          </PropertyRow>
        )}
        {agent.lastHeartbeatAt && (
          <PropertyRow label="Last Heartbeat">
            <span classИмя="text-sm">{formatDate(agent.lastHeartbeatAt)}</span>
          </PropertyRow>
        )}
        {agent.reportsTo && (
          <PropertyRow label="Репозиторийrts To">
            {reportsToАгент ? (
              <Link to={agentUrl(reportsToАгент)} classИмя="hover:underline">
                <Identity name={reportsToАгент.name} size="sm" />
              </Link>
            ) : (
              <span classИмя="text-sm font-mono">{agent.reportsTo.slice(0, 8)}</span>
            )}
          </PropertyRow>
        )}
        <PropertyRow label="Создано">
          <span classИмя="text-sm">{formatDate(agent.createdAt)}</span>
        </PropertyRow>
      </div>
    </div>
  );
}
