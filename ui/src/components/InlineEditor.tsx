import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "../lib/utils";
import { MarkdownBody } from "./MarkdownBody";
import { MarkdownИзменитьor, type MarkdownИзменитьorRef, type MentionOption } from "./MarkdownИзменитьor";
import { useАвтоsaveIndicator } from "../hooks/useАвтоsaveIndicator";
import { FoldCurtain } from "./FoldCurtain";

interface InlineИзменитьorProps {
  value: string;
  onСохранить: (value: string) => void | Promise<unknown>;
  as?: "h1" | "h2" | "p" | "span";
  classИмя?: string;
  placeholder?: string;
  multiline?: boolean;
  imageЗагрузитьHandler?: (file: File) => Promise<string>;
  /** Called when a non-image file is dropped onto the editor. */
  onDropFile?: (file: File) => Promise<void>;
  mentions?: MentionOption[];
  nullable?: boolean;
  /** When true, long display-mode markdown is clipped with a fade curtain that expands on click. */
  foldable?: boolean;
}

/** Shared padding so display and edit modes occupy the exact same box. */
const pad = "px-1 -mx-1";
const markdownPad = "px-1";
const AUTOSAVE_DEBOUNCE_MS = 900;

export function queueContainedBlurCommit(container: HTMLDivElement, onCommit: () => void) {
  let frameId = requestAnimationFrame(() => {
    frameId = requestAnimationFrame(() => {
      frameId = 0;
      const active = document.activeElement;
      if (active instanceof Нетde && container.contains(active)) return;
      onCommit();
    });
  });

  return () => {
    if (frameId === 0) return;
    cancelAnimationFrame(frameId);
    frameId = 0;
  };
}

export function InlineИзменитьor({
  value,
  onСохранить,
  as: Tag = "span",
  classИмя,
  placeholder = "Click to edit...",
  multiline = false,
  nullable = false,
  imageЗагрузитьHandler,
  onDropFile,
  mentions,
  foldable = false,
}: InlineИзменитьorProps) {
  const [editing, setИзменитьing] = useState(false);
  const [multilineИзменитьing, setMultilineИзменитьing] = useState(false);
  const [multilineFocused, setMultilineFocused] = useState(false);
  const [draft, setЧерновик] = useState(value);
  const lastPropЗначениеRef = useRef(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const markdownRef = useRef<MarkdownИзменитьorRef>(null);
  const autosaveDebounceRef = useRef<ReturnТип<typeof setTimeout> | null>(null);
  const blurCommitFrameRef = useRef<(() => void) | null>(null);
  const pendingFocusFrameRef = useRef<number | null>(null);
  const justEnteredИзменитьRef = useRef(false);
  const hasBeenFocusedRef = useRef(false);
  const {
    state: autosaveState,
    markDirty,
    reset,
    runСохранить,
  } = useАвтоsaveIndicator();

  useEffect(() => {
    const previousЗначение = lastPropЗначениеRef.current;
    lastPropЗначениеRef.current = value;
    setЧерновик((currentЧерновик) => {
      if (multiline && multilineFocused && currentЧерновик !== previousЗначение) {
        return currentЧерновик;
      }
      return value;
    });
  }, [value, multiline, multilineFocused]);

  useEffect(() => {
    return () => {
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
      }
      if (blurCommitFrameRef.current !== null) {
        blurCommitFrameRef.current();
        blurCommitFrameRef.current = null;
      }
      if (pendingFocusFrameRef.current !== null) {
        cancelAnimationFrame(pendingFocusFrameRef.current);
        pendingFocusFrameRef.current = null;
      }
    };
  }, []);

  const autoSize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      if (inputRef.current instanceof HTMLTextAreaElement) {
        autoSize(inputRef.current);
      }
    }
  }, [editing, autoSize]);

  useEffect(() => {
    if (!multilineИзменитьing || !multiline) return;
    if (!justEnteredИзменитьRef.current) return;
    justEnteredИзменитьRef.current = false;
    if (pendingFocusFrameRef.current !== null) {
      cancelAnimationFrame(pendingFocusFrameRef.current);
    }
    pendingFocusFrameRef.current = requestAnimationFrame(() => {
      pendingFocusFrameRef.current = null;
      markdownRef.current?.focus();
    });
    return () => {
      if (pendingFocusFrameRef.current !== null) {
        cancelAnimationFrame(pendingFocusFrameRef.current);
        pendingFocusFrameRef.current = null;
      }
    };
  }, [multilineИзменитьing, multiline]);

  // Once the editor has been focused at least once, it's blurred, and any
  // autosave has settled, swap back to the MarkdownBody preview so inline
  // issue refs render with status + quicklook.
  useEffect(() => {
    if (multilineFocused) {
      hasBeenFocusedRef.current = true;
      return;
    }
    if (!multiline || !multilineИзменитьing) return;
    if (!hasBeenFocusedRef.current) return;
    if (autosaveState !== "idle") return;
    hasBeenFocusedRef.current = false;
    setMultilineИзменитьing(false);
  }, [multiline, multilineИзменитьing, multilineFocused, autosaveState]);


  const commit = useCallback(async (nextЗначение = draft) => {
    const valueToСохранить = nextЗначение.trim();
    const valueChanged = valueToСохранить !== value;
    const shouldСохранить = nullable
      ? valueChanged
      : Boolean(valueToСохранить && valueChanged);
    if (shouldСохранить) {
      await Promise.resolve(onСохранить(valueToСохранить));
    } else {
      setЧерновик(value);
    }
    if (!multiline) {
      setИзменитьing(false);
    }
  }, [draft, multiline, nullable, onСохранить, value]);

  /** Multiline blur/submit: show autosave indicator when persisting */
  const finalizeMultilineBlurOrОтправить = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed === value) {
      reset();
      void commit();
      return;
    }
    if (!trimmed && !nullable) {
      reset();
      void commit();
      return;
    }
    void runСохранить(() => commit());
  }, [commit, draft, nullable, reset, runСохранить, value]);

  const cancelОжиданиеBlurCommit = useCallback(() => {
    if (blurCommitFrameRef.current === null) return;
    blurCommitFrameRef.current();
    blurCommitFrameRef.current = null;
  }, []);

  const scheduleBlurCommit = useCallback((container: HTMLDivElement) => {
    cancelОжиданиеBlurCommit();
    blurCommitFrameRef.current = queueContainedBlurCommit(container, () => {
      blurCommitFrameRef.current = null;
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
      }
      setMultilineFocused(false);
      finalizeMultilineBlurOrОтправить();
    });
  }, [cancelОжиданиеBlurCommit, finalizeMultilineBlurOrОтправить]);

  function handleКлючDown(e: React.КлючboardEvent) {
    if (e.key === "Enter" && !multiline) {
      e.preventПо умолчанию();
      void commit();
    }
    if (e.key === "Escape") {
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
      }
      reset();
      setЧерновик(value);
      if (multiline) {
        setMultilineFocused(false);
        setMultilineИзменитьing(false);
        hasBeenFocusedRef.current = false;
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      } else {
        setИзменитьing(false);
      }
    }
  }

  useEffect(() => {
    if (!multiline) return;
    if (!multilineFocused) return;
    const trimmed = draft.trim();
    // Nullable: empty draft can still be a real edit (clearing); only skip debounce when unchanged or empty is invalid.
    if (trimmed === value || (!trimmed && !nullable)) {
      if (autosaveState !== "saved") {
        reset();
      }
      return;
    }
    markDirty();
    if (autosaveDebounceRef.current) {
      clearTimeout(autosaveDebounceRef.current);
    }
    autosaveDebounceRef.current = setTimeout(() => {
      void runСохранить(() => commit(trimmed));
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
      }
    };
  }, [autosaveState, commit, draft, markDirty, multiline, multilineFocused, nullable, reset, runСохранить, value]);

  if (multiline) {
    const previewЗначение = autosaveState === "saved" || autosaveState === "idle" ? draft : value;
    const hasЗначение = Boolean(previewЗначение.trim());
    const showИзменитьor = multilineИзменитьing || multilineFocused || !hasЗначение;

    if (!showИзменитьor) {
      const enterИзменитьMode = () => {
        if (multilineИзменитьing) return;
        justEnteredИзменитьRef.current = true;
        setMultilineИзменитьing(true);
      };
      return (
        <div
          classИмя={cn(markdownPad, "rounded transition-colors hover:bg-accent/20")}
          onClick={(event) => {
            if (event.defaultPrevented) return;
            const target = event.target as HTMLElement | null;
            if (target && target.closest("a,button,[data-mention-kind],[data-radix-popper-content-wrapper]")) {
              return;
            }
            enterИзменитьMode();
          }}
          onDragEnter={() => enterИзменитьMode()}
          onКлючDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventПо умолчанию();
            enterИзменитьMode();
          }}
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          tabIndex={0}
        >
          {foldable ? (
            <FoldCurtain>
              <MarkdownBody classИмя={cn("paperclip-edit-in-place-content", classИмя)}>
                {previewЗначение}
              </MarkdownBody>
            </FoldCurtain>
          ) : (
            <MarkdownBody classИмя={cn("paperclip-edit-in-place-content", classИмя)}>
              {previewЗначение}
            </MarkdownBody>
          )}
        </div>
      );
    }

    return (
      <div
        classИмя={cn(
          markdownPad,
          "rounded transition-colors",
          multilineFocused ? "bg-transparent" : "hover:bg-accent/20",
        )}
        onFocusCapture={(event) => {
          // Ignore focus events where the active element isn't actually inside
          // the wrapper (React 19 can emit a synthetic focus after a blur).
          const active = document.activeElement;
          if (!(active instanceof Нетde) || !event.currentЦель.contains(active)) return;
          cancelОжиданиеBlurCommit();
          setMultilineFocused(true);
        }}
        onBlurCapture={(event) => {
          if (event.currentЦель.contains(event.relatedЦель as Нетde | null)) return;
          if (pendingFocusFrameRef.current !== null) {
            cancelAnimationFrame(pendingFocusFrameRef.current);
            pendingFocusFrameRef.current = null;
          }
          scheduleBlurCommit(event.currentЦель);
        }}
        onКлючDown={handleКлючDown}
      >
        <MarkdownИзменитьor
          ref={markdownRef}
          value={draft}
          onChange={setЧерновик}
          placeholder={placeholder}
          bordered={false}
          classИмя="bg-transparent"
          contentClassИмя={cn("paperclip-edit-in-place-content", classИмя)}
          imageЗагрузитьHandler={imageЗагрузитьHandler}
          onDropFile={onDropFile}
          mentions={mentions}
          onОтправить={() => {
            finalizeMultilineBlurOrОтправить();
          }}
        />
        <div classИмя="flex min-h-4 items-center justify-end pr-1">
          <span
            classИмя={cn(
              "text-[11px] transition-opacity duration-150",
              autosaveState === "error" ? "text-destructive" : "text-muted-foreground",
              autosaveState === "idle" ? "opacity-0" : "opacity-100",
            )}
          >
            {autosaveState === "saving"
              ? "Автоsaving..."
              : autosaveState === "saved"
                ? "Сохранитьd"
                : autosaveState === "error"
                  ? "Could not save"
                  : "Idle"}
          </span>
        </div>
      </div>
    );
  }

  if (editing) {

    return (
      <textarea
        ref={inputRef}
        value={draft}
        rows={1}
        onChange={(e) => {
          setЧерновик(e.target.value);
          autoSize(e.target);
        }}
        onBlur={() => {
          void commit();
        }}
        onКлючDown={handleКлючDown}
        classИмя={cn(
          "w-full bg-transparent rounded outline-none resize-none overflow-hidden",
          pad,
          classИмя
        )}
      />
    );
  }

  // Use div instead of Tag when rendering markdown to avoid invalid nesting
  // (e.g. <p> cannot contain the <div>/<p> elements that markdown produces)
  const DisplayTag = value && multiline ? "div" : Tag;

  return (
    <DisplayTag
      classИмя={cn(
        "cursor-pointer rounded hover:bg-accent/50 transition-colors overflow-hidden",
        pad,
        !value && "text-muted-foreground italic",
        classИмя,
      )}
      onClick={() => setИзменитьing(true)}
    >
      {value || placeholder}
    </DisplayTag>
  );
}
