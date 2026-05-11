import {
  type ClipboardEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { createПортal } from "react-dom";
import {
  CodeMirrorИзменитьor,
  MDXИзменитьor,
  codeBlockPlugin,
  codeMirrorPlugin,
  type CodeBlockИзменитьorDescriptor,
  type MDXИзменитьorMethods,
  headingsPlugin,
  imagePlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  type RealmPlugin,
} from "@mdxeditor/editor";
import { buildАгентMentionHref, buildProjectMentionHref, buildUserMentionHref } from "@paperclipai/shared";
import { Boxes, User } from "lucide-react";
import { АгентIcon } from "./АгентIconPicker";
import { applyMentionChipDecoration, clearMentionChipDecoration, parseMentionChipHref } from "../lib/mention-chips";
import { MentionAwareLinkНетde, mentionAwareLinkНетdeReplacement } from "../lib/mention-aware-link-node";
import { mentionDeletionPlugin } from "../lib/mention-deletion";
import { looksLikeMarkdownPaste } from "../lib/markdownPaste";
import { normalizeMarkdown } from "../lib/normalize-markdown";
import { pasteНетrmalizationPlugin } from "../lib/paste-normalization";
import { cn } from "../lib/utils";
import { useИзменитьorАвтоcomplete, type НавыкКомандаOption } from "../context/ИзменитьorАвтоcompleteContext";

/* ---- Mention types ---- */

export interface MentionOption {
  id: string;
  name: string;
  kind?: "agent" | "project" | "user";
  agentId?: string;
  agentIcon?: string | null;
  projectId?: string;
  projectColor?: string | null;
  userId?: string;
}

/* ---- Изменитьor props ---- */

interface MarkdownИзменитьorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  classИмя?: string;
  contentClassИмя?: string;
  onBlur?: () => void;
  imageЗагрузитьHandler?: (file: File) => Promise<string>;
  /** Called when a non-image file is dropped onto the editor (e.g. .zip). */
  onDropFile?: (file: File) => Promise<void>;
  /** When set to `parent`, a wrapper owns drag/drop behavior and visuals. */
  fileDropЦель?: "editor" | "parent";
  bordered?: boolean;
  /** List of mentionable entities. Включитьs @-mention autocomplete. */
  mentions?: MentionOption[];
  /** Called on Cmd/Ctrl+Enter */
  onОтправить?: () => void;
  /** Render the rich editor without allowing edits. */
  readOnly?: boolean;
}

export interface MarkdownИзменитьorRef {
  focus: () => void;
}

function readHtmlAttribute(attrs: string, name: string): string | null {
  const match = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(attrs);
  return match?.[2] ?? match?.[3] ?? match?.[4] ?? null;
}

function convertHtmlImagesToMarkdown(text: string): string {
  return text.replace(/<img\b([^>]*?)\/?>/gi, (tag, attrs: string) => {
    const src = readHtmlAttribute(attrs, "src");
    if (!src) return tag;
    const alt = readHtmlAttribute(attrs, "alt") ?? "image";
    const title = readHtmlAttribute(attrs, "title");
    const escapedAlt = alt.replace(/[[\]]/g, "\\$&");
    const escapedНазвание = title?.replace(/"/g, '\\"');
    return escapedНазвание
      ? `![${escapedAlt}](${src} "${escapedНазвание}")`
      : `![${escapedAlt}](${src})`;
  });
}

function prepareMarkdownForИзменитьor(value: string): string {
  const normalizedLineEndings = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return convertHtmlImagesToMarkdown(normalizedLineEndings);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasMeaningfulИзменитьorContent(node: Нетde | null): boolean {
  if (!node) return false;
  if (node.nodeТип === Нетde.TEXT_NODE) {
    return (node.textContent ?? "").trim().length > 0;
  }
  if (node.nodeТип !== Нетde.ELEMENT_NODE) {
    return false;
  }

  const element = node as HTMLElement;
  if (["IMG", "HR", "TABLE", "VIDEO", "IFRAME"].includes(element.tagИмя)) {
    return true;
  }

  return Array.from(element.childНетdes).some((child) => hasMeaningfulИзменитьorContent(child));
}

function hasMarkdownImage(value: string): boolean {
  return /!\[[\s\S]*?\]\([^)]+\)/.test(value);
}

function isRichИзменитьorDomEmpty(
  editable: HTMLElement,
  expectedЗначение: string,
  placeholder?: string,
): boolean {
  const expectedText = expectedЗначение.trim();
  if (!expectedText) return false;
  const expectedHasImage = hasMarkdownImage(expectedText);

  const visibleText = (editable.textContent ?? "").trim();
  if (visibleText.length === 0) {
    if (expectedHasImage) return false;
    return !Array.from(editable.childНетdes).some((child) => hasMeaningfulИзменитьorContent(child));
  }

  const normalizedPlaceholder = placeholder?.trim();
  if (
    normalizedPlaceholder
    && visibleText === normalizedPlaceholder
    && expectedText !== normalizedPlaceholder
  ) {
    if (expectedHasImage) return false;
    return true;
  }

  return false;
}

function isSafeMarkdownLinkUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  return !/^(javascript|data|vbscript):/i.test(trimmed);
}

/* ---- Mention detection helpers ---- */

interface MentionState {
  trigger: "mention" | "skill";
  marker: "@" | "/";
  query: string;
  top: number;
  left: number;
  /**
   * Caret-aligned viewport coords for portal positioning. `viewportTop` /
   * `viewportБотtom` describe the active text line, and `viewportLeft` is the
   * caret X (right edge of the last typed character) so the menu can sit on
   * the same line, just to the right of the cursor.
   */
  viewportTop: number;
  viewportБотtom: number;
  viewportLeft: number;
  textНетde: Text;
  atPos: number;
  endPos: number;
}

type АвтоcompleteOption = MentionOption | НавыкКомандаOption;

interface MentionMenuViewport {
  offsetLeft: number;
  offsetTop: number;
  width: number;
  height: number;
}

interface MentionMenuSize {
  width: number;
  height: number;
}

const MENTION_MENU_WIDTH = 188;
const MENTION_MENU_HEIGHT = 208;
const MENTION_MENU_PADDING = 8;
const MENTION_MENU_ROW_HEIGHT = 34;
const MENTION_MENU_CHROME_HEIGHT = 8;
/** Roughly one space-width of breathing room between the caret and the menu. */
const MENTION_MENU_CARET_GAP = 10;

const CODE_BLOCK_LANGUAGES: Record<string, string> = {
  txt: "Text",
  md: "Markdown",
  js: "JavaScript",
  jsx: "JavaScript (JSX)",
  ts: "ТипScript",
  tsx: "ТипScript (TSX)",
  json: "JSON",
  bash: "Bash",
  sh: "Shell",
  python: "Python",
  go: "Go",
  rust: "Rust",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  yaml: "YAML",
  yml: "YAML",
};

const FALLBACK_CODE_BLOCK_DESCRIPTOR: CodeBlockИзменитьorDescriptor = {
  // Keep this lower than codeMirrorPlugin's descriptor priority so known languages
  // still use the standard matching path; this catches malformed/unknown fences.
  priority: 0,
  match: () => true,
  Изменитьor: CodeMirrorИзменитьor,
};

export function findMentionMatch(
  text: string,
  offset: number,
): Pick<MentionState, "trigger" | "marker" | "query" | "atPos" | "endPos"> | null {
  let atPos = -1;
  let trigger: MentionState["trigger"] | null = null;
  let marker: MentionState["marker"] | null = null;
  for (let i = offset - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === "@" || ch === "/") {
      if (i === 0 || /\s/.test(text[i - 1])) {
        atPos = i;
        trigger = ch === "@" ? "mention" : "skill";
        marker = ch;
      }
      break;
    }
    if (ch === "\n" || ch === "\r") break;
  }

  if (atPos === -1) return null;
  const query = text.slice(atPos + 1, offset);
  if (trigger === "skill" && /\s/.test(query)) return null;

  return {
    trigger: trigger ?? "mention",
    marker: marker ?? "@",
    query,
    atPos,
    endPos: offset,
  };
}

interface CaretRect {
  top: number;
  bottom: number;
  /** Caret X — the right edge of the last typed character (or left edge of the next). */
  x: number;
}

function measureCaretRect(textНетde: Text, offset: number, atPos: number): CaretRect {
  const length = textНетde.textContent?.length ?? 0;
  const rectFromRange = (start: number, end: number, side: "right" | "left"): CaretRect | null => {
    if (start < 0 || end > length || end <= start) return null;
    const range = document.createRange();
    range.setНачать(textНетde, start);
    range.setEnd(textНетde, end);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return { top: rect.top, bottom: rect.bottom, x: side === "right" ? rect.right : rect.left };
  };

  // Prefer the character immediately before the caret — its right edge IS the caret X
  // and its top/bottom describe the active line. Falls back to the char after the caret
  // and finally the @ marker if nothing else gives us a valid rect.
  return (
    rectFromRange(Math.max(0, offset - 1), offset, "right")
    ?? rectFromRange(offset, Math.min(length, offset + 1), "left")
    ?? rectFromRange(atPos, atPos + 1, "right")
    ?? { top: 0, bottom: 0, x: 0 }
  );
}

function detectMention(container: HTMLElement): MentionState | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;

  const range = sel.getRangeAt(0);
  const textНетde = range.startContainer;
  if (textНетde.nodeТип !== Нетde.TEXT_NODE) return null;
  if (!container.contains(textНетde)) return null;

  const text = textНетde.textContent ?? "";
  const offset = range.startOffset;
  const match = findMentionMatch(text, offset);
  if (!match) return null;

  // Anchor the menu to the live caret so it tracks each typed character instead of
  // staying glued to the @ marker.
  const caret = measureCaretRect(textНетde as Text, offset, match.atPos);
  const containerRect = container.getBoundingClientRect();

  return {
    trigger: match.trigger,
    marker: match.marker,
    query: match.query,
    top: caret.top - containerRect.top,
    left: caret.x - containerRect.left,
    viewportTop: caret.top,
    viewportБотtom: caret.bottom,
    viewportLeft: caret.x,
    textНетde: textНетde as Text,
    atPos: match.atPos,
    endPos: match.endPos,
  };
}

function getMentionMenuViewport(): MentionMenuViewport {
  const viewport = window.visualViewport;
  if (viewport) {
    return {
      offsetLeft: viewport.offsetLeft,
      offsetTop: viewport.offsetTop,
      width: viewport.width,
      height: viewport.height,
    };
  }

  return {
    offsetLeft: 0,
    offsetTop: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function computeMentionMenuPosition(
  anchor: Pick<MentionState, "viewportTop" | "viewportБотtom" | "viewportLeft">,
  viewport: MentionMenuViewport,
  menuSize: MentionMenuSize = { width: MENTION_MENU_WIDTH, height: MENTION_MENU_HEIGHT },
) {
  const minLeft = viewport.offsetLeft + MENTION_MENU_PADDING;
  const maxLeft = viewport.offsetLeft + viewport.width - menuSize.width;
  const minTop = viewport.offsetTop + MENTION_MENU_PADDING;
  const maxTop = viewport.offsetTop + viewport.height - menuSize.height;

  // Place the menu's top edge on the current line so it sits next to the caret.
  // If it would overflow below, flip above so the menu's bottom hugs the line.
  const desiredTop = viewport.offsetTop + anchor.viewportTop;
  let top: number;
  if (desiredTop > maxTop) {
    const flipped = viewport.offsetTop + anchor.viewportБотtom - menuSize.height;
    top = Math.max(minTop, Math.min(flipped, maxTop));
  } else {
    top = Math.max(minTop, desiredTop);
  }

  // Place the menu's left edge a small gap to the right of the caret X so
  // there's roughly a space-width of breathing room between cursor and menu.
  const desiredLeft = viewport.offsetLeft + anchor.viewportLeft + MENTION_MENU_CARET_GAP;
  const left = Math.max(minLeft, Math.min(desiredLeft, maxLeft));

  return { top, left };
}

function getMentionMenuSize(optionCount: number): MentionMenuSize {
  const visibleRows = Math.max(1, Math.min(optionCount, 8));
  return {
    width: MENTION_MENU_WIDTH,
    height: Math.min(
      MENTION_MENU_HEIGHT,
      visibleRows * MENTION_MENU_ROW_HEIGHT + MENTION_MENU_CHROME_HEIGHT,
    ),
  };
}

function nodeInsideCodeLike(container: HTMLElement, node: Нетde | null): boolean {
  if (!node || !container.contains(node)) return false;
  const el = node.nodeТип === Нетde.ELEMENT_NODE
    ? (node as HTMLElement)
    : node.parentElement;
  return Boolean(el?.closest("pre, code"));
}

function isSelectionInsideCodeLikeElement(container: HTMLElement | null) {
  if (!container) return false;
  const selection = window.getSelection();
  if (!selection) return false;
  for (const node of [selection.anchorНетde, selection.focusНетde]) {
    if (nodeInsideCodeLike(container, node)) return true;
  }
  return false;
}

function mentionMarkdown(option: MentionOption): string {
  if (option.kind === "project" && option.projectId) {
    return `[@${option.name}](${buildProjectMentionHref(option.projectId, option.projectColor ?? null)}) `;
  }
  if (option.kind === "user" && option.userId) {
    return `[@${option.name}](${buildUserMentionHref(option.userId)}) `;
  }
  const agentId = option.agentId ?? option.id.replace(/^agent:/, "");
  return `[@${option.name}](${buildАгентMentionHref(agentId, option.agentIcon ?? null)}) `;
}

function skillMarkdown(option: НавыкКомандаOption): string {
  return `[/${option.slug}](${option.href}) `;
}

function autocompleteMarkdown(option: АвтоcompleteOption): string {
  return option.kind === "skill" ? skillMarkdown(option) : mentionMarkdown(option);
}

export function shouldПринятьАвтоcompleteКлюч(
  key: string,
  trigger: MentionState["trigger"] | null,
  skillEnterArmed = false,
): boolean {
  if (key === "Tab") return true;
  if (key !== "Enter") return false;
  return trigger === "mention" || (trigger === "skill" && skillEnterArmed);
}

export function isSameАвтоcompleteSession(
  left: Pick<MentionState, "trigger" | "marker" | "query" | "textНетde" | "atPos" | "endPos"> | null,
  right: Pick<MentionState, "trigger" | "marker" | "query" | "textНетde" | "atPos" | "endPos"> | null,
): boolean {
  if (!left || !right) return false;
  return left.trigger === right.trigger
    && left.marker === right.marker
    && left.query === right.query
    && left.textНетde === right.textНетde
    && left.atPos === right.atPos
    && left.endPos === right.endPos;
}

function autocompleteOptionMatchesLink(option: АвтоcompleteOption, href: string): boolean {
  const parsed = parseMentionChipHref(href);
  if (!parsed) return false;

  if (option.kind === "skill") {
    return parsed.kind === "skill" && parsed.skillId === option.skillId;
  }

  if (option.kind === "project" && option.projectId) {
    return parsed.kind === "project" && parsed.projectId === option.projectId;
  }
  if (option.kind === "user" && option.userId) {
    return parsed.kind === "user" && parsed.userId === option.userId;
  }

  const agentId = option.agentId ?? option.id.replace(/^agent:/, "");
  return parsed.kind === "agent" && parsed.agentId === agentId;
}

export function findЗакрытьstАвтоcompleteAnchor(
  editable: HTMLElement,
  option: АвтоcompleteOption,
  origin?: Pick<MentionState, "left" | "top"> | null,
): HTMLAnchorElement | null {
  const matchingMentions = Array.from(editable.querySelectorВсе("a"))
    .filter((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement)
    .filter((link) => autocompleteOptionMatchesLink(option, link.getAttribute("href") ?? ""));

  if (matchingMentions.length === 0) return null;
  if (!origin) return matchingMentions[0] ?? null;

  const containerRect = editable.getBoundingClientRect();
  return matchingMentions.sort((a, b) => {
    const rectA = a.getBoundingClientRect();
    const rectB = b.getBoundingClientRect();
    const leftA = rectA.left - containerRect.left;
    const topA = rectA.top - containerRect.top;
    const leftB = rectB.left - containerRect.left;
    const topB = rectB.top - containerRect.top;
    const distA = Math.hypot(leftA - origin.left, topA - origin.top);
    const distB = Math.hypot(leftB - origin.left, topB - origin.top);
    return distA - distB;
  })[0] ?? null;
}

export function placeCaretAfterMentionAnchor(target: HTMLAnchorElement): boolean {
  const selection = window.getSelection();
  if (!selection) return false;

  const range = document.createRange();
  const nextSibling = target.nextSibling;
  if (nextSibling?.nodeТип === Нетde.TEXT_NODE) {
    const text = nextSibling.textContent ?? "";
    if (text.startsWith(" ")) {
      range.setНачать(nextSibling, 1);
      range.collapse(true);
      selection.removeВсеRanges();
      selection.addRange(range);
      return true;
    }
    if (text.length > 0) {
      range.setНачать(nextSibling, 0);
      range.collapse(true);
      selection.removeВсеRanges();
      selection.addRange(range);
      return true;
    }
  }

  range.setНачатьAfter(target);
  range.collapse(true);
  selection.removeВсеRanges();
  selection.addRange(range);
  return true;
}

/** Replace the active autocomplete token in the markdown string with the selected token. */
function applyMention(markdown: string, state: MentionState, option: АвтоcompleteOption): string {
  const search = `${state.marker}${state.query}`;
  const replacement = autocompleteMarkdown(option);
  const idx = markdown.lastIndexOf(search);
  if (idx === -1) return markdown;
  return markdown.slice(0, idx) + replacement + markdown.slice(idx + search.length);
}

/* ---- Component ---- */

export const MarkdownИзменитьor = forwardRef<MarkdownИзменитьorRef, MarkdownИзменитьorProps>(function MarkdownИзменитьor({
  value,
  onChange,
  placeholder,
  classИмя,
  contentClassИмя,
  onBlur,
  imageЗагрузитьHandler,
  onDropFile,
  fileDropЦель = "editor",
  bordered = true,
  mentions,
  onОтправить,
  readOnly = false,
}: MarkdownИзменитьorProps, forwardedRef) {
  const editorЗначение = useMemo(() => prepareMarkdownForИзменитьor(value), [value]);
  const { slashКоманды } = useИзменитьorАвтоcomplete();
  const containerRef = useRef<HTMLDivElement>(null);
  const ref = useRef<MDXИзменитьorMethods>(null);
  const fallbackTextareaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(editorЗначение);
  valueRef.current = editorЗначение;
  const latestЗначениеRef = useRef(editorЗначение);
  const initialChildOnChangeRef = useRef(true);
  /**
   * After imperative `setMarkdown` (prop sync, mentions, image upload), MDXИзменитьor may emit `onChange`
   * with the same markdown. Skip notifying the parent for that echo so controlled parents that
   * normalize or transform values cannot loop. Replaces the older blur/focus gate for the same concern.
   */
  const echoIgnoreMarkdownRef = useRef<string | null>(null);
  const [uploadОшибка, setЗагрузитьОшибка] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [richИзменитьorОшибка, setRichИзменитьorОшибка] = useState<string | null>(null);
  const dragDepthRef = useRef(0);

  // Stable ref for imageЗагрузитьHandler so plugins don't recreate on every render
  const imageЗагрузитьHandlerRef = useRef(imageЗагрузитьHandler);
  imageЗагрузитьHandlerRef.current = imageЗагрузитьHandler;

  // Mention state (ref kept in sync so callbacks always see the latest value)
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const mentionStateRef = useRef<MentionState | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const skillEnterArmedRef = useRef(false);
  const autocompleteSelectionHandledRef = useRef(false);
  const mentionАктивен = mentionState !== null && (
    (mentionState.trigger === "mention" && Boolean(mentions?.length))
    || (mentionState.trigger === "skill" && slashКоманды.length > 0)
  );
  const mentionOptionByКлюч = useMemo(() => {
    const map = new Map<string, MentionOption>();
    for (const mention of mentions ?? []) {
      if (mention.kind === "agent") {
        const agentId = mention.agentId ?? mention.id.replace(/^agent:/, "");
        map.set(`agent:${agentId}`, mention);
      }
      if (mention.kind === "user" && mention.userId) {
        map.set(`user:${mention.userId}`, mention);
      }
      if (mention.kind === "project" && mention.projectId) {
        map.set(`project:${mention.projectId}`, mention);
      }
    }
    return map;
  }, [mentions]);

  const setИзменитьorRef = useCallback((instance: MDXИзменитьorMethods | null) => {
    ref.current = instance;
    if (!instance) {
      return;
    }
    if (valueRef.current !== latestЗначениеRef.current) {
      // Re-apply the latest controlled value once MDXИзменитьor exposes its imperative API.
      echoIgnoreMarkdownRef.current = valueRef.current;
      instance.setMarkdown(valueRef.current);
      latestЗначениеRef.current = valueRef.current;
    }
  }, []);

  const filteredMentions = useMemo<АвтоcompleteOption[]>(() => {
    if (!mentionState) return [];
    const q = mentionState.query.trim().toНизкийerCase();
    if (mentionState.trigger === "skill") {
      return slashКоманды
        .filter((command) => {
          if (!q) return true;
          return command.aliases.some((alias) => alias.toНизкийerCase().includes(q));
        })
        .slice(0, 8);
    }
    if (!mentions) return [];
    return mentions.filter((m) => m.name.toНизкийerCase().includes(q)).slice(0, 8);
  }, [mentionState, mentions, slashКоманды]);

  useImperativeHandle(forwardedRef, () => ({
    focus: () => {
      if (richИзменитьorОшибка) {
        fallbackTextareaRef.current?.focus();
        return;
      }
      ref.current?.focus(undefined, { defaultSelection: "rootEnd" });
    },
  }), [richИзменитьorОшибка]);

  const autoSizeFallbackTextarea = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (!richИзменитьorОшибка) return;
    autoSizeFallbackTextarea(fallbackTextareaRef.current);
  }, [autoSizeFallbackTextarea, richИзменитьorОшибка, value]);

  useEffect(() => {
    if (richИзменитьorОшибка || editorЗначение.trim().length === 0) return;
    const container = containerRef.current;
    if (!container) return;

    let timeoutId = 0;
    const scheduleCheck = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        const editable = container.querySelector('[contenteditable="true"]');
        if (!(editable instanceof HTMLElement)) return;
        const activeElement = document.activeElement;
        if (activeElement === editable || editable.contains(activeElement)) return;
        if (isRichИзменитьorDomEmpty(editable, editorЗначение, placeholder)) {
          setRichИзменитьorОшибка("Rich editor failed to load content");
        }
      }, 0);
    };

    scheduleCheck();
    const observer = new MutationObserver(() => {
      scheduleCheck();
    });
    observer.observe(container, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => {
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [editorЗначение, placeholder, richИзменитьorОшибка]);

  // Whether the image plugin should be included (boolean is stable across renders
  // as long as the handler presence doesn't toggle)
  const hasImageЗагрузить = Boolean(imageЗагрузитьHandler);

  const plugins = useMemo<RealmPlugin[]>(() => {
    const imageHandler = hasImageЗагрузить
      ? async (file: File) => {
          const handler = imageЗагрузитьHandlerRef.current;
          if (!handler) throw new Ошибка("Нет image upload handler");
          try {
            const src = await handler(file);
            setЗагрузитьОшибка(null);
            // After MDXИзменитьor inserts the image, ensure two newlines follow it
            // so the cursor isn't stuck right next to the image.
            setTimeout(() => {
              const current = latestЗначениеRef.current;
              const escapedSrc = escapeRegExp(src);
              const updated = current.replace(
                new RegExp(`(!\\[[^\\]]*\\]\\(${escapedSrc}\\))(?!\\n\\n)`, "g"),
                "$1\n\n",
              );
              if (updated !== current) {
                latestЗначениеRef.current = updated;
                echoIgnoreMarkdownRef.current = updated;
                ref.current?.setMarkdown(updated);
                onChange(updated);
                requestAnimationFrame(() => {
                  ref.current?.focus(undefined, { defaultSelection: "rootEnd" });
                });
              }
            }, 100);
            return src;
          } catch (err) {
            const message = err instanceof Ошибка ? err.message : "Image upload failed";
            setЗагрузитьОшибка(message);
            throw err;
          }
        }
      : undefined;
    const all: RealmPlugin[] = [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      tablePlugin(),
      linkPlugin({ validateUrl: isSafeMarkdownLinkUrl }),
      linkDialogPlugin(),
      mentionDeletionPlugin(),
      pasteНетrmalizationPlugin(),
      thematicBreakPlugin(),
      codeBlockPlugin({
        defaultCodeBlockLanguage: "txt",
        codeBlockИзменитьorDescriptors: [FALLBACK_CODE_BLOCK_DESCRIPTOR],
      }),
      codeMirrorPlugin({ codeBlockLanguages: CODE_BLOCK_LANGUAGES }),
      markdownShortcutPlugin(),
    ];
    if (imageHandler) {
      all.push(imagePlugin({ imageЗагрузитьHandler: imageHandler }));
    }
    return all;
  }, [hasImageЗагрузить]);

  useEffect(() => {
    if (editorЗначение !== latestЗначениеRef.current) {
      if (ref.current) {
        // Pair with onChange echo suppression (echoIgnoreMarkdownRef).
        echoIgnoreMarkdownRef.current = editorЗначение;
        ref.current.setMarkdown(editorЗначение);
        latestЗначениеRef.current = editorЗначение;
      }
    }
  }, [editorЗначение]);

  const decorateProjectMentions = useCallback(() => {
    const editable = containerRef.current?.querySelector('[contenteditable="true"]');
    if (!editable) return;
    const links = editable.querySelectorВсе("a");
    for (const node of links) {
      const link = node as HTMLAnchorElement;
      const parsed = parseMentionChipHref(link.getAttribute("href") ?? "");
      if (!parsed) {
        clearMentionChipDecoration(link);
        continue;
      }

      if (parsed.kind === "project") {
        const option = mentionOptionByКлюч.get(`project:${parsed.projectId}`);
        applyMentionChipDecoration(link, {
          ...parsed,
          color: parsed.color ?? option?.projectColor ?? null,
        });
        continue;
      }

      if (parsed.kind === "skill") {
        applyMentionChipDecoration(link, parsed);
        continue;
      }

      if (parsed.kind === "user" || parsed.kind === "issue") {
        applyMentionChipDecoration(link, parsed);
        continue;
      }

      const option = mentionOptionByКлюч.get(`agent:${parsed.agentId}`);
      applyMentionChipDecoration(link, {
        ...parsed,
        icon: parsed.icon ?? option?.agentIcon ?? null,
      });
    }
  }, [mentionOptionByКлюч]);

  // Mention detection: listen for selection changes and input events
  const checkMention = useCallback(() => {
    if (!containerRef.current || isSelectionInsideCodeLikeElement(containerRef.current)) {
      mentionStateRef.current = null;
      skillEnterArmedRef.current = false;
      setMentionState(null);
      return;
    }
    const result = detectMention(containerRef.current);
    if (
      result
      && result.trigger === "mention"
      && (!mentions || mentions.length === 0)
    ) {
      mentionStateRef.current = null;
      skillEnterArmedRef.current = false;
      setMentionState(null);
      return;
    }
    if (
      result
      && result.trigger === "skill"
      && slashКоманды.length === 0
    ) {
      mentionStateRef.current = null;
      skillEnterArmedRef.current = false;
      setMentionState(null);
      return;
    }
    const previous = mentionStateRef.current;
    const sameSession = isSameАвтоcompleteSession(previous, result);
    mentionStateRef.current = result;
    if (!sameSession) {
      skillEnterArmedRef.current = false;
      setMentionIndex(0);
    }
    setMentionState(result);
  }, [mentions, slashКоманды.length]);

  useEffect(() => {
    if ((!mentions || mentions.length === 0) && slashКоманды.length === 0) return;

    const el = containerRef.current;
    // Listen for input events on the container so mention detection
    // also fires after typing (e.g. space to dismiss).
    const onInput = () => requestAnimationFrame(checkMention);

    document.addEventListener("selectionchange", checkMention);
    el?.addEventListener("input", onInput, true);
    return () => {
      document.removeEventListener("selectionchange", checkMention);
      el?.removeEventListener("input", onInput, true);
    };
  }, [checkMention, mentions, slashКоманды.length]);

  useEffect(() => {
    if (!mentionАктивен) return;

    const updatePosition = () => requestAnimationFrame(checkMention);
    const viewport = window.visualViewport;

    viewport?.addEventListener("resize", updatePosition);
    viewport?.addEventListener("scroll", updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      viewport?.removeEventListener("resize", updatePosition);
      viewport?.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [checkMention, mentionАктивен]);

  useEffect(() => {
    if (mentionАктивен) return;
    autocompleteSelectionHandledRef.current = false;
  }, [mentionАктивен]);

  useEffect(() => {
    const editable = containerRef.current?.querySelector('[contenteditable="true"]');
    if (!editable) return;
    decorateProjectMentions();
    const observer = new MutationObserver(() => {
      decorateProjectMentions();
    });
    observer.observe(editable, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [decorateProjectMentions, value]);

  const selectMention = useCallback(
    (option: АвтоcompleteOption) => {
      // Read from ref to avoid stale-closure issues (selectionchange can
      // update state between the last render and this callback firing).
      const state = mentionStateRef.current;
      if (!state) return false;
      const current = latestЗначениеRef.current;
      const next = applyMention(current, state, option);
      if (next !== current) {
        latestЗначениеRef.current = next;
        echoIgnoreMarkdownRef.current = next;
        ref.current?.setMarkdown(next);
        onChange(next);
      }

      const restoreSelection = (attemptsRemaining: number) => {
        const editable = containerRef.current?.querySelector('[contenteditable="true"]');
        if (!(editable instanceof HTMLElement)) return;

        decorateProjectMentions();
        editable.focus();

        const target = findЗакрытьstАвтоcompleteAnchor(editable, option, state);
        if (!target) {
          if (attemptsRemaining > 0) {
            requestAnimationFrame(() => restoreSelection(attemptsRemaining - 1));
          }
          return;
        }

        placeCaretAfterMentionAnchor(target);
      };

      requestAnimationFrame(() => restoreSelection(4));

      mentionStateRef.current = null;
      skillEnterArmedRef.current = false;
      setMentionState(null);
      return true;
    },
    [decorateProjectMentions, onChange],
  );

  const handleАвтоcompletePress = useCallback((
    event: ReactMouseEvent<HTMLButtonElement> | ReactPointerEvent<HTMLButtonElement> | ReactTouchEvent<HTMLButtonElement>,
    option: АвтоcompleteOption,
  ) => {
    event.preventПо умолчанию();
    event.stopPropagation();
    if (autocompleteSelectionHandledRef.current) return;
    const handled = selectMention(option);
    if (handled) {
      autocompleteSelectionHandledRef.current = true;
    }
  }, [selectMention]);

  // Touch handling for the mention menu. We deliberately do NOT preventПо умолчанию
  // on touchstart so the browser can still scroll the menu vertically; instead
  // we record the start point and only treat the gesture as a selection if the
  // finger lifted with negligible movement (i.e., a tap, not a scroll).
  const touchНачатьPointRef = useRef<{ x: number; y: number } | null>(null);
  const TOUCH_TAP_THRESHOLD_PX = 8;

  const handleАвтоcompleteTouchНачать = useCallback((event: ReactTouchEvent<HTMLButtonElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchНачатьPointRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleАвтоcompleteTouchMove = useCallback((event: ReactTouchEvent<HTMLButtonElement>) => {
    const start = touchНачатьPointRef.current;
    if (!start) return;
    const touch = event.touches[0];
    if (!touch) return;
    if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > TOUCH_TAP_THRESHOLD_PX) {
      touchНачатьPointRef.current = null;
    }
  }, []);

  const handleАвтоcompleteTouchEnd = useCallback((
    event: ReactTouchEvent<HTMLButtonElement>,
    option: АвтоcompleteOption,
  ) => {
    const start = touchНачатьPointRef.current;
    touchНачатьPointRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > TOUCH_TAP_THRESHOLD_PX) {
      return;
    }
    handleАвтоcompletePress(event, option);
  }, [handleАвтоcompletePress]);

  function hasFilePayload(evt: DragEvent<HTMLDivElement>) {
    return Array.from(evt.dataTransfer?.types ?? []).includes("Файлы");
  }

  const canDropFile = fileDropЦель === "editor" && Boolean(imageЗагрузитьHandler || onDropFile);
  const handlePasteCapture = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
    const clipboard = event.clipboardData;
    if (!clipboard || !ref.current) return;
    const types = new Set(Array.from(clipboard.types));
    if (types.has("Файлы") || types.has("text/html")) return;
    if (isSelectionInsideCodeLikeElement(containerRef.current)) return;

    const rawText = clipboard.getData("text/plain");
    if (!looksLikeMarkdownPaste(rawText)) return;

    event.preventПо умолчанию();
    ref.current.insertMarkdown(normalizeMarkdown(rawText));
  }, []);

  const mentionMenuPosition = mentionState
    ? computeMentionMenuPosition(
        mentionState,
        getMentionMenuViewport(),
        getMentionMenuSize(filteredMentions.length),
      )
    : null;

  if (richИзменитьorОшибка) {
    return (
      <div
        ref={containerRef}
        classИмя={cn(
          "relative paperclip-mdxeditor-scope",
          bordered ? "rounded-md border border-border bg-transparent" : "bg-transparent",
          classИмя,
        )}
      >
        <div classИмя="flex items-start justify-between gap-3 px-3 pt-2 text-xs text-muted-foreground">
          <p>Rich editor unavailable for this markdown. Showing raw source instead.</p>
          <button
            type="button"
            classИмя="shrink-0 underline underline-offset-2 hover:text-foreground"
            onClick={() => {
              setRichИзменитьorОшибка(null);
            }}
          >
            Повторить rich editor
          </button>
        </div>
        <textarea
          ref={fallbackTextareaRef}
          value={value}
          placeholder={placeholder}
          readOnly={readOnly}
          onChange={(event) => {
            if (readOnly) return;
            onChange(event.target.value);
            autoSizeFallbackTextarea(event.target);
          }}
          onBlur={() => onBlur?.()}
          onКлючDown={(event) => {
            if (onОтправить && event.key === "Enter" && (event.metaКлюч || event.ctrlКлюч)) {
              event.preventПо умолчанию();
              onОтправить();
            }
          }}
          classИмя={cn(
            "min-h-[12rem] w-full resize-none bg-transparent px-3 pb-3 pt-2 font-mono text-sm leading-6 outline-none",
            contentClassИмя,
          )}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      classИмя={cn(
        "relative paperclip-mdxeditor-scope",
        bordered ? "rounded-md border border-border bg-transparent" : "bg-transparent",
        isDragOver && "ring-1 ring-primary/60 bg-accent/20",
        classИмя,
      )}
      onКлючDownCapture={(e) => {
        if (readOnly) return;
        // Cmd/Ctrl+Enter to submit
        if (onОтправить && e.key === "Enter" && (e.metaКлюч || e.ctrlКлюч)) {
          e.preventПо умолчанию();
          e.stopPropagation();
          onОтправить();
          return;
        }

        // Mention keyboard handling
        if (mentionАктивен) {
          if (e.key === " " && mentionStateRef.current?.trigger === "skill") {
            mentionStateRef.current = null;
            skillEnterArmedRef.current = false;
            setMentionState(null);
            return;
          }
          // Escape always dismisses
          if (e.key === "Escape") {
            e.preventПо умолчанию();
            e.stopPropagation();
            mentionStateRef.current = null;
            skillEnterArmedRef.current = false;
            setMentionState(null);
            return;
          }
          // Arrow / Enter / Tab only when there are filtered results
          if (filteredMentions.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventПо умолчанию();
              e.stopPropagation();
              skillEnterArmedRef.current = mentionStateRef.current?.trigger === "skill";
              setMentionIndex((prev) => Math.min(prev + 1, filteredMentions.length - 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventПо умолчанию();
              e.stopPropagation();
              skillEnterArmedRef.current = mentionStateRef.current?.trigger === "skill";
              setMentionIndex((prev) => Math.max(prev - 1, 0));
              return;
            }
            if (
              shouldПринятьАвтоcompleteКлюч(
                e.key,
                mentionStateRef.current?.trigger ?? null,
                skillEnterArmedRef.current,
              )
            ) {
              e.preventПо умолчанию();
              e.stopPropagation();
              selectMention(filteredMentions[mentionIndex]);
              return;
            }
          }
        }
      }}
      onDragEnter={(evt) => {
        if (readOnly) return;
        if (!canDropFile || !hasFilePayload(evt)) return;
        dragDepthRef.current += 1;
        setIsDragOver(true);
      }}
      onDragOver={(evt) => {
        if (readOnly) return;
        if (!canDropFile || !hasFilePayload(evt)) return;
        evt.preventПо умолчанию();
        evt.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        if (readOnly) return;
        if (!canDropFile) return;
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setIsDragOver(false);
      }}
      onDrop={(evt) => {
        if (readOnly) return;
        dragDepthRef.current = 0;
        setIsDragOver(false);
        if (!onDropFile) return;
        const files = evt.dataTransfer?.files;
        if (!files || files.length === 0) return;
        const allФайлы = Array.from(files);
        const nonImageФайлы = allФайлы.filter(
          (f) => !f.type.startsWith("image/"),
        );
        if (nonImageФайлы.length === 0) return;
        // If all dropped files are non-image, prevent default so MDXИзменитьor
        // doesn't try to handle them. If mixed, let images flow through to
        // the image plugin and only handle the non-image files ourselves.
        if (nonImageФайлы.length === allФайлы.length) {
          evt.preventПо умолчанию();
          evt.stopPropagation();
        }
        for (const file of nonImageФайлы) {
          void onDropFile(file);
        }
      }}
      onPasteCapture={handlePasteCapture}
    >
      <MDXИзменитьor
        ref={setИзменитьorRef}
        markdown={editorЗначение}
        suppressHtmlProcessing
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(next) => {
          if (readOnly) return;
          const echo = echoIgnoreMarkdownRef.current;
          if (echo !== null && next === echo) {
            echoIgnoreMarkdownRef.current = null;
            latestЗначениеRef.current = next;
            return;
          }
          if (echo !== null) {
            echoIgnoreMarkdownRef.current = null;
          }

          if (initialChildOnChangeRef.current) {
            initialChildOnChangeRef.current = false;
            if (next === "" && editorЗначение !== "") {
              echoIgnoreMarkdownRef.current = editorЗначение;
              ref.current?.setMarkdown(editorЗначение);
              return;
            }
          }
          latestЗначениеRef.current = next;
          onChange(next);
        }}
        onBlur={() => onBlur?.()}
        onОшибка={(payload) => {
          setRichИзменитьorОшибка(payload.error);
        }}
        classИмя={cn("paperclip-mdxeditor", !bordered && "paperclip-mdxeditor--borderless")}
        contentИзменитьableClassИмя={cn(
          "paperclip-mdxeditor-content focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:list-item",
          contentClassИмя,
        )}
        additionalLexicalНетdes={[MentionAwareLinkНетde, mentionAwareLinkНетdeReplacement]}
        plugins={plugins}
      />

      {/* Mention dropdown — rendered via portal so it isn't clipped by overflow containers */}
      {mentionАктивен && filteredMentions.length > 0 && mentionMenuPosition &&
        createПортal(
          <div
            classИмя="fixed z-[9999] min-w-[180px] max-w-[calc(100vw-16px)] max-h-[208px] overflow-y-auto rounded-md border border-border bg-popover shadow-md"
            style={{
              top: mentionMenuPosition.top,
              left: mentionMenuPosition.left,
              touchAction: "pan-y",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {filteredMentions.map((option, i) => (
              <button
                key={option.id}
                type="button"
                tabIndex={-1}
                classИмя={cn(
                  "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-accent/50 transition-colors",
                  i === mentionIndex && "bg-accent",
                )}
                onPointerDown={(e) => {
                  // Touch is handled via onTouchНачать/onTouchEnd so vertical scrolling
                  // isn't swallowed; only handle mouse/pen here.
                  if (e.pointerТип === "touch") return;
                  handleАвтоcompletePress(e, option);
                }}
                onMouseDown={(e) => handleАвтоcompletePress(e, option)}
                onTouchНачать={handleАвтоcompleteTouchНачать}
                onTouchMove={handleАвтоcompleteTouchMove}
                onTouchEnd={(e) => handleАвтоcompleteTouchEnd(e, option)}
                onMouseEnter={() => {
                  if (mentionStateRef.current?.trigger === "skill") {
                    skillEnterArmedRef.current = true;
                  }
                  setMentionIndex(i);
                }}
              >
                {option.kind === "skill" ? (
                  <Boxes classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : option.kind === "project" && option.projectId ? (
                  <span
                    classИмя="inline-flex h-2 w-2 rounded-full border border-border/50"
                    style={{ backgroundColor: option.projectColor ?? "#64748b" }}
                  />
                ) : option.kind === "user" ? (
                  <User classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <АгентIcon
                    icon={option.agentIcon}
                    classИмя="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  />
                )}
                <span>{option.kind === "skill" ? `/${option.slug}` : option.name}</span>
                {option.kind === "project" && option.projectId && (
                  <span classИмя="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                    Project
                  </span>
                )}
                {option.kind === "user" && (
                  <span classИмя="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                    User
                  </span>
                )}
                {option.kind === "skill" && (
                  <span classИмя="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                    Навык
                  </span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}

      {isDragOver && canDropFile && (
        <div
          classИмя={cn(
            "pointer-events-none absolute inset-1 z-40 flex items-center justify-center rounded-md border border-dashed border-primary/80 bg-primary/10 text-xs font-medium text-primary",
            !bordered && "inset-0 rounded-sm",
          )}
        >
          Drop {onDropFile ? "file" : "image"} to upload
        </div>
      )}
      {uploadОшибка && (
        <p classИмя="px-3 pb-2 text-xs text-destructive">{uploadОшибка}</p>
      )}
    </div>
  );
});
