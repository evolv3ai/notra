/** The slice of a chat message the minimap reads, so shared snapshots fit too. */
export interface ChatMinimapMessage {
  id: string;
  role: string;
  parts: readonly { type: string }[];
}

export interface ChatMinimapTurn {
  description?: string;
  id: string;
  messageIds: string[];
  title: string;
}

export interface ChatMinimapRailProps {
  className?: string;
  turns: ChatMinimapTurn[];
}
