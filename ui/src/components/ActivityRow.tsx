import { Link } from "@/lib/router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { deriveInitials } from "./Identity";
import { ЗадачаReferenceАктивностьSummary } from "./ЗадачаReferenceАктивностьSummary";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import { formatАктивностьVerb } from "../lib/activity-format";
import { deriveProjectUrlКлюч, type АктивностьEvent, type Агент } from "@paperclipai/shared";
import type { КомпанияUserПрофиль } from "../lib/company-members";

function entityLink(entityТип: string, entityId: string, name?: string | null): string | null {
  switch (entityТип) {
    case "issue": return `/issues/${name ?? entityId}`;
    case "agent": return `/agents/${entityId}`;
    case "project": return `/projects/${deriveProjectUrlКлюч(name, entityId)}`;
    case "goal": return `/goals/${entityId}`;
    case "approval": return `/approvals/${entityId}`;
    default: return null;
  }
}

interface АктивностьRowProps {
  event: АктивностьEvent;
  agentMap: Map<string, Агент>;
  userПрофильMap?: Map<string, КомпанияUserПрофиль>;
  entityИмяMap: Map<string, string>;
  entityНазваниеMap?: Map<string, string>;
  classИмя?: string;
}

export function АктивностьRow({ event, agentMap, userПрофильMap, entityИмяMap, entityНазваниеMap, classИмя }: АктивностьRowProps) {
  const verb = formatАктивностьVerb(event.action, event.details, { agentMap, userПрофильMap });

  const isHeartbeatEvent = event.entityТип === "heartbeat_run";
  const heartbeatАгентId = isHeartbeatEvent
    ? (event.details as Record<string, unknown> | null)?.agentId as string | undefined
    : undefined;

  const name = isHeartbeatEvent
    ? (heartbeatАгентId ? entityИмяMap.get(`agent:${heartbeatАгентId}`) : null)
    : entityИмяMap.get(`${event.entityТип}:${event.entityId}`);

  const entityНазвание = entityНазваниеMap?.get(`${event.entityТип}:${event.entityId}`);

  const link = isHeartbeatEvent && heartbeatАгентId
    ? `/agents/${heartbeatАгентId}/runs/${event.entityId}`
    : entityLink(event.entityТип, event.entityId, name);

  const actor = event.actorТип === "agent" ? agentMap.get(event.actorId) : null;
  const userПрофиль = event.actorТип === "user" ? userПрофильMap?.get(event.actorId) : null;
  const actorИмя = actor?.name ?? (event.actorТип === "system" ? "System" : userПрофиль?.label ?? (event.actorТип === "user" ? "Совет" : event.actorId || "Неизвестно"));
  const actorAvatarUrl = userПрофиль?.image ?? null;

  const inner = (
    <div classИмя="space-y-2">
      <div classИмя="flex items-center gap-3">
        <div classИмя="flex min-w-0 flex-1 items-center gap-2">
          <Avatar size="xs">
            {actorAvatarUrl && <AvatarImage src={actorAvatarUrl} alt={actorИмя} />}
            <AvatarFallback>{deriveInitials(actorИмя)}</AvatarFallback>
          </Avatar>
          <p classИмя="min-w-0 flex-1 truncate">
            <span>{actorИмя}</span>
            <span classИмя="text-muted-foreground"> {verb} </span>
            {name && <span classИмя="font-medium">{name}</span>}
            {entityНазвание && <span classИмя="text-muted-foreground"> — {entityНазвание}</span>}
          </p>
        </div>
        <span classИмя="text-xs text-muted-foreground shrink-0">{timeAgo(event.createdAt)}</span>
      </div>
      <ЗадачаReferenceАктивностьSummary event={event} />
    </div>
  );

  const classes = cn(
    "px-4 py-2 text-sm",
    link && "cursor-pointer hover:bg-accent/50 transition-colors",
    classИмя,
  );

  if (link) {
    return (
      <Link to={link} classИмя={cn(classes, "no-underline text-inherit block")}>
        {inner}
      </Link>
    );
  }

  return (
    <div classИмя={classes}>
      {inner}
    </div>
  );
}
