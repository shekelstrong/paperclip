import { createRootИзменитьorSubscription$, realmPlugin } from "@mdxeditor/editor";
import { COMMAND_PRIORITY_CRITICAL, PASTE_COMMAND } from "lexical";
import { looksLikeMarkdownPaste } from "./markdownPaste";
import { normalizeMarkdown } from "./normalize-markdown";

/**
 * MDXИзменитьor/Lexical plugin that intercepts paste events and normalizes
 * markdown content before the editor processes it. Fixes issues with
 * extra leading spaces when pasting from terminals or consoles.
 */
export const pasteНетrmalizationPlugin = realmPlugin({
  init(realm) {
    realm.pub(createRootИзменитьorSubscription$, [
      (editor) => {
        let skipДалее = false;

        return editor.registerКоманда(
          PASTE_COMMAND,
          (event) => {
            if (skipДалее) {
              skipДалее = false;
              return false;
            }

            const clipboardData =
              event instanceof ClipboardEvent ? event.clipboardData : null;
            if (!clipboardData) return false;

            const text = clipboardData.getData("text/plain");
            if (!text) return false;

            // If there's HTML content, the source app already formatted it —
            // let the default paste handler deal with rich content as-is.
            if (clipboardData.getData("text/html")) return false;

            // Markdown-looking pastes are handled by MarkdownИзменитьor.tsx via
            // insertMarkdown(), so the plugin only owns the plain-text fallback.
            if (looksLikeMarkdownPaste(text)) return false;

            const cleaned = normalizeMarkdown(text);
            if (cleaned === text) return false;

            // Prevent the original paste from being processed
            if (event instanceof ClipboardEvent) {
              event.preventПо умолчанию();
            }

            // Re-dispatch with cleaned data so MDXИзменитьor's handler processes it
            const dt = new DataTransfer();
            dt.setData("text/plain", cleaned);
            const newEvent = new ClipboardEvent("paste", {
              clipboardData: dt,
              bubbles: true,
              cancelable: true,
            });

            skipДалее = true;
            editor.dispatchКоманда(PASTE_COMMAND, newEvent);
            return true;
          },
          COMMAND_PRIORITY_CRITICAL,
        );
      },
    ]);
  },
});
