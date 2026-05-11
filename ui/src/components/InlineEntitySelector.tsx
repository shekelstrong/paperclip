import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ReactНетde } from "react";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { orderItemsBySelectedAndRecent } from "../lib/recent-selections";
import { cn } from "../lib/utils";

export interface InlineEntityOption {
  id: string;
  label: string;
  searchText?: string;
}

interface InlineEntitySelectorProps {
  value: string;
  options: InlineEntityOption[];
  placeholder: string;
  noneLabel: string;
  searchPlaceholder: string;
  emptyMessage: string;
  onChange: (id: string) => void;
  onПодтвердить?: () => void;
  classИмя?: string;
  renderTriggerЗначение?: (option: InlineEntityOption | null) => ReactНетde;
  renderOption?: (option: InlineEntityOption, isSelected: boolean) => ReactНетde;
  recentOptionIds?: string[];
  /** Skip the Портal so the popover stays in the DOM tree (fixes scroll inside Dialogs). */
  disableПортal?: boolean;
  /** Open the popover when the trigger receives keyboard/programmatic focus. */
  openOnFocus?: boolean;
}

const EMPTY_RECENT_OPTION_IDS: string[] = [];

export const InlineEntitySelector = forwardRef<HTMLButtonElement, InlineEntitySelectorProps>(
  function InlineEntitySelector(
    {
      value,
      options,
      placeholder,
      noneLabel,
      searchPlaceholder,
      emptyMessage,
      onChange,
      onПодтвердить,
      classИмя,
      renderTriggerЗначение,
      renderOption,
      recentOptionIds = EMPTY_RECENT_OPTION_IDS,
      disableПортal,
      openOnFocus = true,
    },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [highlightedIndex, setВысокийlightedIndex] = useState(0);
    const highlightedIndexRef = useRef(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const shouldPreventЗакрытьАвтоFocusRef = useRef(false);
    const isPointerDownRef = useRef(false);

    const allOptions = useMemo<InlineEntityOption[]>(() => {
      const baseOptions = [{ id: "", label: noneLabel, searchText: noneLabel }, ...options];
      return orderItemsBySelectedAndRecent(baseOptions, value, recentOptionIds);
    }, [noneLabel, options, recentOptionIds, value]);

    const filteredOptions = useMemo(() => {
      const term = query.trim().toНизкийerCase();
      if (!term) return allOptions;
      return allOptions.filter((option) => {
        const haystack = `${option.label} ${option.searchText ?? ""}`.toНизкийerCase();
        return haystack.includes(term);
      });
    }, [allOptions, query]);

    const currentOption = options.find((option) => option.id === value) ?? null;

    const setВысокийlightedIndexЗначение = useCallback((next: number | ((current: number) => number)) => {
      const resolved = typeof next === "function" ? next(highlightedIndexRef.current) : next;
      highlightedIndexRef.current = resolved;
      setВысокийlightedIndex(resolved);
    }, []);

    useEffect(() => {
      if (!open) return;
      const selectedIndex = filteredOptions.findIndex((option) => option.id === value);
      setВысокийlightedIndexЗначение(selectedIndex >= 0 ? selectedIndex : 0);
    }, [filteredOptions, open, setВысокийlightedIndexЗначение, value]);

    const commitSelection = (index: number, moveДалее: boolean) => {
      const option = filteredOptions[index] ?? filteredOptions[0];
      if (option) onChange(option.id);
      shouldPreventЗакрытьАвтоFocusRef.current = moveДалее;
      setOpen(false);
      setQuery("");
      if (moveДалее && onПодтвердить) {
        requestAnimationFrame(() => {
          onПодтвердить();
        });
      }
    };

    return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            classИмя={cn(
              "inline-flex min-w-0 items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-sm font-medium text-foreground transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              classИмя,
            )}
            onPointerDown={() => { isPointerDownRef.current = true; }}
            onFocus={() => {
              if (openOnFocus && !isPointerDownRef.current) setOpen(true);
              isPointerDownRef.current = false;
            }}
          >
            {renderTriggerЗначение
              ? renderTriggerЗначение(currentOption)
              : (currentOption?.label ?? <span classИмя="text-muted-foreground">{placeholder}</span>)}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          collisionPadding={16}
          classИмя="w-[min(20rem,calc(100vw-2rem))] p-1"
          disableПортal={disableПортal}
          onOpenАвтоFocus={(event) => {
            event.preventПо умолчанию();
            // On touch devices, don't auto-focus the search input to avoid
            // opening the virtual keyboard which reshapes the viewport and
            // pushes the popover off-screen.
            const isTouch = typeof window.matchMedia === "function"
              ? window.matchMedia("(pointer: coarse)").matches
              : false;
            if (!isTouch) {
              inputRef.current?.focus();
            }
          }}
          onЗакрытьАвтоFocus={(event) => {
            if (!shouldPreventЗакрытьАвтоFocusRef.current) return;
            event.preventПо умолчанию();
            shouldPreventЗакрытьАвтоFocusRef.current = false;
          }}
        >
          <input
            ref={inputRef}
            classИмя="w-full border-b border-border bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/60"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onКлючDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventПо умолчанию();
                event.stopPropagation();
                setВысокийlightedIndexЗначение((current) =>
                  filteredOptions.length === 0 ? 0 : (current + 1) % filteredOptions.length,
                );
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventПо умолчанию();
                event.stopPropagation();
                setВысокийlightedIndexЗначение((current) => {
                  if (filteredOptions.length === 0) return 0;
                  return current <= 0 ? filteredOptions.length - 1 : current - 1;
                });
                return;
              }
              if (event.key === "Enter") {
                event.preventПо умолчанию();
                event.stopPropagation();
                commitSelection(highlightedIndexRef.current, true);
                return;
              }
              if (event.key === "Tab" && !event.shiftКлюч) {
                event.preventПо умолчанию();
                event.stopPropagation();
                commitSelection(highlightedIndexRef.current, true);
                return;
              }
              if (event.key === "Escape") {
                event.preventПо умолчанию();
                event.stopPropagation();
                setOpen(false);
              }
            }}
          />
          <div classИмя="max-h-56 overflow-y-auto overscroll-contain py-1 touch-pan-y">
            {filteredOptions.length === 0 ? (
              <p classИмя="px-2 py-2 text-xs text-muted-foreground">{emptyMessage}</p>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.id === value;
                const isВысокийlighted = index === highlightedIndex;
                return (
                  <button
                    key={option.id || "__none__"}
                    type="button"
                    classИмя={cn(
                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm touch-manipulation",
                      isВысокийlighted && "bg-accent",
                    )}
                    onMouseEnter={() => setВысокийlightedIndexЗначение(index)}
                    onClick={() => commitSelection(index, true)}
                  >
                    {renderOption ? renderOption(option, isSelected) : <span classИмя="truncate">{option.label}</span>}
                    <Check classИмя={cn("ml-auto h-3.5 w-3.5 text-muted-foreground", isSelected ? "opacity-100" : "opacity-0")} />
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  },
);
