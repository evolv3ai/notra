import type { ButtonProps } from "@notra/ui/components/ui/button";
import type { ComponentProps, ReactNode } from "react";

export interface ComposerFrameProps {
  children: ReactNode;
  nudge?: ReactNode;
  /** Drops the top radius so the frame can sit flush under another surface. */
  connectedTop?: boolean;
  /** Tighter radius, no shadow and no tray until there is a nudge. For inline composers like comments. */
  flat?: boolean;
  /** `sm` is a 36px single-line pill for dense inline composers. Pair it with `Composer.Send size="sm"`. Only applies with `flat`. */
  size?: "default" | "sm";
  className?: string;
}

export interface ComposerNudgeProps {
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}

export interface ComposerChipProps {
  icon?: ReactNode;
  label: string;
  onRemove?: () => void;
  removeLabel?: string;
  onEdit?: () => void;
  editLabel?: string;
  onSteer?: () => void;
  steerLabel?: string;
  onClick?: () => void;
  pending?: boolean;
  className?: string;
  labelClassName?: string;
}

export type ComposerInputProps = ComponentProps<"textarea">;

export interface ComposerToolbarProps {
  children: ReactNode;
  className?: string;
}

/** A ghost `Button`. Use `size="icon-sm"` for icon-only actions. */
export type ComposerToolbarButtonProps = Omit<ButtonProps, "variant">;

export interface ComposerSendProps {
  children: ReactNode;
  label: string;
  tooltip?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  /** `sm` is a 28px button for single-line inline composers. */
  size?: "default" | "sm";
  onClick?: () => void;
}
