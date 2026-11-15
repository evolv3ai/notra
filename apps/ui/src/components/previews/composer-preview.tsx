import { ArrowUpIcon, PlusIcon } from "lucide-react";

import {
  ComposerChip,
  ComposerFrame,
  ComposerInput,
  ComposerNudge,
  ComposerSend,
  ComposerToolbar,
  ComposerToolbarButton,
} from "../../../registry/notra/composer/components/composer";

function noop() {}

export default function ComposerPreview() {
  return (
    <div className="w-full max-w-sm self-center px-6 pb-6">
      <ComposerFrame
        nudge={
          <ComposerNudge>
            <ComposerChip
              label="Keep the intro under 80 words"
              onEdit={noop}
              onRemove={noop}
              onSteer={noop}
            />
          </ComposerNudge>
        }
      >
        <ComposerInput
          aria-label="Message"
          className="min-h-10"
          placeholder="Send a message..."
          readOnly
          rows={1}
        />
        <ComposerToolbar>
          <ComposerToolbarButton>Auto</ComposerToolbarButton>
          <div className="ml-auto flex items-center gap-1">
            <ComposerToolbarButton aria-label="Attach files" size="icon-sm">
              <PlusIcon />
            </ComposerToolbarButton>
            <ComposerSend label="Send message" onClick={noop}>
              <ArrowUpIcon className="size-4" strokeWidth={2.25} />
            </ComposerSend>
          </div>
        </ComposerToolbar>
      </ComposerFrame>
    </div>
  );
}
