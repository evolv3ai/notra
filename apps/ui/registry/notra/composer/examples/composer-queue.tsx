"use client";

import { ArrowUpIcon, FileTextIcon, SquareIcon } from "lucide-react";
import { useState } from "react";

import {
  ComposerChip,
  ComposerFrame,
  ComposerInput,
  ComposerNudge,
  ComposerSend,
  ComposerToolbar,
} from "../components/composer";

const INITIAL_QUEUE = [
  { id: "pricing-table", text: "Add a comparison table for the pricing page" },
  { id: "short-intro", text: "Keep the intro under 80 words" },
];

export default function ComposerQueueExample() {
  const [queue, setQueue] = useState(INITIAL_QUEUE);
  const [hasFile, setHasFile] = useState(true);
  const [value, setValue] = useState("");
  const hasNudge = queue.length > 0 || hasFile;

  return (
    <div className="w-full max-w-xl p-6">
      <ComposerFrame
        nudge={
          hasNudge ? (
            <ComposerNudge>
              {queue.map((message) => (
                <ComposerChip
                  key={message.id}
                  label={message.text}
                  onEdit={() => {
                    setValue(message.text);
                    setQueue((items) =>
                      items.filter((item) => item.id !== message.id)
                    );
                  }}
                  onRemove={() =>
                    setQueue((items) =>
                      items.filter((item) => item.id !== message.id)
                    )
                  }
                  onSteer={() =>
                    setQueue((items) =>
                      items.filter((item) => item.id !== message.id)
                    )
                  }
                />
              ))}
              {hasFile ? (
                <ComposerChip
                  icon={
                    <FileTextIcon className="text-muted-foreground size-3.5" />
                  }
                  label="linear-sync-changelog.pdf"
                  onRemove={() => setHasFile(false)}
                />
              ) : null}
            </ComposerNudge>
          ) : null
        }
      >
        <ComposerInput
          aria-label="Message"
          onChange={(event) => setValue(event.target.value)}
          placeholder="Queue another message..."
          rows={1}
          value={value}
        />
        <ComposerToolbar>
          <div className="ml-auto flex items-center gap-1">
            <ComposerSend
              label={value.trim() ? "Queue message" : "Stop"}
              onClick={() => {
                if (!value.trim()) {
                  return;
                }
                const message = { id: crypto.randomUUID(), text: value.trim() };
                setQueue((items) => [...items, message]);
                setValue("");
              }}
              tooltip={value.trim() ? "Queue" : "Stop"}
            >
              {value.trim() ? (
                <ArrowUpIcon className="size-4" strokeWidth={2.25} />
              ) : (
                <SquareIcon className="size-3 fill-current" />
              )}
            </ComposerSend>
          </div>
        </ComposerToolbar>
      </ComposerFrame>
    </div>
  );
}
