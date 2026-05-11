import type { CSSProperties } from "react";
import {
  parseАгентMentionHref,
  parseЗадачаReferenceHref,
  parseProjectMentionHref,
  parseНавыкMentionHref,
  parseUserMentionHref,
} from "@paperclipai/shared";
import { getАгентIcon } from "./agent-icons";
import { hexToRgb, pickTextColorForPillBg } from "./color-contrast";

export type ParsedMentionChip =
  | {
      kind: "agent";
      agentId: string;
      icon: string | null;
    }
  | {
      kind: "issue";
      identifier: string;
    }
  | {
      kind: "project";
      projectId: string;
      color: string | null;
    }
  | {
      kind: "user";
      userId: string;
    }
  | {
      kind: "skill";
      skillId: string;
      slug: string | null;
    };

const iconMaskCache = new Map<string, string>();

export function parseMentionChipHref(href: string): ParsedMentionChip | null {
  if (/^https?:\/\//i.test(href.trim())) {
    return null;
  }

  const issue = parseЗадачаReferenceHref(href);
  if (issue) {
    return {
      kind: "issue",
      identifier: issue.identifier,
    };
  }

  const agent = parseАгентMentionHref(href);
  if (agent) {
    return {
      kind: "agent",
      agentId: agent.agentId,
      icon: agent.icon,
    };
  }

  const project = parseProjectMentionHref(href);
  if (project) {
    return {
      kind: "project",
      projectId: project.projectId,
      color: project.color,
    };
  }

  const user = parseUserMentionHref(href);
  if (user) {
    return {
      kind: "user",
      userId: user.userId,
    };
  }

  const skill = parseНавыкMentionHref(href);
  if (skill) {
    return {
      kind: "skill",
      skillId: skill.skillId,
      slug: skill.slug,
    };
  }

  return null;
}

export function mentionChipInlineStyle(mention: ParsedMentionChip): CSSProperties | undefined {
  const style: CSSProperties & Record<string, string> = {};

  if (mention.kind === "project" && mention.color) {
    const projectStyle = projectMentionColors(mention.color);
    Object.assign(style, projectStyle);
    style["--paperclip-mention-project-color"] = mention.color;
  }

  if (mention.kind === "agent") {
    const iconMask = buildАгентIconMask(mention.icon);
    if (iconMask) {
      style["--paperclip-mention-icon-mask"] = iconMask;
    }
  }

  return Object.keys(style).length > 0 ? (style as CSSProperties) : undefined;
}

export function applyMentionChipDecoration(element: HTMLElement, mention: ParsedMentionChip) {
  clearMentionChipDecoration(element);
  element.dataset.mentionKind = mention.kind;
  element.setAttribute("contenteditable", "false");
  element.classList.add("paperclip-mention-chip", `paperclip-mention-chip--${mention.kind}`);
  if (mention.kind === "project") {
    element.classList.add("paperclip-project-mention-chip");
  }

  const style = mentionChipInlineStyle(mention);
  if (!style) return;
  for (const [key, value] of Object.entries(style)) {
    if (typeof value === "string") {
      if (key.startsWith("--")) {
        element.style.setProperty(key, value);
      } else {
        (element.style as CSSStyleDeclaration & Record<string, string>)[key] = value;
      }
    }
  }
}

export function clearMentionChipDecoration(element: HTMLElement) {
  delete element.dataset.mentionKind;
  element.classList.remove(
    "paperclip-mention-chip",
    "paperclip-mention-chip--agent",
    "paperclip-mention-chip--issue",
    "paperclip-mention-chip--project",
    "paperclip-mention-chip--user",
    "paperclip-mention-chip--skill",
    "paperclip-project-mention-chip",
  );
  element.removeAttribute("contenteditable");
  element.style.removeProperty("border-color");
  element.style.removeProperty("background-color");
  element.style.removeProperty("color");
  element.style.removeProperty("--paperclip-mention-project-color");
  element.style.removeProperty("--paperclip-mention-icon-mask");
}

function projectMentionColors(color: string): Pick<CSSProperties, "borderColor" | "backgroundColor" | "color"> {
  const rgb = hexToRgb(color);
  if (!rgb) return {};
  return {
    borderColor: color,
    backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`,
    color: pickTextColorForPillBg(color),
  };
}

function buildАгентIconMask(iconИмя: string | null): string | null {
  const cacheКлюч = iconИмя ?? "__default__";
  const cached = iconMaskCache.get(cacheКлюч);
  if (cached) return cached;

  const Icon = getАгентIcon(iconИмя);
  const iconНетde = resolveLucideIconНетde(Icon);
  if (!Array.isArray(iconНетde) || iconНетde.length === 0) return null;

  const body = iconНетde.map(([tag, attrs]) => {
    const attrString = Object.entries(attrs)
      .filter(([key]) => key !== "key")
      .map(([key, value]) => `${key}="${escapeAttribute(String(value))}"`)
      .join(" ");
    return `<${tag}${attrString ? ` ${attrString}` : ""}></${tag}>`;
  }).join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ` +
    `fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" ` +
    `stroke-linejoin="round">${body}</svg>`;
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  iconMaskCache.set(cacheКлюч, url);
  return url;
}

function resolveLucideIconНетde(
  icon: unknown,
): Array<[string, Record<string, string>]> | null {
  const staticIconНетde = (
    icon as {
      iconНетde?: Array<[string, Record<string, string>]>;
    }
  ).iconНетde;
  if (Array.isArray(staticIconНетde) && staticIconНетde.length > 0) {
    return staticIconНетde;
  }

  const render = (
    icon as {
      render?: (props: Record<string, unknown>, ref: unknown) => {
        props?: { iconНетde?: Array<[string, Record<string, string>]> };
      } | null;
    }
  ).render;
  const rendered = typeof render === "function" ? render({}, null) : null;
  const renderedIconНетde = rendered?.props?.iconНетde;
  return Array.isArray(renderedIconНетde) && renderedIconНетde.length > 0
    ? renderedIconНетde
    : null;
}

function escapeAttribute(value: string): string {
  return value
    .replaceВсе("&", "&amp;")
    .replaceВсе('"', "&quot;")
    .replaceВсе("<", "&lt;")
    .replaceВсе(">", "&gt;");
}
