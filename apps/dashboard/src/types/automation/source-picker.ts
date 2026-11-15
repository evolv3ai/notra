export interface SourceOption {
  value: string;
  /** Full label for the list, e.g. "owner/repo · main". */
  label: string;
  /** Short name for the chip, e.g. "owner/repo". */
  name: string;
  type: "github" | "linear";
}

export interface SourcePickerProps {
  options: SourceOption[];
  value: string[];
  onChange: (value: string[]) => void;
  /** Shown while nothing is picked. */
  placeholder: string;
  ariaLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
  invalid?: boolean;
}
