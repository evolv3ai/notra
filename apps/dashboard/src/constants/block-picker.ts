import type {
  BlockPickerGroup,
  BlockPickerKind,
} from "@/types/content/block-picker";

export const BLOCK_PICKER_GROUPS: Record<BlockPickerKind, BlockPickerGroup> = {
  paragraph: "basic",
  heading1: "basic",
  heading2: "basic",
  heading3: "basic",
  quote: "basic",
  bulletedList: "lists",
  numberedList: "lists",
  image: "media",
  video: "media",
  codeBlock: "advanced",
  table: "advanced",
  divider: "advanced",
};

/** Markdown shortcut shown next to each block. */
export const BLOCK_PICKER_SHORTCUTS: Partial<Record<BlockPickerKind, string>> =
  {
    heading1: "#",
    heading2: "##",
    heading3: "###",
    quote: ">",
    bulletedList: "-",
    numberedList: "1.",
    codeBlock: "```",
    divider: "---",
  };

/** Group order in the menu and their translation keys. */
export const BLOCK_PICKER_GROUP_LABELS = {
  basic: "groups.basic",
  lists: "groups.lists",
  media: "groups.media",
  advanced: "groups.advanced",
} as const satisfies Record<BlockPickerGroup, string>;
