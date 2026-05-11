import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useПоискParams } from "@/lib/router";
import { authApi } from "../api/auth";
import { queryКлючs } from "../lib/queryКлючs";
import { getRememberedInviteПуть } from "../lib/invite-memory";
import { Button } from "@/components/ui/button";
import { AsciiArtAnimation } from "@/components/AsciiArtAnimation";
import { Sparkles } from "lucide-react";

type AuthMode = "sign_in" | "sign_up";

export function AuthPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useПоискParams();
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [name, setИмя] = useState("");
  const [email, setПочта] = useState("");
  const [password, setPassword] = useState("");
  const [error, setОшибка] = useState<string | null>(null);

  const nextПуть = useMemo(
    () => searchParams.get("next") || getRememberedInviteПуть() || "/",
    [searchParams],
  );
  const { data: session, isЗагрузка: isSessionЗагрузка } = useQuery({
    queryКлюч: queryКлючs.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  useEffect(() => {
    if (session) {
      navigate(nextПуть, { replace: true });
    }
  }, [session, navigate, nextПуть]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "sign_in") {
        await authApi.signInПочта({ email: email.trim(), password });
        return;
      }
      await authApi.signUpПочта({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    },
    onУспешно: async () => {
      setОшибка(null);
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.auth.session });
      await queryClient.invalidateQueries({ queryКлюч: queryКлючs.companies.all });
      navigate(nextПуть, { replace: true });
    },
    onОшибка: (err) => {
      setОшибка(err instanceof Ошибка ? err.message : "Authentication failed");
    },
  });

  const canОтправить =
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    (mode === "sign_in" || (name.trim().length > 0 && password.trim().length >= 8));

  if (isSessionЗагрузка) {
    return (
      <div classИмя="fixed inset-0 flex items-center justify-center">
        <p classИмя="text-sm text-muted-foreground">Загрузка…</p>
      </div>
    );
  }

  return (
    <div classИмя="fixed inset-0 flex bg-background">
      {/* Left half — form */}
      <div classИмя="w-full md:w-1/2 flex flex-col overflow-y-auto">
        <div classИмя="w-full max-w-md mx-auto my-auto px-8 py-12">
          <div classИмя="flex items-center gap-2 mb-8">
            <Sparkles classИмя="h-4 w-4 text-muted-foreground" />
            <span classИмя="text-sm font-medium">Paperclip</span>
          </div>

          <h1 classИмя="text-xl font-semibold">
            {mode === "sign_in" ? "Вход в Paperclip" : "Создайте аккаунт Paperclip"}
          </h1>
          <p classИмя="mt-1 text-sm text-muted-foreground">
            {mode === "sign_in"
              ? "Use your email and password to access this instance."
              : "Создать an account for this instance. Почта confirmation is not required in v1."}
          </p>

          <form
            classИмя="mt-6 space-y-4"
            method="post"
            action={mode === "sign_up" ? "/api/auth/sign-up/email" : "/api/auth/sign-in/email"}
            onОтправить={(event) => {
              event.preventПо умолчанию();
              if (mutation.isОжидание) return;
              if (!canОтправить) {
                setОшибка("Заполните все обязательные поля.");
                return;
              }
              mutation.mutate();
            }}
          >
            {mode === "sign_up" && (
              <div>
                <label htmlFor="name" classИмя="text-xs text-muted-foreground mb-1 block">Имя</label>
                <input
                  id="name"
                  name="name"
                  classИмя="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                  value={name}
                  onChange={(event) => setИмя(event.target.value)}
                  autoComplete="name"
                  autoFocus
                />
              </div>
            )}
            <div>
              <label htmlFor="email" classИмя="text-xs text-muted-foreground mb-1 block">Почта</label>
              <input
                id="email"
                name="email"
                classИмя="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                type="email"
                value={email}
                onChange={(event) => setПочта(event.target.value)}
                autoComplete="email"
                autoFocus={mode === "sign_in"}
              />
            </div>
            <div>
              <label htmlFor="password" classИмя="text-xs text-muted-foreground mb-1 block">Password</label>
              <input
                id="password"
                name="password"
                classИмя="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
              />
            </div>
            {error && <p classИмя="text-xs text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={mutation.isОжидание}
              aria-disabled={!canОтправить || mutation.isОжидание}
              classИмя={`w-full ${!canОтправить && !mutation.isОжидание ? "opacity-50" : ""}`}
            >
              {mutation.isОжидание
                ? "Работаing…"
                : mode === "sign_in"
                  ? "Войти"
                  : "Создать аккаунт"}
            </Button>
          </form>

          <div classИмя="mt-5 text-sm text-muted-foreground">
            {mode === "sign_in" ? "Нужен аккаунт?" : "Уже есть аккаунт?"}{" "}
            <button
              type="button"
              classИмя="font-medium text-foreground underline underline-offset-2"
              onClick={() => {
                setОшибка(null);
                setMode(mode === "sign_in" ? "sign_up" : "sign_in");
              }}
            >
              {mode === "sign_in" ? "Создать задачу" : "Войти"}
            </button>
          </div>
        </div>
      </div>

      {/* Right half — ASCII art animation (hidden on mobile) */}
      <div classИмя="hidden md:block w-1/2 overflow-hidden">
        <AsciiArtAnimation />
      </div>
    </div>
  );
}
