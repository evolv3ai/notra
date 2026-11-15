export type BlockPickerKind =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletedList"
  | "numberedList"
  | "quote"
  | "codeBlock"
  | "table"
  | "image"
  | "video"
  | "divider";

export type BlockPickerGroup = "basic" | "lists" | "media" | "advanced";

export interface BlockPreviewProps {
  kind: BlockPickerKind;
}
