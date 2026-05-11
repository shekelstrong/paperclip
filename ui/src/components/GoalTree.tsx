import type { Цель } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { СтатусBadge } from "./СтатусBadge";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { useState } from "react";

interface ЦельTreeProps {
  goals: Цель[];
  goalLink?: (goal: Цель) => string;
  onSelect?: (goal: Цель) => void;
}

interface ЦельНетdeProps {
  goal: Цель;
  children: Цель[];
  allЦели: Цель[];
  depth: number;
  goalLink?: (goal: Цель) => string;
  onSelect?: (goal: Цель) => void;
}

function ЦельНетde({ goal, children, allЦели, depth, goalLink, onSelect }: ЦельНетdeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = children.length > 0;
  const link = goalLink?.(goal);

  const inner = (
    <>
      {hasChildren ? (
        <button
          classИмя="p-0.5"
          onClick={(e) => {
            e.preventПо умолчанию();
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          <ChevronRight
            classИмя={cn("h-3 w-3 transition-transform", expanded && "rotate-90")}
          />
        </button>
      ) : (
        <span classИмя="w-4" />
      )}
      <span classИмя="text-xs text-muted-foreground capitalize">{goal.level}</span>
      <span classИмя="flex-1 truncate">{goal.title}</span>
      <СтатусBadge status={goal.status} />
    </>
  );

  const classes = cn(
    "flex items-center gap-2 px-3 py-1.5 text-sm transition-colors cursor-pointer hover:bg-accent/50",
  );

  return (
    <div>
      {link ? (
        <Link
          to={link}
          classИмя={cn(classes, "no-underline text-inherit")}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          {inner}
        </Link>
      ) : (
        <div
          classИмя={classes}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => onSelect?.(goal)}
        >
          {inner}
        </div>
      )}
      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <ЦельНетde
              key={child.id}
              goal={child}
              children={allЦели.filter((g) => g.parentId === child.id)}
              allЦели={allЦели}
              depth={depth + 1}
              goalLink={goalLink}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ЦельTree({ goals, goalLink, onSelect }: ЦельTreeProps) {
  const goalIds = new Set(goals.map((g) => g.id));
  const roots = goals.filter((g) => !g.parentId || !goalIds.has(g.parentId));

  if (goals.length === 0) {
    return <p classИмя="text-sm text-muted-foreground">Нет goals.</p>;
  }

  return (
    <div classИмя="border border-border py-1">
      {roots.map((goal) => (
        <ЦельНетde
          key={goal.id}
          goal={goal}
          children={goals.filter((g) => g.parentId === goal.id)}
          allЦели={goals}
          depth={0}
          goalLink={goalLink}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
