import { useEffect, useMemo, useRef } from "react";
import {
  useExternalStoreЗапуститьtime,
  type ThreadMessage,
  type AppendMessage,
  type ExternalStoreАдаптер,
} from "@assistant-ui/react";

export interface PaperclipЗадачаЗапуститьtimeReassignment {
  assigneeАгентId: string | null;
  assigneeUserId: string | null;
}

export interface PaperclipЗадачаЗапуститьtimeОтправитьOptions {
  body: string;
  reopen?: boolean;
  reassignment?: PaperclipЗадачаЗапуститьtimeReassignment;
}

interface UsePaperclipЗадачаЗапуститьtimeOptions {
  messages: readonly ThreadMessage[];
  isВыполняется: boolean;
  onОтправить: (options: PaperclipЗадачаЗапуститьtimeОтправитьOptions) => Promise<void>;
  onОтмена?: (() => Promise<void>) | undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readTextContent(message: AppendMessage) {
  return message.content
    .filter((part): part is Extract<(typeof message.content)[number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

export function usePaperclipЗадачаЗапуститьtime({
  messages,
  isВыполняется,
  onОтправить,
  onОтмена,
}: UsePaperclipЗадачаЗапуститьtimeOptions) {
  const onОтправитьRef = useRef(onОтправить);
  const onОтменаRef = useRef(onОтмена);

  useEffect(() => {
    onОтправитьRef.current = onОтправить;
  }, [onОтправить]);

  useEffect(() => {
    onОтменаRef.current = onОтмена;
  }, [onОтмена]);

  const adapter = useMemo<ExternalStoreАдаптер<ThreadMessage>>(() => ({
    messages,
    isВыполняется,
    onNew: async (message) => {
      const body = readTextContent(message);
      if (!body) return;

      const custom = asRecord(message.runConfig?.custom);
      const reassignmentRecord = asRecord(custom?.reassignment);
      const reassignment =
        reassignmentRecord &&
        ("assigneeАгентId" in reassignmentRecord || "assigneeUserId" in reassignmentRecord)
          ? {
              assigneeАгентId:
                typeof reassignmentRecord.assigneeАгентId === "string" ? reassignmentRecord.assigneeАгентId : null,
              assigneeUserId:
                typeof reassignmentRecord.assigneeUserId === "string" ? reassignmentRecord.assigneeUserId : null,
            }
          : undefined;

      await onОтправитьRef.current({
        body,
        reopen: custom?.reopen === true ? true : undefined,
        reassignment,
      });
    },
    ...(onОтмена ? {
      onОтмена: async () => {
        await onОтменаRef.current?.();
      },
    } : {}),
  }), [messages, isВыполняется, !!onОтмена]);

  return useExternalStoreЗапуститьtime(adapter);
}
