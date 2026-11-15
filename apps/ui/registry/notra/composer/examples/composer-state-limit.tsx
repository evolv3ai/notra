"use client";

import {
  ArrowUpIcon,
  ChevronDownIcon,
  PlusIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Button } from "../../button/components/button";
import {
  ComposerFrame,
  ComposerInput,
  ComposerNudge,
  ComposerSend,
  ComposerToolbar,
  ComposerToolbarButton,
} from "../components/composer";

function noop() {}

export default function ComposerStateLimit() {
  return (
    <div className="w-full max-w-xl p-6">
      <ComposerFrame
        nudge={
          <ComposerNudge
            action={
              <Button size="xs" variant="outline">
                Upgrade
              </Button>
            }
          >
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-(--composer-warning)/12 text-(--composer-warning) [--composer-warning:var(--warning,oklch(0.57_0.113_55))] [corner-shape:squircle] dark:[--composer-warning:var(--warning,oklch(0.7_0.125_55))]">
                <TriangleAlertIcon className="size-3.5" />
              </span>
              <span className="truncate">You used all chat messages</span>
            </span>
          </ComposerNudge>
        }
      >
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
