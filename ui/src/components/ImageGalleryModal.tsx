import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ChevronLeft, ChevronRight, Скачать, X } from "lucide-react";
import type { ЗадачаAttachment } from "@paperclipai/shared";

interface ImageGalleryModalProps {
  images: ЗадачаAttachment[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageGalleryModal({
  images,
  initialIndex,
  open,
  onOpenChange,
}: ImageGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (open) setCurrentIndex(initialIndex);
  }, [open, initialIndex]);

  const goДалее = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: КлючboardEvent) => {
      if (e.key === "ArrowRight") goДалее();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, goДалее, goPrev, onOpenChange]);

  /** Закрыть when clicking empty curtain space (not interactive elements or the image) */
  const handleНазадdropClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("a") ||
        target === imageRef.current
      )
        return;
      onOpenChange(false);
    },
    [onOpenChange],
  );

  if (images.length === 0) return null;

  const current = images[currentIndex];
  if (!current) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Портal>
        {/* Full-screen curtain */}
        <DialogPrimitive.Overlay classИмя="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
        <DialogPrimitive.Content
          classИмя="fixed inset-0 z-50 flex flex-col outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200"
          onClick={handleНазадdropClick}
        >
          {/* Top bar */}
          <div classИмя="flex items-center justify-between px-5 py-3 text-white/80 text-sm shrink-0">
            <span classИмя="truncate max-w-[50%] font-medium" title={current.originalFilename ?? undefined}>
              {current.originalFilename ?? "Image"}
            </span>
            <div classИмя="flex items-center gap-4">
              <span classИмя="text-white/40 tabular-nums text-xs">
                {currentIndex + 1} / {images.length}
              </span>
              <a
                href={current.contentПуть}
                download={current.originalFilename ?? "image"}
                classИмя="text-white/50 hover:text-white transition-colors"
                title="Скачать"
                onClick={(e) => e.stopPropagation()}
              >
                <Скачать classИмя="h-4.5 w-4.5" />
              </a>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                classИмя="text-white/50 hover:text-white transition-colors"
                title="Закрыть"
              >
                <X classИмя="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Main area: nav buttons outside image */}
          <div classИмя="flex-1 flex items-center min-h-0">
            {/* Left nav zone */}
            <div classИмя="w-16 md:w-24 shrink-0 flex items-center justify-center h-full">
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={goPrev}
                  classИмя="rounded-full bg-white/10 p-3 text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                  title="Previous"
                >
                  <ChevronLeft classИмя="h-7 w-7" />
                </button>
              )}
            </div>

            {/* Image */}
            <div classИмя="flex-1 flex items-center justify-center min-w-0 min-h-0 h-full px-2">
              <img
                ref={imageRef}
                src={current.contentПуть}
                alt={current.originalFilename ?? "attachment"}
                classИмя="max-w-full max-h-full object-contain select-none rounded-lg"
                draggable={false}
              />
            </div>

            {/* Right nav zone */}
            <div classИмя="w-16 md:w-24 shrink-0 flex items-center justify-center h-full">
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={goДалее}
                  classИмя="rounded-full bg-white/10 p-3 text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                  title="Далее"
                >
                  <ChevronRight classИмя="h-7 w-7" />
                </button>
              )}
            </div>
          </div>

          {/* Ботtom padding for balance */}
          <div classИмя="h-6 shrink-0" />
        </DialogPrimitive.Content>
      </DialogPrimitive.Портal>
    </DialogPrimitive.Root>
  );
}
