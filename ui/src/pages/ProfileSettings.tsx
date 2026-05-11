import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, LoaderCircle, Сохранить, Trash2, UserRoundPen } from "lucide-react";
import type { AuthSession, CurrentUserПрофиль, ОбновитьCurrentUserПрофиль } from "@paperclipai/shared";
import { authApi } from "@/api/auth";
import { assetsApi } from "@/api/assets";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useКомпания } from "../context/КомпанияContext";
import { queryКлючs } from "../lib/queryКлючs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function deriveInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function ПрофильНастройки() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const { selectedКомпанияId, selectedКомпания } = useКомпания();
  const queryClient = useQueryClient();
  const avatarInputId = useId();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setИмя] = useState("");
  const [image, setImage] = useState("");
  const [actionОшибка, setActionОшибка] = useState<string | null>(null);
  const sessionQuery = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Instance Настройки" },
      { label: "Профиль" },
    ]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    const session = sessionQuery.data;
    if (!session) return;
    setИмя(session.user.name ?? "");
    setImage(session.user.image ?? "");
  }, [sessionQuery.data]);

  function syncSessionПрофиль(profile: CurrentUserПрофиль) {
    queryClient.setQueryData<AuthSession | null>(queryКлючs.auth.session, (current) => {
      if (!current) return current;
      return {
        ...current,
        user: {
          ...current.user,
          ...profile,
        },
      };
    });
  }

  async function persistПрофиль(input: ОбновитьCurrentUserПрофиль) {
    const profile = await authApi.updateПрофиль(input);
    syncSessionПрофиль(profile);
    return profile;
  }

  function resolveПрофильИмя() {
    return name.trim() || sessionQuery.data?.user.name || "Совет";
  }

  const updateMutation = useMutation({
    mutationFn: (input: ОбновитьCurrentUserПрофиль) => persistПрофиль(input),
    onУспешно: (profile) => {
      setActionОшибка(null);
      setИмя(profile.name ?? "");
      setImage(profile.image ?? "");
    },
    onОшибка: (error) => {
      setActionОшибка(error instanceof Ошибка ? error.message : "Ошибка to update profile.");
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedКомпанияId) {
        throw new Ошибка("Select a company before uploading a profile avatar.");
      }

      const asset = await assetsApi.uploadImage(
        selectedКомпанияId,
        file,
        `profiles/${sessionQuery.data?.user.id ?? "board-user"}`,
      );
      return persistПрофиль({ name: resolveПрофильИмя(), image: asset.contentПуть });
    },
    onУспешно: (profile) => {
      setActionОшибка(null);
      setИмя(profile.name ?? "");
      setImage(profile.image ?? "");
    },
    onОшибка: (error) => {
      setActionОшибка(error instanceof Ошибка ? error.message : "Ошибка to upload avatar.");
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () => persistПрофиль({ name: resolveПрофильИмя(), image: null }),
    onУспешно: (profile) => {
      setActionОшибка(null);
      setИмя(profile.name ?? "");
      setImage(profile.image ?? "");
    },
    onОшибка: (error) => {
      setActionОшибка(error instanceof Ошибка ? error.message : "Ошибка to remove avatar.");
    },
  });

  if (sessionQuery.isЗагрузка) {
    return <div classИмя="text-sm text-muted-foreground">Загрузка profile...</div>;
  }

  if (sessionQuery.error || !sessionQuery.data) {
    return (
      <div classИмя="text-sm text-destructive">
        {sessionQuery.error instanceof Ошибка ? sessionQuery.error.message : "Ошибка to load profile."}
      </div>
    );
  }

  const currentИмя = name.trim() || sessionQuery.data.user.name || "Совет";
  const currentImage = image.trim() || null;
  const initials = deriveInitials(currentИмя);
  const isSavingПрофиль = updateMutation.isОжидание || uploadAvatarMutation.isОжидание || removeAvatarMutation.isОжидание;
  const uploadHint = selectedКомпания
    ? `Stored in Paperclip file storage for ${selectedКомпания.name}.`
    : "Select a company to upload an avatar into Paperclip storage.";

  return (
    <div classИмя="max-w-4xl space-y-6">
      <div classИмя="space-y-2">
        <div classИмя="flex items-center gap-2">
          <UserRoundPen classИмя="h-5 w-5 text-muted-foreground" />
          <h1 classИмя="text-lg font-semibold">Профиль</h1>
        </div>
        <p classИмя="text-sm text-muted-foreground">
          Control how your account appears in the sidebar and other board surfaces.
        </p>
      </div>

      {actionОшибка ? (
        <div classИмя="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionОшибка}
        </div>
      ) : null}

      <section classИмя="space-y-8">
        <div classИмя="relative overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
          <div classИмя="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--accent))_58%,color-mix(in_oklab,hsl(var(--background))_76%,white_24%)_100%)]" />
          <div classИмя="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_36%)]" />
          <div classИмя="relative p-6 pt-10">
            <div classИмя="flex flex-wrap items-end gap-5 rounded-[24px] border border-border/70 bg-background/92 p-5 shadow-[0_18px_44px_-28px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <div classИмя="space-y-3">
                <label
                  htmlFor={avatarInputId}
                  classИмя="group relative block cursor-pointer rounded-full focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
                >
                  <input
                    ref={avatarInputRef}
                    id={avatarInputId}
                    type="file"
                    accept="image/*"
                    classИмя="sr-only"
                    disabled={!selectedКомпанияId || isSavingПрофиль}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      uploadAvatarMutation.mutate(file);
                      event.target.value = "";
                    }}
                  />
                  <span classИмя="absolute inset-0 z-10 rounded-full bg-black/0 transition-colors group-hover:bg-black/14 group-focus-within:bg-black/14" />
                  <span classИмя="absolute bottom-1 right-1 z-20 flex size-9 items-center justify-center rounded-full border border-background bg-primary text-primary-foreground shadow-sm">
                    {uploadAvatarMutation.isОжидание ? <LoaderCircle classИмя="size-4 animate-spin" /> : <Camera classИмя="size-4" />}
                  </span>
                  <Avatar size="lg" classИмя="data-[size=lg]:size-24 ring-4 ring-background shadow-xl">
                    {currentImage ? <AvatarImage src={currentImage} alt={currentИмя} /> : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </label>
                <div classИмя="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={!selectedКомпанияId || isSavingПрофиль}
                  >
                    {uploadAvatarMutation.isОжидание ? <LoaderCircle classИмя="size-4 animate-spin" /> : <Camera classИмя="size-4" />}
                    {currentImage ? "Change photo" : "Загрузить photo"}
                  </Button>
                  {currentImage ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeAvatarMutation.mutate()}
                      disabled={isSavingПрофиль}
                    >
                      {removeAvatarMutation.isОжидание ? <LoaderCircle classИмя="size-4 animate-spin" /> : <Trash2 classИмя="size-4" />}
                      Удалить
                    </Button>
                  ) : null}
                </div>
              </div>

              <div classИмя="min-w-0 flex-1 space-y-2 pb-1">
                <div>
                  <h2 classИмя="truncate text-2xl font-semibold text-foreground">{currentИмя}</h2>
                  <p classИмя="truncate text-sm text-muted-foreground">{sessionQuery.data.user.email ?? "Нет email"}</p>
                </div>
                <p classИмя="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Click the avatar to upload a new image. {uploadHint}
                </p>
              </div>
            </div>
          </div>
        </div>

        <form
          classИмя="grid gap-6 md:grid-cols-2"
          onОтправить={(event) => {
            event.preventПо умолчанию();
            updateMutation.mutate({ name: resolveПрофильИмя(), image: image.trim() || null });
          }}
        >
          <div classИмя="space-y-2">
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setИмя(event.target.value)}
              maxLength={120}
              placeholder="Совет"
            />
            <p classИмя="text-xs text-muted-foreground">
              Shown in the sidebar account footer and comment author surfaces.
            </p>
          </div>

          <div classИмя="space-y-2">
            <Label htmlFor="profile-email">Почта</Label>
            <Input
              id="profile-email"
              value={sessionQuery.data.user.email ?? ""}
              readOnly
              disabled
            />
            <p classИмя="text-xs text-muted-foreground">
              Почта is managed by your auth session and is read-only here.
            </p>
          </div>

          <div classИмя="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={isSavingПрофиль || !name.trim()}>
              {updateMutation.isОжидание ? <LoaderCircle classИмя="size-4 animate-spin" /> : <Сохранить classИмя="size-4" />}
              {updateMutation.isОжидание ? "Saving..." : "Сохранить profile"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
