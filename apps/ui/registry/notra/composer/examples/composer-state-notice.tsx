"use client";

import {
  ArrowUpIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  PlusIcon,
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

export default function ComposerStateNotice() {
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
            title={
              <span className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-(--composer-info)/12 text-(--composer-info) [--composer-info:var(--info,oklch(0.55_0.13_250))] [corner-shape:squircle] dark:[--composer-info:var(--info,oklch(0.7_0.12_250))]">
                  <CircleAlertIcon className="size-3.5" />
                </span>
                2 chat messages left this month
              </span>
            }
          />
        }
      >
        <ComposerInput
          aria-label="Message"
          defaultValue="Write a changelog entry"
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
