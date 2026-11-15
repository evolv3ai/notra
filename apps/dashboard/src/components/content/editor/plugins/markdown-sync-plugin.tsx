"use client";

import type { Transformer } from "@lexical/markdown";
import { $convertToMarkdownString } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HISTORY_MERGE_TAG } from "lexical";
import { useEffect } from "react";

import { stripReviewMarks } from "@/utils/review-markdown";

interface MarkdownSyncPluginProps {
  onChange: (markdown: string) => void;
  transformers: Transformer[];
  cleanReviewMarks?: boolean;
}

export function MarkdownSyncPlugin({
  onChange,
  transformers,
  cleanReviewMarks = false,
}: MarkdownSyncPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    let active = true;
    const syncMarkdown = () => {
      if (!active) {
        return;
      }
      editor.getEditorState().read(() => {
        const markdown = $convertToMarkdownString(transformers);
        onChange(cleanReviewMarks ? stripReviewMarks(markdown) : markdown);
      });
    };
    queueMicrotask(syncMarkdown);
    const unregister = editor.registerUpdateListener(
      ({ dirtyElements, dirtyLeaves, tags }) => {
        if (
          tags.has(HISTORY_MERGE_TAG) ||
          (dirtyElements.size === 0 && dirtyLeaves.size === 0)
        ) {
          return;
        }
        syncMarkdown();
      }
    );
    return () => {
      active = false;
      unregister();
    };
  }, [cleanReviewMarks, editor, onChange, transformers]);

  return null;
}
