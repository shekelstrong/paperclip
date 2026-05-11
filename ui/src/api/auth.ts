import {
  authSessionSchema,
  currentUserПрофильSchema,
  type AuthSession,
  type CurrentUserПрофиль,
  type ОбновитьCurrentUserПрофиль,
} from "@paperclipai/shared";

type AuthОшибкаBody =
  | {
    code?: string;
    message?: string;
    error?: string | { code?: string; message?: string };
  }
  | null;

export class AuthApiОшибка extends Ошибка {
  status: number;
  code: string | null;
  body: unknown;

  constructor(message: string, status: number, body: unknown, code: string | null = null) {
    super(message);
    this.name = "AuthApiОшибка";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

function toSession(value: unknown): AuthSession | null {
  const direct = authSessionSchema.safeParse(value);
  if (direct.success) return direct.data;

  if (!value || typeof value !== "object") return null;
  const nested = authSessionSchema.safeParse((value as Record<string, unknown>).data);
  return nested.success ? nested.data : null;
}

function extractAuthОшибка(payload: AuthОшибкаBody, status: number) {
  const nested =
    payload?.error && typeof payload.error === "object"
      ? payload.error
      : null;
  const code =
    typeof nested?.code === "string"
      ? nested.code
      : typeof payload?.code === "string"
        ? payload.code
        : null;
  const message =
    typeof nested?.message === "string" && nested.message.trim().length > 0
      ? nested.message
      : typeof payload?.message === "string" && payload.message.trim().length > 0
        ? payload.message
        : typeof payload?.error === "string" && payload.error.trim().length > 0
          ? payload.error
          : `Запрос не удался: ${status}`;

  return new AuthApiОшибка(message, status, payload, code);
}

async function authPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/auth${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Тип": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw extractAuthОшибка(payload as AuthОшибкаBody, res.status);
  }
  return payload;
}

async function authPatch<T>(path: string, body: Record<string, unknown>, parse: (value: unknown) => T): Promise<T> {
  const res = await fetch(`/api/auth${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Тип": "application/json", Принять: "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw extractAuthОшибка(payload as AuthОшибкаBody, res.status);
  }
  return parse(payload);
}

export const authApi = {
  getSession: async (): Promise<AuthSession | null> => {
    const res = await fetch("/api/auth/get-session", {
      credentials: "include",
      headers: { Принять: "application/json" },
    });
    if (res.status === 401) return null;
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Ошибка(`Ошибка to load session (${res.status})`);
    }
    const direct = toSession(payload);
    if (direct) return direct;
    const nested = payload && typeof payload === "object" ? toSession((payload as Record<string, unknown>).data) : null;
    return nested;
  },

  signInПочта: async (input: { email: string; password: string }) => {
    await authPost("/sign-in/email", input);
  },

  signUpПочта: async (input: { name: string; email: string; password: string }) => {
    await authPost("/sign-up/email", input);
  },

  getПрофиль: async (): Promise<CurrentUserПрофиль> => {
    const res = await fetch("/api/auth/profile", {
      credentials: "include",
      headers: { Принять: "application/json" },
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Ошибка((payload as { error?: string } | null)?.error ?? `Ошибка to load profile (${res.status})`);
    }
    return currentUserПрофильSchema.parse(payload);
  },

  updateПрофиль: async (input: ОбновитьCurrentUserПрофиль): Promise<CurrentUserПрофиль> =>
    authPatch("/profile", input, (payload) => currentUserПрофильSchema.parse(payload)),

  signOut: async () => {
    await authPost("/sign-out", {});
  },
};
