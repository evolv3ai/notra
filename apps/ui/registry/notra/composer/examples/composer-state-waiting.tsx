"use client";

import { ChevronDownIcon, PlusIcon } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";

import {
  ComposerFrame,
  ComposerInput,
  ComposerSend,
  ComposerToolbar,
  ComposerToolbarButton,
} from "../components/composer";

function noop() {}

export default function ComposerStateWaiting() {
  return (
    <div className="w-full max-w-xl p-6">
      <ComposerFrame>
        <ComposerInput
          aria-label="Message"
          defaultValue="Now shorten it to a tweet"
          disabled
          placeholder="Send a message..."
          rows={1}
        />
        <ComposerToolbar>
          <ComposerToolbarButton disabled>
            Auto
            <ChevronDownIcon className="size-3" />
          </ComposerToolbarButton>
          <div className="ml-auto flex items-center gap-1">
            <ComposerToolbarButton
              aria-label="Attach files"
              disabled
              size="icon-sm"
            >
              <PlusIcon />
            </ComposerToolbarButton>
            <ComposerSend label="Cancel queued message" onClick={noop}>
              <Spinner className="size-3.5" />
            </ComposerSend>
          </div>
        </ComposerToolbar>
      </ComposerFrame>
    </div>
  );
}
