import { useCallback } from "react";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { ЗадачаПовторитьСейчасOutcome, ЗадачаПовторитьСейчасResponse } from "@paperclipai/shared";
import { ApiОшибка } from "../api/client";
import { issuesApi } from "../api/issues";
import { useToastActions } from "../context/ToastContext";
import { queryКлючs } from "../lib/queryКлючs";

export type ПовторитьСейчасОшибка = {
  message: string;
  outcomeMessage: string | null;
  status: number | null;
};

function readОшибкаMessage(error: unknown): string {
  if (error instanceof ApiОшибка) {
    if (typeof error.message === "string" && error.message.trim().length > 0) return error.message;
    return `Запрос не удался (${error.status})`;
  }
  if (error instanceof Ошибка && error.message) return error.message;
  return "Запрос не выполнен. Попробовать снова in a moment.";
}

export const RETRY_NOW_OUTCOME_HEADLINE: Record<ЗадачаПовторитьСейчасOutcome, string> = {
  promoted: "Повторить promoted",
  already_promoted: "Повторить already running",
  no_scheduled_retry: "Нет scheduled retry",
  gate_suppressed: "Couldn't retry now",
};

export function useПовторитьСейчасMutation(
  issueId: string | null | undefined,
): UseMutationResult<ЗадачаПовторитьСейчасResponse, unknown, void, unknown> & {
  lastОшибка: ПовторитьСейчасОшибка | null;
} {
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();

  const mutation = useMutation({
    mutationFn: () => {
      if (!issueId) throw new Ошибка("Missing issue id");
      return issuesApi.retryРасписаниеdПовторитьСейчас(issueId);
    },
    onУспешно: (response) => {
      if (issueId) {
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.detail(issueId) });
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activity(issueId) });
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.runs(issueId) });
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.liveЗапуститьs(issueId) });
        queryClient.invalidateQueries({ queryКлюч: queryКлючs.issues.activeЗапустить(issueId) });
      }
      if (response.outcome === "promoted") {
        pushToast({
          title: RETRY_NOW_OUTCOME_HEADLINE.promoted,
          body: response.message,
          tone: "success",
        });
      } else if (response.outcome === "gate_suppressed") {
        pushToast({
          title: RETRY_NOW_OUTCOME_HEADLINE.gate_suppressed,
          body: response.message,
          tone: "error",
        });
      }
    },
    onОшибка: (error) => {
      pushToast({
        title: "Couldn't retry now",
        body: readОшибкаMessage(error),
        tone: "error",
      });
    },
  });

  const reset = mutation.reset;
  const wrappedСбросить = useCallback(() => reset(), [reset]);

  const lastОшибка: ПовторитьСейчасОшибка | null = (() => {
    if (mutation.error) {
      const apiОшибка = mutation.error instanceof ApiОшибка ? mutation.error : null;
      return {
        message: readОшибкаMessage(mutation.error),
        outcomeMessage: null,
        status: apiОшибка?.status ?? null,
      };
    }
    if (mutation.data && mutation.data.outcome === "gate_suppressed") {
      return {
        message: mutation.data.message,
        outcomeMessage: mutation.data.message,
        status: null,
      };
    }
    return null;
  })();

  return {
    ...mutation,
    reset: wrappedСбросить,
    lastОшибка,
  } as UseMutationResult<ЗадачаПовторитьСейчасResponse, unknown, void, unknown> & {
    lastОшибка: ПовторитьСейчасОшибка | null;
  };
}
