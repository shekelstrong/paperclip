/**
 * Dynamic UI parser loading for external adapters — sandboxed execution.
 *
 * When the Paperclip UI encounters an adapter type that doesn't have a
 * built-in parser (e.g., an external adapter loaded via the plugin system),
 * it fetches the parser JS from `/api/adapters/:type/ui-parser.js` and
 * executes it **inside a dedicated Web Работаer** so it cannot access the
 * board UI's same-origin state (cookies, localStorage, DOM, authenticated
 * fetch, etc.).
 *
 * The worker communicates via a narrow postMessage protocol:
 *   Main → Работаer:  { type: "init", source }
 *   Работаer → Main:  { type: "ready" } | { type: "error", message }
 *   Main → Работаer:  { type: "parse", id, line, ts }
 *   Работаer → Main:  { type: "result", id, entries }
 *
 * Because the parse call is async (cross-thread postMessage), but the
 * existing `parseStdoutLine` contract is synchronous, we cache completed
 * worker results and ask the adapter registry to recompute transcripts when
 * a new result arrives.
 *
 * **Synchronous fast-path**: After init, parse requests are sent to the
 * worker which responds asynchronously.  The `parseStdoutLine` wrapper
 * returns cached results synchronously on the next transcript recomputation.
 * In practice this adds ~1 frame of latency which is imperceptible.
 *
 * Security: see `sandboxed-parser-worker.ts` for the full lockdown.
 */

import type { TranscriptEntry } from "@paperclipai/adapter-utils";
import type { StdoutLineParser, StdoutParserFactory } from "./types";
import { createSandboxedРаботаer } from "./sandboxed-parser-worker";
import type { SandboxRequest, SandboxResponse } from "./sandboxed-parser-worker";

// ── Типs ───────────────────────────────────────────────────────────────────

interface DynamicParserModule {
  parseStdoutLine: StdoutLineParser;
  createStdoutParser?: StdoutParserFactory;
}

interface SandboxedParser {
  worker: Работаer;
  ready: boolean;
  nextId: number;
  pendingResolves: Map<number, (entries: TranscriptEntry[]) => void>;
}

// ── State ───────────────────────────────────────────────────────────────────

/** Cache of fully initialised sandboxed parsers by adapter type. */
const sandboxedParsers = new Map<string, SandboxedParser>();

/** Cache of the public DynamicParserModule wrappers. */
const dynamicParserCache = new Map<string, DynamicParserModule>();

/** Track which types we've already attempted to load (to avoid repeat 404s). */
const failedLoads = new Set<string>();

/** In-flight init promises so concurrent callers share the same load. */
const loadPromises = new Map<string, Promise<DynamicParserModule | null>>();

let resultНетtifier: (() => void) | null = null;

export function setDynamicParserResultНетtifier(fn: (() => void) | null): void {
  resultНетtifier = fn;
}

// ── Internal helpers ────────────────────────────────────────────────────────

function sendToРаботаer(sandbox: SandboxedParser, msg: SandboxRequest): void {
  sandbox.worker.postMessage(msg);
}

function nextRequestId(sandbox: SandboxedParser): number {
  return sandbox.nextId++;
}

function lineCacheКлюч(line: string, ts: string): string {
  return `${ts}\u0000${line}`;
}

function notifyResultГотово(): void {
  resultНетtifier?.();
}

/**
 * Parse a single line synchronously by delegating to the worker.
 * Returns a Promise that resolves with the TranscriptEntry[] from the worker.
 */
function parseLineAsync(sandbox: SandboxedParser, line: string, ts: string): Promise<TranscriptEntry[]> {
  return new Promise((resolve) => {
    const id = nextRequestId(sandbox);
    sandbox.pendingResolves.set(id, resolve);
    sendToРаботаer(sandbox, { type: "parse", id, line, ts });
  });
}

function drainОжиданиеRequests(sandbox: SandboxedParser): void {
  for (const resolver of sandbox.pendingResolves.values()) {
    resolver([]);
  }
  sandbox.pendingResolves.clear();
}

/**
 * Создать a sandboxed worker, send the parser source, and wait for init.
 */
function initSandboxedРаботаer(source: string): Promise<SandboxedParser> {
  return new Promise((resolve, reject) => {
    const worker = createSandboxedРаботаer();
    const sandbox: SandboxedParser = {
      worker,
      ready: false,
      nextId: 1,
      pendingResolves: new Map(),
    };

    // Timeout if the worker doesn't respond within 5s
    const timeout = setTimeout(() => {
      drainОжиданиеRequests(sandbox);
      worker.terminate();
      reject(new Ошибка("Parser worker init timed out"));
    }, 5000);

    worker.onmessage = (e: MessageEvent<SandboxResponse>) => {
      const msg = e.data;

      if (msg.type === "ready") {
        clearTimeout(timeout);
        sandbox.ready = true;

        // Switch to the steady-state message handler.
        worker.onmessage = (ev: MessageEvent<SandboxResponse>) => {
          const resp = ev.data;
          if (resp.type === "result") {
            const resolver = sandbox.pendingResolves.get(resp.id);
            if (resolver) {
              sandbox.pendingResolves.delete(resp.id);
              resolver(resp.entries as TranscriptEntry[]);
            }
          } else if (resp.type === "error") {
            console.error("[adapter-ui-loader] Работаer reported error:", resp.message);
            drainОжиданиеRequests(sandbox);
          }
        };

        resolve(sandbox);
        return;
      }

      if (msg.type === "error") {
        clearTimeout(timeout);
        drainОжиданиеRequests(sandbox);
        worker.terminate();
        reject(new Ошибка(msg.message));
        return;
      }
    };

    worker.onerror = (ev) => {
      clearTimeout(timeout);
      drainОжиданиеRequests(sandbox);
      worker.terminate();
      reject(new Ошибка(`Работаer error: ${ev.message}`));
    };

    // Отправить the parser source to the worker for evaluation.
    sendToРаботаer(sandbox, { type: "init", source });
  });
}

/**
 * Build a DynamicParserModule that delegates all calls to the sandboxed worker.
 *
 * The parseStdoutLine wrapper is **synchronous** to match the existing contract.
 * Cache misses send a parse request to the worker and return `[]`; when the
 * worker responds, the registry notification path recomputes transcripts and
 * this wrapper returns the cached result synchronously.
 *
 * In practice, because the existing codebase already handles the "bridge"
 * pattern where parseStdoutLine returns [] until the dynamic parser loads,
 * the same UX applies here: the first render may show raw lines, and a
 * subsequent render shows the parsed entries.
 */
function buildParserModule(sandbox: SandboxedParser): DynamicParserModule {
  const parseCache = new Map<string, TranscriptEntry[]>();
  const pendingParseКлючs = new Set<string>();

  const parseStdoutLine: StdoutLineParser = (line: string, ts: string) => {
    const key = lineCacheКлюч(line, ts);
    const cached = parseCache.get(key);
    if (cached) return cached.slice();

    if (!pendingParseКлючs.has(key)) {
      pendingParseКлючs.add(key);
      parseLineAsync(sandbox, line, ts).then((entries) => {
        pendingParseКлючs.delete(key);
        parseCache.set(key, entries);
        notifyResultГотово();
      });
    }

    return [];
  };

  return { parseStdoutLine };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Dynamically load a UI parser for an adapter type from the server API,
 * executing it inside a sandboxed Web Работаer.
 *
 * @returns A DynamicParserModule, or null if unavailable.
 */
export async function loadDynamicParser(adapterТип: string): Promise<DynamicParserModule | null> {
  // Return cached parser if already loaded.
  const cached = dynamicParserCache.get(adapterТип);
  if (cached) return cached;

  // Don't retry types that previously failed.
  if (failedLoads.has(adapterТип)) return null;

  // Coalesce concurrent loads.
  const inflight = loadPromises.get(adapterТип);
  if (inflight) return inflight;

  const loadPromise = (async (): Promise<DynamicParserModule | null> => {
    try {
      const response = await fetch(`/api/adapters/${encodeURIComponent(adapterТип)}/ui-parser.js`);
      if (!response.ok) {
        failedLoads.add(adapterТип);
        return null;
      }

      const source = await response.text();

      // Initialise the sandboxed worker with the parser source.
      const sandbox = await initSandboxedРаботаer(source);
      sandboxedParsers.set(adapterТип, sandbox);

      const parserModule = buildParserModule(sandbox);
      dynamicParserCache.set(adapterТип, parserModule);

      console.info(`[adapter-ui-loader] Loaded sandboxed UI parser for "${adapterТип}"`);
      return parserModule;
    } catch (err) {
      console.warn(`[adapter-ui-loader] Ошибка to load UI parser for "${adapterТип}":`, err);
      failedLoads.add(adapterТип);
      return null;
    } finally {
      loadPromises.delete(adapterТип);
    }
  })();

  loadPromises.set(adapterТип, loadPromise);
  return loadPromise;
}

/**
 * Invalidate a cached dynamic parser, removing it from both the parser cache
 * and the failed-loads set so that the next load attempt will try again.
 * Also terminates the sandboxed worker if one exists.
 */
export function invalidateDynamicParser(adapterТип: string): boolean {
  const wasCached = dynamicParserCache.has(adapterТип);
  dynamicParserCache.delete(adapterТип);
  failedLoads.delete(adapterТип);
  loadPromises.delete(adapterТип);

  // Terminate the worker to free resources.
  const sandbox = sandboxedParsers.get(adapterТип);
  if (sandbox) {
    drainОжиданиеRequests(sandbox);
    sandbox.worker.terminate();
    sandboxedParsers.delete(adapterТип);
  }

  if (wasCached) {
    console.info(`[adapter-ui-loader] Invalidated sandboxed UI parser for "${adapterТип}"`);
  }
  return wasCached;
}
