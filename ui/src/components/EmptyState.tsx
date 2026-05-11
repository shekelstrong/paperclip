import { Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  action?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, message, action, onAction }: EmptyStateProps) {
  return (
    <div classИмя="flex flex-col items-center justify-center py-16 text-center">
      <div classИмя="bg-muted/50 p-4 mb-4">
        <Icon classИмя="h-10 w-10 text-muted-foreground/50" />
      </div>
      <p classИмя="text-sm text-muted-foreground mb-4">{message}</p>
      {action && onAction && (
        <Button onClick={onAction}>
          <Plus classИмя="h-4 w-4 mr-1.5" />
          {action}
        </Button>
      )}
    </div>
  );
}
