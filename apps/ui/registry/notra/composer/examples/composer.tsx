"use client";

import {
  ArrowUpIcon,
  AtSignIcon,
  BrainIcon,
  ChevronDownIcon,
  PlusIcon,
} from "lucide-react";
import { useState } from "react";

import {
  ComposerFrame,
  ComposerInput,
  ComposerSend,
  ComposerToolbar,
  ComposerToolbarButton,
} from "../components/composer";

export default function ComposerExample() {
  const [value, setValue] = useState("");

  return (
    <div className="w-full max-w-xl p-6">
      <ComposerFrame>
        <ComposerInput
          aria-label="Message"
          onChange={(event) => setValue(event.target.value)}
          placeholder="Send a message..."
          rows={1}
          value={value}
        />
        <ComposerToolbar>
          <ComposerToolbarButton>
            Auto
            <ChevronDownIcon className="size-3" />
          </ComposerToolbarButton>
          <ComposerToolbarButton>
            <BrainIcon />
            Medium
            <ChevronDownIcon className="size-3" />
          </ComposerToolbarButton>
          <div className="ml-auto flex items-center gap-1">
            <ComposerToolbarButton aria-label="Add context" size="icon-sm">
              <AtSignIcon />
            </ComposerToolbarButton>
            <ComposerToolbarButton aria-label="Attach files" size="icon-sm">
              <PlusIcon />
            </ComposerToolbarButton>
            <ComposerSend
              disabled={value.trim().length === 0}
              label="Send message"
              onClick={() => setValue("")}
              tooltip="Send"
            >
              <ArrowUpIcon className="size-4" strokeWidth={2.25} />
            </ComposerSend>
          </div>
        </ComposerToolbar>
      </ComposerFrame>
    </div>
  );
}
