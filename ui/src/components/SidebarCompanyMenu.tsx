import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronsUpDown,
  GripVertical,
  LogOut,
  Plus,
  Настройки,
  UserPlus,
} from "lucide-react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { СортировкаableContext, arrayMove, useСортировкаable, verticalListСортировкаingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Компания } from "@paperclipai/shared";
import { Link, useLocation, useNavigate } from "@/lib/router";
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useКомпания } from "@/context/КомпанияContext";
import { useDialogActions } from "@/context/DialogContext";
import { useКомпанияOrder } from "@/hooks/useКомпанияOrder";
import { queryКлючs } from "@/lib/queryКлючs";
import { cn } from "@/lib/utils";
import { useSidebar } from "../context/SidebarContext";
import { КомпанияPatternIcon } from "./КомпанияPatternIcon";

interface SidebarКомпанияMenuProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function Рабочая областьIcon({ company }: { company: Компания }) {
  return (
    <КомпанияPatternIcon
      companyИмя={company.name}
      logoUrl={company.logoUrl}
      brandColor={company.brandColor}
      classИмя="size-5 shrink-0 rounded-md text-[11px]"
    />
  );
}

function СортировкаableКомпанияItem({
  company,
  isИзменитьing,
  isSelected,
  onSelect,
}: {
  company: Компания;
  isИзменитьing: boolean;
  isSelected: boolean;
  onSelect: (company: Компания) => void;
}) {
  const {
    attributes,
    listeners,
    setActivatorНетdeRef,
    setНетdeRef,
    transform,
    transition,
    isDragging,
  } = useСортировкаable({ id: company.id, disabled: !isИзменитьing });

  return (
    <DropdownMenuItem
      ref={setНетdeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      onSelect={(event) => {
        if (isИзменитьing) {
          event.preventПо умолчанию();
          return;
        }
        onSelect(company);
      }}
      classИмя={cn(
        "min-w-0 gap-2 py-2",
        isИзменитьing && "cursor-grab",
        isDragging && "opacity-80",
        isSelected && "bg-accent text-accent-foreground",
      )}
    >
      <Рабочая областьIcon company={company} />
      <span classИмя="min-w-0 flex-1 truncate">{company.name}</span>
      {isИзменитьing ? (
        <button
          type="button"
          ref={setActivatorНетdeRef}
          aria-label={`Reorder ${company.name}`}
          classИмя="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[2px] focus-visible:ring-ring"
          onClick={(event) => {
            event.preventПо умолчанию();
            event.stopPropagation();
          }}
          {...attributes}
          {...listeners}
        >
          <GripVertical classИмя="size-4" aria-hidden="true" />
        </button>
      ) : (
        <>
          <span classИмя="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {company.issuePrefix}
          </span>
          {isSelected ? <Check classИмя="size-4 text-muted-foreground" /> : null}
        </>
      )}
    </DropdownMenuItem>
  );
}

export function SidebarКомпанияMenu({ open: controlledOpen, onOpenChange }: SidebarКомпанияMenuProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isИзменитьingOrder, setIsИзменитьingOrder] = useState(false);
  const queryClient = useQueryClient();
  const { companies, selectedКомпания, setSelectedКомпанияId } = useКомпания();
  const { openOnboarding } = useDialogActions();
  const { isMobile, setSidebarOpen } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
  );
  const sidebarКомпании = useMemo(
    () => companies.filter((company) => company.status !== "archived"),
    [companies],
  );
  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });
  const currentUserId = session?.user?.id ?? session?.session?.userId ?? null;
  const { orderedКомпании, persistOrder } = useКомпанияOrder({
    companies: sidebarКомпании,
    userId: currentUserId,
  });

  const signOutMutation = useMutation({
    mutationFn: () => authApi.signOut(),
    onУспешно: async () => {
      setOpen(false);
      if (isMobile) setSidebarOpen(false);
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.auth.session });
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setIsИзменитьingOrder(false);
    setOpen(nextOpen);
  }

  function closeNavigationChrome() {
    setOpen(false);
    setIsИзменитьingOrder(false);
    if (isMobile) setSidebarOpen(false);
  }

  function selectКомпания(company: Компания) {
    const pathPrefix = location.pathname.split("/")[1]?.toUpperCase();
    const isКомпанияRoute = sidebarКомпании.some((sidebarКомпания) => (
      sidebarКомпания.issuePrefix.toUpperCase() === pathPrefix
    ));
    const shouldLeaveCurrentRoute = company.id !== selectedКомпания?.id
      && (location.pathname.startsWith("/instance/") || isКомпанияRoute);

    setSelectedКомпанияId(company.id);
    setOpen(false);
    if (isMobile) setSidebarOpen(false);
    if (shouldLeaveCurrentRoute) {
      navigate(`/${company.issuePrefix}/dashboard`);
    }
  }

  function addКомпания() {
    setOpen(false);
    if (isMobile) setSidebarOpen(false);
    openOnboarding();
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const ids = orderedКомпании.map((company) => company.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      persistOrder(arrayMove(ids, oldIndex, newIndex));
    },
    [orderedКомпании, persistOrder],
  );

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          classИмя="h-9 flex-1 justify-start gap-2 px-2 text-left"
          aria-label={selectedКомпания ? `Open ${selectedКомпания.name} workspace switcher` : "Open workspace switcher"}
        >
          <span classИмя="flex min-w-0 flex-1 items-center gap-2">
            {selectedКомпания ? <Рабочая областьIcon company={selectedКомпания} /> : null}
            <span classИмя="truncate text-sm font-bold text-foreground">
              {selectedКомпания?.name ?? "Select workspace"}
            </span>
          </span>
          <ChevronsUpDown classИмя="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} classИмя="w-64 p-1">
        <div classИмя="flex items-center justify-between gap-2 px-2 py-1.5">
          <DropdownMenuLabel classИмя="p-0 text-[11px] font-semibold uppercase text-muted-foreground">
            Switch workspace
          </DropdownMenuLabel>
          <button
            type="button"
            onClick={(event) => {
              event.preventПо умолчанию();
              event.stopPropagation();
              setIsИзменитьingOrder((current) => !current);
            }}
            classИмя="rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {isИзменитьingOrder ? "Готово" : "Изменить"}
          </button>
        </div>
        <div classИмя="max-h-96 overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <СортировкаableContext
              items={orderedКомпании.map((company) => company.id)}
              strategy={verticalListСортировкаingStrategy}
            >
              {orderedКомпании.map((company) => (
                <СортировкаableКомпанияItem
                  key={company.id}
                  company={company}
                  isИзменитьing={isИзменитьingOrder}
                  isSelected={company.id === selectedКомпания?.id}
                  onSelect={selectКомпания}
                />
              ))}
            </СортировкаableContext>
          </DndContext>
          {orderedКомпании.length === 0 ? (
            <DropdownMenuItem disabled>Нет workspaces</DropdownMenuItem>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={addКомпания}
          classИмя="gap-2 py-2 text-muted-foreground"
          disabled={isИзменитьingOrder}
        >
          <Plus classИмя="size-4" />
          <span>Добавить company...</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild disabled={isИзменитьingOrder}>
          <Link
            to="/company/settings/invites"
            onClick={(event) => {
              if (isИзменитьingOrder) {
                event.preventПо умолчанию();
                return;
              }
              closeNavigationChrome();
            }}
          >
            <UserPlus classИмя="size-4" />
            <span classИмя="truncate">
              {selectedКомпания ? `Invite people to ${selectedКомпания.name}` : "Invite people"}
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild disabled={isИзменитьingOrder}>
          <Link
            to="/company/settings"
            onClick={(event) => {
              if (isИзменитьingOrder) {
                event.preventПо умолчанию();
                return;
              }
              closeNavigationChrome();
            }}
          >
            <Настройки classИмя="size-4" />
            <span>Компания settings</span>
          </Link>
        </DropdownMenuItem>
        {session?.session ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => signOutMutation.mutate()}
              disabled={isИзменитьingOrder || signOutMutation.isОжидание}
            >
              <LogOut classИмя="size-4" />
              <span>{signOutMutation.isОжидание ? "Signing out..." : "Выйти"}</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
