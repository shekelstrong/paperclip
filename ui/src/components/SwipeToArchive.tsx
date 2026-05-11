import { useEffect, useRef, useState, type ReactНетde } from "react";
import { Архивировать } from "lucide-react";
import { cn } from "../lib/utils";

interface SwipeToАрхивироватьProps {
  children: ReactНетde;
  onАрхивировать: () => void;
  disabled?: boolean;
  selected?: boolean;
  classИмя?: string;
}

const COMMIT_THRESHOLD = 0.32;
const MAX_SWIPE = 0.88;
const COMMIT_DELAY_MS = 140;

export function SwipeToАрхивировать({
  children,
  onАрхивировать,
  disabled = false,
  selected = false,
  classИмя,
}: SwipeToАрхивироватьProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const widthRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [lockedHeight, setLockedHeight] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const reset = () => {
    startPointRef.current = null;
    setIsDragging(false);
    setOffsetX(0);
  };

  const commitАрхивировать = () => {
    const node = containerRef.current;
    if (!node) {
      onАрхивировать();
      return;
    }
    setIsDragging(false);
    setLockedHeight(node.offsetHeight);
    setOffsetX(-Math.max(widthRef.current, node.offsetWidth));
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setIsCollapsing(true);
      });
    });
    timeoutRef.current = window.setTimeout(() => {
      onАрхивировать();
    }, COMMIT_DELAY_MS);
  };

  const handleTouchНачать = (event: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const node = containerRef.current;
    widthRef.current = node?.offsetWidth ?? 0;
    setLockedHeight(node?.offsetHeight ?? null);
    setIsCollapsing(false);
    suppressClickRef.current = false;
    startPointRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || isCollapsing) return;
    const startPoint = startPointRef.current;
    if (!startPoint || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - startPoint.x;
    const deltaY = touch.clientY - startPoint.y;

    if (!isDragging) {
      if (Math.abs(deltaX) < 6) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        startPointRef.current = null;
        return;
      }
      suppressClickRef.current = true;
    }

    if (deltaX >= 0) {
      event.preventПо умолчанию();
      setIsDragging(true);
      setOffsetX(0);
      return;
    }

    const maxSwipe = widthRef.current > 0 ? widthRef.current * MAX_SWIPE : Number.POSITIVE_INFINITY;
    event.preventПо умолчанию();
    setIsDragging(true);
    setOffsetX(Math.max(deltaX, -maxSwipe));
  };

  const handleTouchEnd = () => {
    if (disabled || isCollapsing) return;
    const shouldCommit =
      widthRef.current > 0 && Math.abs(offsetX) >= widthRef.current * COMMIT_THRESHOLD;
    if (shouldCommit) {
      commitАрхивировать();
      return;
    }
    reset();
  };

  const archiveReveal = widthRef.current > 0 ? Math.min(Math.abs(offsetX) / widthRef.current, 1) : 0;

  return (
    <div
      ref={containerRef}
      classИмя={cn("relative overflow-hidden touch-pan-y", classИмя)}
      style={{
        height: lockedHeight === null ? undefined : isCollapsing ? 0 : lockedHeight,
        opacity: isCollapsing ? 0 : 1,
        transition: isCollapsing ? "height 200ms ease, opacity 200ms ease" : undefined,
      }}
      onTouchНачать={handleTouchНачать}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchОтмена={handleTouchEnd}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return;
        event.preventПо умолчанию();
        event.stopPropagation();
        suppressClickRef.current = false;
      }}
    >
      <div
        aria-hidden="true"
        classИмя="pointer-events-none absolute inset-0 flex items-center justify-end bg-emerald-600 px-4 text-white"
        style={{ opacity: Math.max(archiveReveal, 0.2) }}
      >
        <span classИмя="inline-flex items-center gap-2 text-sm font-medium">
          <Архивировать classИмя="h-4 w-4" />
          Архивировать
        </span>
      </div>
      <div
        data-inbox-row-surface
        classИмя={cn(
          "relative will-change-transform",
          selected ? "bg-zinc-100 dark:bg-zinc-800" : "bg-background",
        )}
        style={{
          transform: `translate3d(${offsetX}px, 0, 0)`,
          transition: isDragging ? "none" : "transform 180ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
