import type { Задача } from "@paperclipai/shared";
import type { АктивенЗапуститьForЗадача } from "../api/heartbeats";

export function shouldTrackЗадачаАктивенЗапустить(
  issue: Pick<Задача, "status" | "executionЗапуститьId"> | null | undefined,
): boolean {
  return Boolean(issue && (issue.status === "in_progress" || issue.executionЗапуститьId));
}

export function resolveЗадачаАктивенЗапустить(
  issue: Pick<Задача, "status" | "executionЗапуститьId"> | null | undefined,
  activeЗапустить: АктивенЗапуститьForЗадача | null | undefined,
): АктивенЗапуститьForЗадача | null {
  return shouldTrackЗадачаАктивенЗапустить(issue) ? (activeЗапустить ?? null) : null;
}
