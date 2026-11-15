"use client";

import {
  CodeIcon,
  Film01Icon,
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  ImageAdd01Icon,
  LeftToRightListNumberIcon,
  MinusSignIcon,
  ParagraphBulletsPoint01Icon,
  ParagraphIcon,
  QuoteUpIcon,
  Table01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { INSERT_HORIZONTAL_RULE_COMMAND } from "@lexical/extension";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import { cn } from "@notra/ui/lib/utils";
import {
  $createParagraphNode,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  type TextNode,
} from "lexical";
import { Fragment, useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "use-intl";

import { BlockPreview } from "@/components/content/editor/block-preview";
import {
  BLOCK_PICKER_GROUP_LABELS,
  BLOCK_PICKER_GROUPS,
  BLOCK_PICKER_SHORTCUTS,
} from "@/constants/block-picker";
import type { BlockPickerKind } from "@/types/content/block-picker";

import { $createKiboCodeBlockNode } from "../nodes/kibo-code-block-node";
import {
  OPEN_CONTENT_IMAGE_UPLOAD_COMMAND,
  OPEN_CONTENT_VIDEO_UPLOAD_COMMAND,
} from "./content-media-commands";

class ComponentPickerOption extends MenuOption {
  kind: BlockPickerKind;
  title: string;
  icon: React.ReactNode;
  keywords: string[];
  onSelect: (queryString: string) => void;

  constructor(
    kind: BlockPickerKind,
    title: string,
    options: {
      icon: React.ReactNode;
      keywords?: string[];
      onSelect: (queryString: string) => void;
    }
  ) {
    super(kind);
    this.kind = kind;
    this.title = title;
    this.icon = options.icon;
    this.keywords = options.keywords ?? [];
    this.onSelect = options.onSelect;
  }
}

function ComponentPickerMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option,
}: {
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  option: ComponentPickerOption;
}) {
  return (
    <div
      aria-selected={isSelected}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
        isSelected ? "bg-accent text-accent-foreground" : "text-foreground"
      )}
      id={`typeahead-item-${index}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={onMouseEnter}
      ref={(el) => {
        if (isSelected && el) {
          el.scrollIntoView({ block: "nearest" });
        }
      }}
      role="option"
      tabIndex={-1}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center",
          isSelected ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {option.icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{option.title}</span>
      {BLOCK_PICKER_SHORTCUTS[option.kind] ? (
        <span className="text-muted-foreground shrink-0 font-mono text-xs">
          {BLOCK_PICKER_SHORTCUTS[option.kind]}
        </span>
      ) : null}
    </div>
  );
}

function ComponentPickerMenu({
  options,
  selectedIndex,
  onHighlight,
  onSelect,
}: {
  options: ComponentPickerOption[];
  selectedIndex: number | null;
  onHighlight: (index: number) => void;
  onSelect: (option: ComponentPickerOption, index: number) => void;
}) {
  const t = useTranslations("content.editor.blocks");
  const active = options[selectedIndex ?? 0];
  return (
    <div className="flex w-max items-start gap-2">
      <div className="bg-popover w-60 shrink-0 overflow-hidden rounded-xl border p-1 shadow-lg">
        <div
          className="max-h-80 overflow-y-auto overscroll-contain"
          role="listbox"
        >
          {options.map((option, index) => {
            const group = BLOCK_PICKER_GROUPS[option.kind];
            const startsGroup =
              index === 0 ||
              BLOCK_PICKER_GROUPS[options[index - 1]?.kind ?? option.kind] !==
                group;
            return (
              <Fragment key={option.key}>
                {startsGroup ? (
                  <div
                    className={cn(
                      "text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium",
                      index > 0 && "mt-1 border-t border-dashed"
                    )}
                    role="presentation"
                  >
                    {t(BLOCK_PICKER_GROUP_LABELS[group])}
                  </div>
                ) : null}
                <ComponentPickerMenuItem
                  index={index}
                  isSelected={selectedIndex === index}
                  onClick={() => onSelect(option, index)}
                  onMouseEnter={() => onHighlight(index)}
                  option={option}
                />
              </Fragment>
            );
          })}
        </div>
      </div>
      {active ? (
        <div className="bg-popover hidden w-60 shrink-0 overflow-hidden rounded-xl border shadow-lg sm:block">
          <BlockPreview kind={active.kind} />
          <div className="space-y-0.5 px-3 py-2.5">
            <p className="text-sm font-medium">{active.title}</p>
            <p className="text-muted-foreground text-xs text-pretty">
              {t(`descriptions.${active.kind}`)}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ComponentPickerPlugin({
  mediaUploads = true,
}: {
  mediaUploads?: boolean;
}) {
  const t = useTranslations("content.editor.blocks");
  const tCommon = useTranslations("common");
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch("/", {
    minLength: 0,
  });

  const baseOptions = useMemo(() => {
    return [
      new ComponentPickerOption("paragraph", t("paragraph"), {
        icon: <HugeiconsIcon icon={ParagraphIcon} className="size-4" />,
        keywords: ["normal", "text", "p"],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createParagraphNode());
            }
          }),
      }),
      new ComponentPickerOption("heading1", t("heading1"), {
        icon: <HugeiconsIcon icon={Heading01Icon} className="size-4" />,
        keywords: ["h1", "header", "title"],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode("h1"));
            }
          }),
      }),
      new ComponentPickerOption("heading2", t("heading2"), {
        icon: <HugeiconsIcon icon={Heading02Icon} className="size-4" />,
        keywords: ["h2", "header", "subtitle"],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode("h2"));
            }
          }),
      }),
      new ComponentPickerOption("heading3", t("heading3"), {
        icon: <HugeiconsIcon icon={Heading03Icon} className="size-4" />,
        keywords: ["h3", "header", "subheading"],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode("h3"));
            }
          }),
      }),
      new ComponentPickerOption("bulletedList", t("bulletedList"), {
        icon: (
          <HugeiconsIcon
            icon={ParagraphBulletsPoint01Icon}
            className="size-4"
          />
        ),
        keywords: ["ul", "unordered", "bullet", "list"],
        onSelect: () =>
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
      }),
      new ComponentPickerOption("numberedList", t("numberedList"), {
        icon: (
          <HugeiconsIcon icon={LeftToRightListNumberIcon} className="size-4" />
        ),
        keywords: ["ol", "ordered", "number", "list"],
        onSelect: () =>
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
      }),
      new ComponentPickerOption("quote", t("quote"), {
        icon: <HugeiconsIcon icon={QuoteUpIcon} className="size-4" />,
        keywords: ["blockquote", "quotation"],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createQuoteNode());
            }
          }),
      }),
      new ComponentPickerOption("codeBlock", t("codeBlock"), {
        icon: <HugeiconsIcon icon={CodeIcon} className="size-4" />,
        keywords: ["code", "codeblock", "snippet"],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              const codeBlock = $createKiboCodeBlockNode("", "typescript");
              $insertNodes([codeBlock]);
            }
          }),
      }),
      new ComponentPickerOption("table", tCommon("labels.table"), {
        icon: <HugeiconsIcon icon={Table01Icon} className="size-4" />,
        keywords: ["table", "grid", "spreadsheet", "rows", "columns"],
        onSelect: () =>
          editor.dispatchCommand(INSERT_TABLE_COMMAND, {
            columns: "3",
            rows: "3",
            includeHeaders: { rows: true, columns: false },
          }),
      }),
      new ComponentPickerOption("image", tCommon("labels.image"), {
        icon: <HugeiconsIcon icon={ImageAdd01Icon} className="size-4" />,
        keywords: ["image", "photo", "picture", "upload", "img"],
        onSelect: () => {
          queueMicrotask(() => {
            editor.dispatchCommand(
              OPEN_CONTENT_IMAGE_UPLOAD_COMMAND,
              undefined
            );
          });
        },
      }),
      new ComponentPickerOption("video", tCommon("labels.video"), {
        icon: <HugeiconsIcon icon={Film01Icon} className="size-4" />,
        keywords: ["video", "movie", "mp4", "webm", "clip"],
        onSelect: () => {
          queueMicrotask(() => {
            editor.dispatchCommand(
              OPEN_CONTENT_VIDEO_UPLOAD_COMMAND,
              undefined
            );
          });
        },
      }),
      new ComponentPickerOption("divider", t("divider"), {
        icon: <HugeiconsIcon icon={MinusSignIcon} className="size-4" />,
        keywords: ["hr", "horizontal", "rule", "line", "divider"],
        onSelect: () =>
          editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined),
      }),
    ];
  }, [editor, t, tCommon]);

  const options = useMemo(() => {
    const query = queryString?.toLowerCase() ?? "";
    const matches = query
      ? baseOptions.filter(
          (option) =>
            option.title.toLowerCase().includes(query) ||
            option.keywords.some((keyword) =>
              keyword.toLowerCase().includes(query)
            )
        )
      : baseOptions;
    const groups = Object.keys(BLOCK_PICKER_GROUP_LABELS);
    return matches
      .filter(
        (option) =>
          mediaUploads || (option.kind !== "image" && option.kind !== "video")
      )
      .toSorted(
        (a, b) =>
          groups.indexOf(BLOCK_PICKER_GROUPS[a.kind]) -
          groups.indexOf(BLOCK_PICKER_GROUPS[b.kind])
      );
  }, [baseOptions, mediaUploads, queryString]);

  const onSelectOption = useCallback(
    (
      selectedOption: ComponentPickerOption,
      nodeToRemove: TextNode | null,
      closeMenu: () => void,
      matchingString: string
    ) => {
      editor.update(() => {
        nodeToRemove?.remove();
        selectedOption.onSelect(matchingString);
        closeMenu();
      });
    },
    [editor]
  );

  return (
    <LexicalTypeaheadMenuPlugin<ComponentPickerOption>
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
      ) =>
        anchorElementRef.current && options.length > 0
          ? createPortal(
              <ComponentPickerMenu
                options={options}
                selectedIndex={selectedIndex}
                onHighlight={setHighlightedIndex}
                onSelect={(option, index) => {
                  setHighlightedIndex(index);
                  selectOptionAndCleanUp(option);
                }}
              />,
              anchorElementRef.current
            )
          : null
      }
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      options={options}
      triggerFn={checkForTriggerMatch}
    />
  );
}
