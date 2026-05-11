import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { LiveEvent } from "@paperclipai/shared";
import { ApiОшибка } from "../../api/client";
import { instanceНастройкиApi } from "../../api/instanceНастройки";
import { heartbeatsApi } from "../../api/heartbeats";
import { buildTranscript, getUIАдаптер, onАдаптерChange, type ЗапуститьLogChunk, type TranscriptEntry } from "../../adapters";
import { queryКлючs } from "../../lib/queryКлючs";

const LOG_POLL_INTERVAL_MS = 2000;
const LOG_READ_LIMIT_BYTES = 256_000;
const EMPTY_RUN_LOG_CHUNKS: ЗапуститьLogChunk[] = [];

export interface ЗапуститьTranscriptSource {
  id: string;
  status: string;
  adapterТип: string;
  hasStoredOutput?: boolean;
  logBytes?: number | null;
  lastOutputBytes?: number | null;
}

interface UseLiveЗапуститьTranscriptsOptions {
  runs: ЗапуститьTranscriptSource[];
  companyId?: string | null;
  maxChunksPerЗапустить?: number;
  logPollIntervalMs?: number;
  logReadLimitBytes?: number;
  enableRealtimeОбновитьs?: boolean;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isTerminalСтатус(status: string): boolean {
  return status === "failed" || status === "timed_out" || status === "cancelled" || status === "succeeded";
}

function runKnownLogBytes(run: ЗапуститьTranscriptSource): number | null {
  const bytes = run.status === "queued"
    ? run.logBytes
    : run.lastOutputBytes ?? run.logBytes;
  return typeof bytes === "number" && Number.isFinite(bytes) && bytes > 0 ? bytes : null;
}

export function resolveInitialLogOffset(run: ЗапуститьTranscriptSource, limitBytes: number): number {
  const knownBytes = runKnownLogBytes(run);
  if (knownBytes === null) return 0;
  return Math.max(0, knownBytes - Math.max(0, limitBytes));
}

function parsePersistedLogContent(
  runId: string,
  content: string,
  pendingByЗапустить: Map<string, string>,
): Array<ЗапуститьLogChunk & { dedupeКлюч: string }> {
  if (!content) return [];

  const pendingКлюч = `${runId}:records`;
  const combined = `${pendingByЗапустить.get(pendingКлюч) ?? ""}${content}`;
  const split = combined.split("\n");
  pendingByЗапустить.set(pendingКлюч, split.pop() ?? "");

  const parsed: Array<ЗапуститьLogChunk & { dedupeКлюч: string }> = [];
  for (const line of split) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const raw = JSON.parse(trimmed) as { ts?: unknown; stream?: unknown; chunk?: unknown };
      const stream = raw.stream === "stderr" || raw.stream === "system" ? raw.stream : "stdout";
      const chunk = typeof raw.chunk === "string" ? raw.chunk : "";
      const ts = typeof raw.ts === "string" ? raw.ts : new Date().toISOString();
      if (!chunk) continue;
      parsed.push({
        ts,
        stream,
        chunk,
        dedupeКлюч: `log:${runId}:${ts}:${stream}:${chunk}`,
      });
    } catch {
      // Ignore malformed log rows.
    }
  }

  return parsed;
}

export function useLiveЗапуститьTranscripts({
  runs,
  companyId,
  maxChunksPerЗапустить = 200,
  logPollIntervalMs = LOG_POLL_INTERVAL_MS,
  logReadLimitBytes = LOG_READ_LIMIT_BYTES,
  enableRealtimeОбновитьs = true,
}: UseLiveЗапуститьTranscriptsOptions) {
  const runsКлюч = useMemo(
    () =>
      runs
        .map((run) => {
          const logBytes = typeof run.logBytes === "number" ? run.logBytes : "";
          const lastOutputBytes = typeof run.lastOutputBytes === "number" ? run.lastOutputBytes : "";
          return `${run.id}:${run.status}:${run.adapterТип}:${run.hasStoredOutput === true ? "1" : "0"}:${logBytes}:${lastOutputBytes}`;
        })
        .sort((a, b) => a.localeCompare(b))
        .join(","),
    [runs],
  );
  const normalizedЗапуститьs = useMemo(() => runs.map((run) => ({ ...run })), [runsКлюч]);
  const [chunksByЗапустить, setChunksByЗапустить] = useState<Map<string, ЗапуститьLogChunk[]>>(new Map());
  const [hydratedЗапуститьIds, setHydratedЗапуститьIds] = useState<Set<string>>(new Set());
  const seenChunkКлючsRef = useRef(new Set<string>());
  const pendingLogRowsByЗапуститьRef = useRef(new Map<string, string>());
  const logOffsetByЗапуститьRef = useRef(new Map<string, number>());
  const missingTerminalLogЗапуститьIdsRef = useRef(new Set<string>());
  const transcriptCacheRef = useRef(new Map<string, {
    adapterТип: string;
    chunks: ЗапуститьLogChunk[];
    censorUsernameInLogs: boolean;
    parserTick: number;
    transcript: TranscriptEntry[];
  }>());
  // Tick counter to force transcript recomputation when dynamic parser loads
  const [parserTick, setParserTick] = useState(0);
  useEffect(() => {
    return onАдаптерChange(() => setParserTick((t) => t + 1));
  }, []);
  const { data: generalНастройки } = useQuery({
    queryКлюч: queryКлючs.instance.generalНастройки,
    queryFn: () => instanceНастройкиApi.getОбщие(),
  });

  const runById = useMemo(() => new Map(normalizedЗапуститьs.map((run) => [run.id, run])), [normalizedЗапуститьs]);
  const activeЗапуститьIds = useMemo(
    () => new Set(normalizedЗапуститьs.filter((run) => !isTerminalСтатус(run.status)).map((run) => run.id)),
    [normalizedЗапуститьs],
  );
  const runIdsКлюч = useMemo(
    () => normalizedЗапуститьs.map((run) => run.id).sort((a, b) => a.localeCompare(b)).join(","),
    [normalizedЗапуститьs],
  );

  const appendChunks = (runId: string, chunks: Array<ЗапуститьLogChunk & { dedupeКлюч: string }>) => {
    if (chunks.length === 0) return;
    setChunksByЗапустить((prev) => {
      const next = new Map(prev);
      const existing = [...(next.get(runId) ?? [])];
      let changed = false;

      for (const chunk of chunks) {
        if (seenChunkКлючsRef.current.has(chunk.dedupeКлюч)) continue;
        seenChunkКлючsRef.current.add(chunk.dedupeКлюч);
        existing.push({ ts: chunk.ts, stream: chunk.stream, chunk: chunk.chunk });
        changed = true;
      }

      if (!changed) return prev;
      if (seenChunkКлючsRef.current.size > 12000) {
        seenChunkКлючsRef.current.clear();
      }
      next.set(runId, existing.slice(-maxChunksPerЗапустить));
      return next;
    });
  };

  useEffect(() => {
    const knownЗапуститьIds = new Set(normalizedЗапуститьs.map((run) => run.id));
    setChunksByЗапустить((prev) => {
      const next = new Map<string, ЗапуститьLogChunk[]>();
      for (const [runId, chunks] of prev) {
        if (knownЗапуститьIds.has(runId)) {
          next.set(runId, chunks);
        }
      }
      return next.size === prev.size ? prev : next;
    });
    setHydratedЗапуститьIds((prev) => {
      const next = new Set<string>();
      for (const runId of prev) {
        if (knownЗапуститьIds.has(runId)) {
          next.add(runId);
        }
      }
      return next.size === prev.size ? prev : next;
    });

    for (const key of pendingLogRowsByЗапуститьRef.current.keys()) {
      const runId = key.replace(/:records$/, "");
      if (!knownЗапуститьIds.has(runId)) {
        pendingLogRowsByЗапуститьRef.current.delete(key);
      }
    }
    for (const runId of logOffsetByЗапуститьRef.current.keys()) {
      if (!knownЗапуститьIds.has(runId)) {
        logOffsetByЗапуститьRef.current.delete(runId);
      }
    }
    for (const runId of missingTerminalLogЗапуститьIdsRef.current.keys()) {
      if (!knownЗапуститьIds.has(runId)) {
        missingTerminalLogЗапуститьIdsRef.current.delete(runId);
      }
    }
    for (const runId of transcriptCacheRef.current.keys()) {
      if (!knownЗапуститьIds.has(runId)) {
        transcriptCacheRef.current.delete(runId);
      }
    }
  }, [normalizedЗапуститьs]);

  useEffect(() => {
    if (normalizedЗапуститьs.length === 0) return;

    let cancelled = false;

    const readЗапуститьLog = async (run: ЗапуститьTranscriptSource) => {
      if (missingTerminalLogЗапуститьIdsRef.current.has(run.id)) {
        return;
      }
      const offset = logOffsetByЗапуститьRef.current.get(run.id) ?? resolveInitialLogOffset(run, logReadLimitBytes);
      try {
        const result = await heartbeatsApi.log(run.id, offset, logReadLimitBytes);
        if (cancelled) return;

        appendChunks(run.id, parsePersistedLogContent(run.id, result.content, pendingLogRowsByЗапуститьRef.current));

        if (result.nextOffset !== undefined) {
          logOffsetByЗапуститьRef.current.set(run.id, result.nextOffset);
          return;
        }
        if (result.content.length > 0) {
          logOffsetByЗапуститьRef.current.set(run.id, offset + result.content.length);
        }
      } catch (error) {
        if (error instanceof ApiОшибка && error.status === 404 && isTerminalСтатус(run.status)) {
          missingTerminalLogЗапуститьIdsRef.current.add(run.id);
        }
      } finally {
        if (!cancelled) {
          setHydratedЗапуститьIds((prev) => {
            if (prev.has(run.id)) return prev;
            const next = new Set(prev);
            next.add(run.id);
            return next;
          });
        }
      }
    };

    const readВсе = async () => {
      await Promise.all(normalizedЗапуститьs.map((run) => readЗапуститьLog(run)));
    };

    void readВсе();
    const activeЗапуститьs = normalizedЗапуститьs.filter((run) => !isTerminalСтатус(run.status));
    const interval = activeЗапуститьs.length > 0 && logPollIntervalMs > 0
      ? window.setInterval(() => {
          void Promise.all(activeЗапуститьs.map((run) => readЗапуститьLog(run)));
        }, logPollIntervalMs)
      : null;

    return () => {
      cancelled = true;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [logPollIntervalMs, logReadLimitBytes, normalizedЗапуститьs, runIdsКлюч]);

  useEffect(() => {
    if (!enableRealtimeОбновитьs) return;
    if (!companyId || activeЗапуститьIds.size === 0) return;

    let closed = false;
    let reconnectTimer: number | null = null;
    let socket: WebSocket | null = null;

    const scheduleReconnect = () => {
      if (closed) return;
      reconnectTimer = window.setTimeout(connect, 1500);
    };

    const connect = () => {
      if (closed) return;
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const url = `${protocol}://${window.location.host}/api/companies/${encodeURIComponent(companyId)}/events/ws`;
      socket = new WebSocket(url);

      socket.onmessage = (message) => {
        const raw = typeof message.data === "string" ? message.data : "";
        if (!raw) return;

        let event: LiveEvent;
        try {
          event = JSON.parse(raw) as LiveEvent;
        } catch {
          return;
        }

        if (event.companyId !== companyId) return;
        const payload = event.payload ?? {};
        const runId = readString(payload["runId"]);
        if (!runId || !activeЗапуститьIds.has(runId)) return;
        if (!runById.has(runId)) return;

        if (event.type === "heartbeat.run.log") {
          const chunk = readString(payload["chunk"]);
          if (!chunk) return;
          const ts = readString(payload["ts"]) ?? event.createdAt;
          const stream =
            readString(payload["stream"]) === "stderr"
              ? "stderr"
              : readString(payload["stream"]) === "system"
                ? "system"
                : "stdout";
          appendChunks(runId, [{
            ts,
            stream,
            chunk,
            dedupeКлюч: `log:${runId}:${ts}:${stream}:${chunk}`,
          }]);
          return;
        }

        if (event.type === "heartbeat.run.event") {
          const seq = typeof payload["seq"] === "number" ? payload["seq"] : null;
          const eventТип = readString(payload["eventТип"]) ?? "event";
          const messageText = readString(payload["message"]) ?? eventТип;
          appendChunks(runId, [{
            ts: event.createdAt,
            stream: eventТип === "error" ? "stderr" : "system",
            chunk: messageText,
            dedupeКлюч: `socket:event:${runId}:${seq ?? `${eventТип}:${messageText}:${event.createdAt}`}`,
          }]);
          return;
        }

        if (event.type === "heartbeat.run.status") {
          const status = readString(payload["status"]) ?? "updated";
          appendChunks(runId, [{
            ts: event.createdAt,
            stream: isTerminalСтатус(status) && status !== "succeeded" ? "stderr" : "system",
            chunk: `run ${status}`,
            dedupeКлюч: `socket:status:${runId}:${status}:${readString(payload["finishedAt"]) ?? ""}`,
          }]);
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      if (socket) {
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.CONNECTING) {
          // Defer the close until the handshake completes so the browser
          // does not emit a noisy "closed before the connection is established"
          // warning during rapid run teardown.
          socket.onopen = () => {
            socket?.close(1000, "live_run_transcripts_unmount");
          };
        } else if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000, "live_run_transcripts_unmount");
        }
      }
    };
  }, [activeЗапуститьIds, companyId, enableRealtimeОбновитьs, runById]);

  const transcriptByЗапустить = useMemo(() => {
    const next = new Map<string, TranscriptEntry[]>();
    const censorUsernameInLogs = generalНастройки?.censorUsernameInLogs === true;
    const cache = transcriptCacheRef.current;
    const currentЗапуститьIds = new Set<string>();
    for (const run of normalizedЗапуститьs) {
      currentЗапуститьIds.add(run.id);
      const chunks = chunksByЗапустить.get(run.id) ?? EMPTY_RUN_LOG_CHUNKS;
      const cached = cache.get(run.id);
      if (
        cached &&
        cached.adapterТип === run.adapterТип &&
        cached.chunks === chunks &&
        cached.censorUsernameInLogs === censorUsernameInLogs &&
        cached.parserTick === parserTick
      ) {
        next.set(run.id, cached.transcript);
        continue;
      }

      const adapter = getUIАдаптер(run.adapterТип);
      const transcript = buildTranscript(chunks, adapter, {
        censorUsernameInLogs,
      });
      cache.set(run.id, {
        adapterТип: run.adapterТип,
        chunks,
        censorUsernameInLogs,
        parserTick,
        transcript,
      });
      next.set(run.id, transcript);
    }
    for (const runId of cache.keys()) {
      if (!currentЗапуститьIds.has(runId)) {
        cache.delete(runId);
      }
    }
    return next;
  }, [chunksByЗапустить, generalНастройки?.censorUsernameInLogs, normalizedЗапуститьs, parserTick]);

  return {
    transcriptByЗапустить,
    isInitialHydrating: normalizedЗапуститьs.some((run) => !hydratedЗапуститьIds.has(run.id)),
    hasOutputForЗапустить(runId: string) {
      return (chunksByЗапустить.get(runId)?.length ?? 0) > 0 || runById.get(runId)?.hasStoredOutput === true;
    },
  };
}
