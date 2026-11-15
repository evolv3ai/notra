"use client";

import {
  ArrowUpIcon,
  ChevronDownIcon,
  FileTextIcon,
  PlusIcon,
} from "lucide-react";

import { Spinner } from "@/components/ui/spinner";

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

export default function ComposerStateUploading() {
  return (
    <div className="w-full max-w-xl p-6">
      <ComposerFrame
        nudge={
          <ComposerNudge>
            <ComposerChip
              icon={<FileTextIcon className="text-muted-foreground size-3.5" />}
              label="pricing-notes.pdf"
              onClick={noop}
              onRemove={noop}
            />
            <ComposerChip
              icon={<Spinner className="size-3" />}
              label="launch-screenshots.zip"
              pending
            />
          </ComposerNudge>
        }
      >
        <ComposerInput
          aria-label="Message"
          defaultValue="Summarize these files"
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
