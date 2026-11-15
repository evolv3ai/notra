"use client";

import { ArrowUpIcon, ChevronDownIcon, PlusIcon } from "lucide-react";

import {
  ComposerFrame,
  ComposerInput,
  ComposerSend,
  ComposerToolbar,
  ComposerToolbarButton,
} from "../components/composer";

function noop() {}

export default function ComposerStateEmpty() {
  return (
    <div className="w-full max-w-xl p-6">
      <ComposerFrame>
        <ComposerInput
          aria-label="Message"
          placeholder="Send a message..."
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
            <ComposerSend disabled label="Send" onClick={noop}>
              <ArrowUpIcon className="size-4" strokeWidth={2.25} />
            </ComposerSend>
          </div>
        </ComposerToolbar>
      </ComposerFrame>
    </div>
  );
}
