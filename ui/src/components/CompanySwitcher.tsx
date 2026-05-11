import { ChevronsUpDown, Plus, Настройки } from "lucide-react";
import { Link } from "@/lib/router";
import { useКомпания } from "../context/КомпанияContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useState } from "react";

function statusDotColor(status?: string): string {
  switch (status) {
    case "active":
      return "bg-green-400";
    case "paused":
      return "bg-yellow-400";
    case "archived":
      return "bg-neutral-400";
    default:
      return "bg-green-400";
  }
}

interface КомпанияSwitcherProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function КомпанияSwitcher({ open: controlledOpen, onOpenChange }: КомпанияSwitcherProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { companies, selectedКомпания, setSelectedКомпанияId } = useКомпания();
  const sidebarКомпании = companies.filter((company) => company.status !== "archived");
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          classИмя="w-full justify-between px-2 py-1.5 h-auto text-left"
        >
          <div classИмя="flex items-center gap-2 min-w-0">
            {selectedКомпания && (
              <span classИмя={`h-2 w-2 rounded-full shrink-0 ${statusDotColor(selectedКомпания.status)}`} />
            )}
            <span classИмя="text-sm font-medium truncate">
              {selectedКомпания?.name ?? "Select company"}
            </span>
          </div>
          <ChevronsUpDown classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" classИмя="w-[220px]">
        <DropdownMenuLabel>Компании</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sidebarКомпании.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => setSelectedКомпанияId(company.id)}
            classИмя={company.id === selectedКомпания?.id ? "bg-accent" : ""}
          >
            <span classИмя={`h-2 w-2 rounded-full shrink-0 mr-2 ${statusDotColor(company.status)}`} />
            <span classИмя="truncate">{company.name}</span>
          </DropdownMenuItem>
        ))}
        {sidebarКомпании.length === 0 && (
          <DropdownMenuItem disabled>Нет companies</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/company/settings" classИмя="no-underline text-inherit">
            <Настройки classИмя="h-4 w-4 mr-2" />
            Компания Настройки
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/companies" classИмя="no-underline text-inherit">
            <Plus classИмя="h-4 w-4 mr-2" />
            Manage Компании
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
