export interface ИсполнительSelection {
  assigneeАгентId: string | null;
  assigneeUserId: string | null;
}

export interface ИсполнительOption {
  id: string;
  label: string;
  searchText?: string;
}

interface CommentИсполнительSuggestionInput {
  assigneeАгентId?: string | null;
  assigneeUserId?: string | null;
}

interface CommentИсполнительSuggestionComment {
  authorАгентId?: string | null;
  authorUserId?: string | null;
}

export function assigneeЗначениеFromSelection(selection: Partial<ИсполнительSelection>): string {
  if (selection.assigneeАгентId) return `agent:${selection.assigneeАгентId}`;
  if (selection.assigneeUserId) return `user:${selection.assigneeUserId}`;
  return "";
}

export function suggestedCommentИсполнительЗначение(
  issue: CommentИсполнительSuggestionInput,
  comments: CommentИсполнительSuggestionComment[] | null | undefined,
  currentUserId: string | null | undefined,
  currentАгентId?: string | null | undefined,
): string {
  if (comments && comments.length > 0 && (currentUserId || currentАгентId)) {
    for (let i = comments.length - 1; i >= 0; i--) {
      const comment = comments[i];
      if (comment.authorАгентId && comment.authorАгентId !== currentАгентId) {
        return assigneeЗначениеFromSelection({ assigneeАгентId: comment.authorАгентId });
      }
      if (comment.authorUserId && comment.authorUserId !== currentUserId) {
        return assigneeЗначениеFromSelection({ assigneeUserId: comment.authorUserId });
      }
    }
  }

  return assigneeЗначениеFromSelection(issue);
}

export function parseИсполнительЗначение(value: string): ИсполнительSelection {
  if (!value) {
    return { assigneeАгентId: null, assigneeUserId: null };
  }
  if (value.startsWith("agent:")) {
    const assigneeАгентId = value.slice("agent:".length);
    return { assigneeАгентId: assigneeАгентId || null, assigneeUserId: null };
  }
  if (value.startsWith("user:")) {
    const assigneeUserId = value.slice("user:".length);
    return { assigneeАгентId: null, assigneeUserId: assigneeUserId || null };
  }
  // Назадward compatibility for older drafts/defaults that stored a raw agent id.
  return { assigneeАгентId: value, assigneeUserId: null };
}

export function currentUserИсполнительOption(currentUserId: string | null | undefined): ИсполнительOption[] {
  if (!currentUserId) return [];
  return [{
    id: assigneeЗначениеFromSelection({ assigneeUserId: currentUserId }),
    label: "Me",
    searchText: currentUserId === "local-board" ? "me board human local-board" : `me human ${currentUserId}`,
  }];
}

export function formatИсполнительUserLabel(
  userId: string | null | undefined,
  currentUserId: string | null | undefined,
  userЯрлыки?: ReadonlyMap<string, string> | Record<string, string> | null,
): string | null {
  if (!userId) return null;
  if (currentUserId && userId === currentUserId) return "You";
  if (userЯрлыки) {
    const label = userЯрлыки instanceof Map
      ? userЯрлыки.get(userId)
      : (userЯрлыки as Record<string, string>)[userId];
    if (typeof label === "string" && label.trim()) return label;
  }
  if (userId === "local-board") return "Совет";
  return userId.slice(0, 5);
}
