"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { TextSelection } from "@notra/schemas/dashboard/content";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
} from "lexical";
import { useEffect, useRef } from "react";

interface SelectionPluginProps {
  onSelectionChange: (selection: TextSelection | null) => void;
  selectedExcerpt: TextSelection | null;
}

function getLineAndCharFromOffset(
  text: string,
  offset: number
): { line: number; char: number } {
  const lines = text.substring(0, offset).split("\n");
  return {
    line: lines.length,
    char: (lines.at(-1)?.length ?? 0) + 1,
  };
}

export function SelectionPlugin({
  onSelectionChange,
  selectedExcerpt,
}: SelectionPluginProps) {
  const [editor] = useLexicalComposerContext();
  const selectedExcerptRef = useRef(selectedExcerpt);

  useEffect(() => {
    const shouldCollapseEditorSelection =
      selectedExcerpt === null && selectedExcerptRef.current !== null;
    selectedExcerptRef.current = selectedExcerpt;
    if (!shouldCollapseEditorSelection) {
      return;
    }
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection) && !selection.isCollapsed()) {
        $setSelection(null);
      }
    });
  }, [editor, selectedExcerpt]);

  useEffect(() => {
    const unregister = editor.registerUpdateListener(
      ({ editorState, prevEditorState }) => {
        const previousSelection = prevEditorState.read(() => $getSelection());
        editorState.read(() => {
          const selection = $getSelection();
          if (
            selection === null ||
            (selectedExcerptRef.current !== null &&
              selection.is(previousSelection))
          ) {
            return;
          }
          if (!($isRangeSelection(selection) && !selection.isCollapsed())) {
            selectedExcerptRef.current = null;
            onSelectionChange(null);
            return;
          }

          const text = selection.getTextContent().trim();
          if (!text) {
            selectedExcerptRef.current = null;
            onSelectionChange(null);
            return;
          }

          const root = $getRoot();
          const fullText = root.getTextContent();

          const anchor = selection.anchor;
          const focus = selection.focus;

          let anchorOffset = 0;
          let focusOffset = 0;
          let anchorFound = false;
          let focusFound = false;

          const nodes = root.getAllTextNodes();
          for (const node of nodes) {
            const nodeKey = node.getKey();
            const nodeLength = node.getTextContent().length;

            if (nodeKey === anchor.key) {
              anchorOffset += anchor.offset;
              anchorFound = true;
            } else if (!anchorFound) {
              anchorOffset += nodeLength;
            }

            if (nodeKey === focus.key) {
              focusOffset += focus.offset;
              focusFound = true;
            } else if (!focusFound) {
              focusOffset += nodeLength;
            }
          }

          const startOffset = Math.min(anchorOffset, focusOffset);
          const endOffset = Math.max(anchorOffset, focusOffset);

          const start = getLineAndCharFromOffset(fullText, startOffset);
          const end = getLineAndCharFromOffset(fullText, endOffset);

          const nextSelection = {
            text,
            startLine: start.line,
            startChar: start.char,
            endLine: end.line,
            endChar: end.char,
          };
          selectedExcerptRef.current = nextSelection;
          onSelectionChange(nextSelection);
        });
      }
    );

    return () => {
      unregister();
    };
  }, [editor, onSelectionChange]);

  return null;
}
