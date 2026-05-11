export const KEYBOARD_SHORTCUT_TEXT_INPUT_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']",
  "[role='textbox']",
  "[role='combobox']",
].join(", ");

const PAGE_SEARCH_SHORTCUT_SELECTOR = "[data-page-search-target='true']";
const MODIFIER_ONLY_KEYS = new Set(["Shift", "Meta", "Control", "Alt"]);

export type ВходящиеQuickАрхивироватьКлючAction = "ignore" | "archive" | "disarm";
export type ВходящиеUndoАрхивироватьКлючAction = "ignore" | "undo_archive";
export type ЗадачаDetailGoКлючAction = "ignore" | "arm" | "navigate_inbox" | "focus_comment" | "disarm";

export function isКлючboardShortcutTextInputЦель(target: EventЦель | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentИзменитьable) return true;
  return !!target.closest(KEYBOARD_SHORTCUT_TEXT_INPUT_SELECTOR);
}

export function hasBlockingShortcutDialog(root: РодительНетde = document): boolean {
  return !!root.querySelector("[role='dialog'][aria-modal='true']");
}

function isVisibleShortcutЦель(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  if ("disabled" in element && typeof element.disabled === "boolean" && element.disabled) return false;
  if (element.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
  if (element.closest("[role='dialog'][aria-modal='true']")) return false;

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;

  return element.getClientRects().length > 0 || element === document.activeElement;
}

export function findPageПоискShortcutЦель(root: РодительНетde = document): HTMLElement | null {
  const candidates = Array.from(root.querySelectorВсе<HTMLElement>(PAGE_SEARCH_SHORTCUT_SELECTOR));
  return candidates.find((candidate) => isVisibleShortcutЦель(candidate)) ?? null;
}

export function focusPageПоискShortcutЦель(root: РодительНетde = document): boolean {
  const target = findPageПоискShortcutЦель(root);
  if (!target) return false;

  target.focus();
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.select();
  }
  return true;
}

export function shouldBlurPageПоискOnEnter({
  key,
  isComposing,
}: {
  key: string;
  isComposing: boolean;
}): boolean {
  return key === "Enter" && !isComposing;
}

export function shouldBlurPageПоискOnEscape({
  key,
  isComposing,
  currentЗначение,
}: {
  key: string;
  isComposing: boolean;
  currentЗначение: string;
}): boolean {
  return key === "Escape" && !isComposing && currentЗначение.length === 0;
}

export function isModifierOnlyКлюч(key: string): boolean {
  return MODIFIER_ONLY_KEYS.has(key);
}

export function resolveВходящиеQuickАрхивироватьКлючAction({
  armed,
  defaultPrevented,
  key,
  metaКлюч,
  ctrlКлюч,
  altКлюч,
  target,
  hasOpenDialog,
}: {
  armed: boolean;
  defaultPrevented: boolean;
  key: string;
  metaКлюч: boolean;
  ctrlКлюч: boolean;
  altКлюч: boolean;
  target: EventЦель | null;
  hasOpenDialog: boolean;
}): ВходящиеQuickАрхивироватьКлючAction {
  if (!armed) return "ignore";
  if (defaultPrevented) return "ignore";
  if (metaКлюч || ctrlКлюч || altКлюч || isModifierOnlyКлюч(key)) return "ignore";
  if (hasOpenDialog || isКлючboardShortcutTextInputЦель(target)) return "ignore";
  if (key.toНизкийerCase() === "y") return "archive";
  return "ignore";
}

export function resolveВходящиеUndoАрхивироватьКлючAction({
  hasUndoableАрхивировать,
  defaultPrevented,
  key,
  metaКлюч,
  ctrlКлюч,
  altКлюч,
  target,
  hasOpenDialog,
}: {
  hasUndoableАрхивировать: boolean;
  defaultPrevented: boolean;
  key: string;
  metaКлюч: boolean;
  ctrlКлюч: boolean;
  altКлюч: boolean;
  target: EventЦель | null;
  hasOpenDialog: boolean;
}): ВходящиеUndoАрхивироватьКлючAction {
  if (!hasUndoableАрхивировать) return "ignore";
  if (defaultPrevented) return "ignore";
  if (metaКлюч || ctrlКлюч || altКлюч || isModifierOnlyКлюч(key)) return "ignore";
  if (hasOpenDialog || isКлючboardShortcutTextInputЦель(target)) return "ignore";
  if (key === "u") return "undo_archive";
  return "ignore";
}

export function resolveЗадачаDetailGoКлючAction({
  armed,
  defaultPrevented,
  key,
  metaКлюч,
  ctrlКлюч,
  altКлюч,
  target,
  hasOpenDialog,
}: {
  armed: boolean;
  defaultPrevented: boolean;
  key: string;
  metaКлюч: boolean;
  ctrlКлюч: boolean;
  altКлюч: boolean;
  target: EventЦель | null;
  hasOpenDialog: boolean;
}): ЗадачаDetailGoКлючAction {
  if (defaultPrevented) return armed ? "disarm" : "ignore";
  if (metaКлюч || ctrlКлюч || altКлюч || isModifierOnlyКлюч(key)) return "ignore";
  if (hasOpenDialog || isКлючboardShortcutTextInputЦель(target)) {
    return armed ? "disarm" : "ignore";
  }

  const normalizedКлюч = key.toНизкийerCase();
  if (!armed) return normalizedКлюч === "g" ? "arm" : "ignore";
  if (normalizedКлюч === "i") return "navigate_inbox";
  if (normalizedКлюч === "c") return "focus_comment";
  if (normalizedКлюч === "g") return "arm";
  return "disarm";
}
