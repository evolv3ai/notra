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

export default function ComposerStateReady() {
  return (
    <div className="w-full max-w-xl p-6">
      <ComposerFrame>
        <ComposerInput
          aria-label="Message"
          defaultValue="Draft release notes for the October launch"
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
            <ComposerSend label="Send message" onClick={noop}>
              <ArrowUpIcon className="size-4" strokeWidth={2.25} />
            </ComposerSend>
          </div>
        </ComposerToolbar>
      </ComposerFrame>
    </div>
  );
}
