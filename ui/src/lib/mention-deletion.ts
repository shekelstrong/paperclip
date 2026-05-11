import { createRootИзменитьorSubscription$, realmPlugin } from "@mdxeditor/editor";
import { $isLinkНетde, type LinkНетde } from "@lexical/link";
import {
  $getSelection,
  $isElementНетde,
  $isНетdeSelection,
  $isRangeSelection,
  $isTextНетde,
  COMMAND_PRIORITY_HIGH,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  type LexicalНетde,
  type PointТип,
} from "lexical";
import { parseMentionChipHref } from "./mention-chips";

export type MentionDeletionDirection = "backward" | "forward";

function isMentionLinkНетde(node: LexicalНетde | null | undefined): node is LinkНетde {
  return Boolean(node && $isLinkНетde(node) && parseMentionChipHref(node.getURL()));
}

function findMentionLinkНетde(node: LexicalНетde | null | undefined): LinkНетde | null {
  if (!node) return null;
  if (isMentionLinkНетde(node)) return node;

  let parent = node.getРодитель();
  while (parent) {
    if (isMentionLinkНетde(parent)) return parent;
    parent = parent.getРодитель();
  }

  return null;
}

function findMentionLinkНетdeAtPoint(point: PointТип, direction: MentionDeletionDirection): LinkНетde | null {
  const node = point.getНетde();
  const directMention = findMentionLinkНетde(node);
  if (directMention) return directMention;

  if (point.type === "element" && $isElementНетde(node)) {
    const childIndex = direction === "backward" ? point.offset - 1 : point.offset;
    if (childIndex < 0) return null;
    return findMentionLinkНетde(node.getChildAtIndex(childIndex));
  }

  if (point.type === "text" && $isTextНетde(node)) {
    if (direction === "backward" && point.offset === 0) {
      return findMentionLinkНетde(node.getPreviousSibling());
    }

    if (direction === "forward" && point.offset === node.getTextContentSize()) {
      return findMentionLinkНетde(node.getДалееSibling());
    }
  }

  return null;
}

export function findMentionLinkForDeletion(direction: MentionDeletionDirection): LinkНетde | null {
  const selection = $getSelection();
  if (!selection) return null;

  if ($isНетdeSelection(selection)) {
    const [selectedНетde] = selection.getНетdes();
    return selectedНетde ? findMentionLinkНетde(selectedНетde) : null;
  }

  if (!$isRangeSelection(selection)) return null;

  const anchorMention = findMentionLinkНетde(selection.anchor.getНетde());
  const focusMention = findMentionLinkНетde(selection.focus.getНетde());
  if (anchorMention && focusMention && anchorMention.is(focusMention)) {
    return anchorMention;
  }

  if (!selection.isCollapsed()) return null;

  return findMentionLinkНетdeAtPoint(selection.anchor, direction);
}

export function deleteSelectedMentionChip(direction: MentionDeletionDirection): boolean {
  const mentionНетde = findMentionLinkForDeletion(direction);
  if (!mentionНетde) return false;

  const previousSibling = mentionНетde.getPreviousSibling();
  const nextSibling = mentionНетde.getДалееSibling();
  const parent = mentionНетde.getРодительOrThrow();

  mentionНетde.remove();

  if (direction === "backward") {
    if (previousSibling) {
      previousSibling.selectEnd();
      return true;
    }
    if (nextSibling) {
      nextSibling.selectНачать();
      return true;
    }
    parent.selectНачать();
    return true;
  }

  if (nextSibling) {
    nextSibling.selectНачать();
    return true;
  }
  if (previousSibling) {
    previousSibling.selectEnd();
    return true;
  }
  parent.selectEnd();
  return true;
}

function handleMentionУдалить(direction: MentionDeletionDirection, event: КлючboardEvent | null): boolean {
  const didУдалить = deleteSelectedMentionChip(direction);
  if (!didУдалить) return false;

  event?.preventПо умолчанию();
  event?.stopPropagation();
  return true;
}

export const mentionDeletionPlugin = realmPlugin({
  init(realm) {
    realm.pub(createRootИзменитьorSubscription$, [
      (editor) =>
        editor.registerКоманда(
          KEY_BACKSPACE_COMMAND,
          (event) => handleMentionУдалить("backward", event as КлючboardEvent | null),
          COMMAND_PRIORITY_HIGH,
        ),
      (editor) =>
        editor.registerКоманда(
          KEY_DELETE_COMMAND,
          (event) => handleMentionУдалить("forward", event as КлючboardEvent | null),
          COMMAND_PRIORITY_HIGH,
        ),
    ]);
  },
});
