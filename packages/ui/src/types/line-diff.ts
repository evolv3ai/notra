export interface LineDiffLine {
  type: "same" | "added" | "removed";
  text: string;
  key: string;
}

export type LineDiffRow =
  | LineDiffLine
  | { type: "collapsed"; count: number; key: string };

export interface LineDiffProps {
  before: string;
  after: string;
  emptyLabel?: string;
  collapsedLabel?: (count: number) => string;
  className?: string;
}
