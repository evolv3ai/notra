"use client";

import { ChevronDownIcon, PlusIcon, SquareIcon } from "lucide-react";

import {
  ComposerFrame,
  ComposerInput,
  ComposerSend,
  ComposerToolbar,
  ComposerToolbarButton,
} from "../components/composer";

function noop() {}

export default function ComposerStateStopping() {
  return (
    <div className="w-full max-w-xl p-6">
      <ComposerFrame>
        <ComposerInput
          aria-label="Message"
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
            <ComposerSend busy label="Stopping" onClick={noop}>
              <SquareIcon className="size-3 fill-current" />
            </ComposerSend>
          </div>
        </ComposerToolbar>
      </ComposerFrame>
    </div>
  );
}
