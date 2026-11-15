"use client";

import { ArrowUpIcon, XIcon } from "lucide-react";

import { Button } from "../../button/components/button";
import {
  ComposerFrame,
  ComposerInput,
  ComposerNudge,
  ComposerSend,
} from "../components/composer";

function noop() {}

export default function ComposerStateFlat() {
  return (
    <div className="w-full max-w-xl p-6">
      <ComposerFrame
        flat
        nudge={
          <ComposerNudge
            action={
              <Button aria-label="Cancel reply" size="icon-xs" variant="ghost">
                <XIcon />
              </Button>
            }
            title="Replying to Dominik"
          />
        }
      >
        <div className="flex items-end gap-2 p-2">
          <ComposerInput
            aria-label="Reply to Dominik"
            className="max-h-32 min-h-7 flex-1 px-2 py-1 leading-5"
            placeholder="Write a reply..."
            rows={1}
          />
          <ComposerSend label="Send" onClick={noop}>
            <ArrowUpIcon className="size-4" strokeWidth={2.25} />
          </ComposerSend>
        </div>
      </ComposerFrame>
    </div>
  );
}
