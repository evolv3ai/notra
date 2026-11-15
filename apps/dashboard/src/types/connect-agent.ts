export interface ConnectAgentSwapLabelProps {
  copied: boolean;
  /** False until the first copy, so the label doesn't animate on mount. */
  animate: boolean;
  label: string;
  copiedLabel: string;
}

export interface ConnectAgentDismissButtonProps {
  label: string;
  onDismiss: () => void;
}
