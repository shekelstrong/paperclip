import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  LogOut,
  type LucideIcon,
  Moon,
  Настройки,
  UserRound,
  Sun,
  UserRoundPen,
} from "lucide-react";
import type { DeploymentMode } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { authApi } from "@/api/auth";
import { queryКлючs } from "@/lib/queryКлючs";
import { useSidebar } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "../lib/utils";

const PROFILE_SETTINGS_PATH = "/instance/settings/profile";
const DOCS_URL = "https://docs.paperclip.ing/";

interface SidebarАккаунтMenuProps {
  deploymentMode?: DeploymentMode;
  instanceНастройкиЦель: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  version?: string | null;
}

interface MenuActionProps {
  label: string;
  description: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  external?: boolean;
}

function deriveInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function deriveUserSlug(name: string | null | undefined, email: string | null | undefined, id: string | null | undefined) {
  const candidates = [name, email?.split("@")[0], email, id];
  for (const candidate of candidates) {
    const slug = candidate
      ?.trim()
      .toНизкийerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug) return slug;
  }
  return "me";
}

function MenuAction({ label, description, icon: Icon, onClick, href, external = false }: MenuActionProps) {
  const classИмя =
    "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/60";

  const content = (
    <>
      <span classИмя="mt-0.5 rounded-lg border border-border bg-background/70 p-2 text-muted-foreground">
        <Icon classИмя="size-4" />
      </span>
      <span classИмя="min-w-0 flex-1">
        <span classИмя="block text-sm font-medium text-foreground">{label}</span>
        <span classИмя="block text-xs text-muted-foreground">{description}</span>
      </span>
    </>
  );

  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noreferrer" classИмя={classИмя} onClick={onClick}>
          {content}
        </a>
      );
    }

    return (
      <Link to={href} classИмя={classИмя} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" classИмя={classИмя} onClick={onClick}>
      {content}
    </button>
  );
}

export function SidebarАккаунтMenu({
  deploymentMode,
  instanceНастройкиЦель,
  open: controlledOpen,
  onOpenChange,
  version,
}: SidebarАккаунтMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { isMobile, setSidebarOpen } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const { data: session } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  const signOutMutation = useMutation({
    mutationFn: () => authApi.signOut(),
    onУспешно: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.auth.session });
    },
  });

  const displayИмя = session?.user.name?.trim() || "Совет";
  const secondaryLabel =
    session?.user.email?.trim() || (deploymentMode === "authenticated" ? "Выполнен вход" : "Local workspace board");
  const accountBadge = deploymentMode === "authenticated" ? "Аккаунт" : "Local";
  const initials = deriveInitials(displayИмя);
  const profileHref = `/u/${deriveUserSlug(session?.user.name, session?.user.email, session?.user.id)}`;

  function closeNavigationChrome() {
    setOpen(false);
    if (isMobile) setSidebarOpen(false);
  }

  return (
    <div classИмя="border-t border-r border-border bg-background px-3 py-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            classИмя="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-foreground/80 transition-colors hover:bg-accent/50 hover:text-foreground"
            aria-label="Open account menu"
          >
            <Avatar size="sm">
              {session?.user.image ? <AvatarImage src={session.user.image} alt={displayИмя} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span classИмя="min-w-0 flex-1 truncate">{displayИмя}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={10}
          classИмя="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-t-2xl rounded-b-none border-border p-0 shadow-2xl"
        >
          <div classИмя="h-24 bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--accent))_55%,hsl(var(--muted))_100%)]" />
          <div classИмя="-mt-8 px-4 pb-4">
            <div classИмя="flex items-start gap-3">
              <div classИмя="rounded-2xl border-4 border-popover bg-popover p-0.5 shadow-sm">
                <Avatar size="lg">
                  {session?.user.image ? <AvatarImage src={session.user.image} alt={displayИмя} /> : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </div>
              <div classИмя="min-w-0 flex-1 pt-1">
                <div classИмя="flex items-center gap-2">
                  <h2 classИмя="truncate text-base font-semibold text-foreground">{displayИмя}</h2>
                  <span classИмя="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {accountBadge}
                  </span>
                </div>
                <p classИмя="truncate text-sm text-muted-foreground">{secondaryLabel}</p>
                {version ? (
                  <p classИмя="mt-1 text-xs text-muted-foreground">Paperclip v{version}</p>
                ) : null}
              </div>
            </div>

            <div classИмя="mt-4 space-y-1">
              <MenuAction
                label="Просмотр профиля"
                description="Open your activity, task, and usage ledger."
                icon={UserRound}
                href={profileHref}
                onClick={closeNavigationChrome}
              />
              <MenuAction
                label="Изменить profile"
                description="Обновить your display name and avatar."
                icon={UserRoundPen}
                href={PROFILE_SETTINGS_PATH}
                onClick={closeNavigationChrome}
              />
              <MenuAction
                label="Instance settings"
                description="Jump back to the last settings page you opened."
                icon={Настройки}
                href={instanceНастройкиЦель}
                onClick={closeNavigationChrome}
              />
              <MenuAction
                label="Документация"
                description="Open Paperclip docs in a new tab."
                icon={BookOpen}
                href={DOCS_URL}
                external
                onClick={() => setOpen(false)}
              />
              <MenuAction
                label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                description="Toggle the app appearance."
                icon={theme === "dark" ? Sun : Moon}
                onClick={() => {
                  toggleTheme();
                  setOpen(false);
                }}
              />
              {deploymentMode === "authenticated" ? (
                <button
                  type="button"
                  classИмя={cn(
                    "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-destructive/10",
                    signOutMutation.isОжидание && "cursor-not-allowed opacity-60",
                  )}
                  onClick={() => signOutMutation.mutate()}
                  disabled={signOutMutation.isОжидание}
                >
                  <span classИмя="mt-0.5 rounded-lg border border-border bg-background/70 p-2 text-muted-foreground">
                    <LogOut classИмя="size-4" />
                  </span>
                  <span classИмя="min-w-0 flex-1">
                    <span classИмя="block text-sm font-medium text-foreground">
                      {signOutMutation.isОжидание ? "Signing out..." : "Выйти"}
                    </span>
                    <span classИмя="block text-xs text-muted-foreground">
                      End this browser session.
                    </span>
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
