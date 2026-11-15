"use client";

import { ArrowUpIcon, ChevronDownIcon, PlusIcon } from "lucide-react";

import {
  ComposerChip,
  ComposerFrame,
  ComposerInput,
  ComposerNudge,
  ComposerSend,
  ComposerToolbar,
  ComposerToolbarButton,
} from "../components/composer";

function noop() {}

export default function ComposerStateQueued() {
  return (
    <div className="w-full max-w-xl p-6">
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
          defaultValue="Add a comparison table too"
          placeholder="Queue a message..."
          rows={1}
        />
        <ComposerToolbar>
          <ComposerToolbarButton>
            Auto
            <ChevronDownIcon className="size-3" />
          </ComposerToolbarButton>
          <div className="ml-auto flex items-center gap-1">
            <ComposerToolbarButton aria-label="Attach files" size="icon-sm">
              <PlusIcon />
            </ComposerToolbarButton>
            <ComposerSend label="Queue message" onClick={noop}>
              <ArrowUpIcon className="size-4" strokeWidth={2.25} />
            </ComposerSend>
          </div>
        </ComposerToolbar>
      </ComposerFrame>
    </div>
  );
}
