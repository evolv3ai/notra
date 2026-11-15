"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  POST_TAG_MAX_LENGTH,
  POST_TAGS_MAX,
} from "@notra/ai/constants/post-metadata";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTranslations } from "use-intl";

import { TAG_SUGGESTION_COUNT } from "@/constants/content-overview";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { OverviewTagsInputProps } from "@/types/content/overview";

export function OverviewTagsInput({
  organizationId,
  tags,
  onChange,
}: OverviewTagsInputProps) {
  const t = useTranslations("content.overview.tags");
  const listId = useId();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [navigated, setNavigated] = useState(false);
  const { data } = useQuery(
    dashboardOrpc.content.tagSuggestions.queryOptions({
      input: { organizationId },
      enabled: open,
    })
  );
  const taken = new Set(tags.map((tag) => tag.toLowerCase()));
  const query = draft.trim().toLowerCase();
  const suggestions = (data?.tags ?? [])
    .filter((tag) => !taken.has(tag.toLowerCase()))
    .filter((tag) => tag.toLowerCase().includes(query))
    .slice(0, TAG_SUGGESTION_COUNT);
  const full = tags.length >= POST_TAGS_MAX;
  const draftTag = draft.trim().slice(0, POST_TAG_MAX_LENGTH);
  const canCreate =
    draftTag.length > 0 &&
    !taken.has(draftTag.toLowerCase()) &&
    !suggestions.some((tag) => tag.toLowerCase() === query);
  const options = canCreate ? [...suggestions, draftTag] : suggestions;
  const listOpen = open && options.length > 0;

  const add = (value: string) => {
    const tag = value.trim().slice(0, POST_TAG_MAX_LENGTH);
    setDraft("");
    setHighlighted(0);
    setNavigated(false);
    if (!tag || full || taken.has(tag.toLowerCase())) {
      return;
    }
    onChange([...tags, tag]);
  };

  return (
    <div className="relative">
      <div className="border-input focus-within:border-ring focus-within:ring-ring/50 dark:bg-input/30 flex min-h-8 flex-wrap items-center gap-1 rounded-lg border p-1 transition-colors focus-within:ring-[3px]">
        {tags.map((tag) => (
          <span
            className="bg-muted text-foreground inline-flex h-6 items-center gap-0.5 rounded-md pr-0.5 pl-2 text-xs font-medium"
            key={tag}
          >
            {tag}
            <button
              aria-label={t("remove", { tag })}
              className="text-muted-foreground hover:text-foreground inline-flex size-5 cursor-pointer items-center justify-center rounded"
              onClick={() => onChange(tags.filter((item) => item !== tag))}
              type="button"
            >
              <HugeiconsIcon
                className="size-3"
                icon={Cancel01Icon}
                strokeWidth={2}
              />
            </button>
          </span>
        ))}
        {full ? null : (
          <input
            aria-activedescendant={
              listOpen && navigated && options[highlighted]
                ? `${listId}-${highlighted}`
                : undefined
            }
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={listOpen}
            aria-label={t("add")}
            className="placeholder:text-muted-foreground h-6 min-w-24 flex-1 bg-transparent px-1.5 text-sm outline-none"
            maxLength={POST_TAG_MAX_LENGTH}
            onBlur={() => setOpen(false)}
            onChange={(event) => {
              setDraft(event.target.value);
              setHighlighted(0);
              setNavigated(false);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (
                (event.key === "ArrowDown" || event.key === "ArrowUp") &&
                options.length > 0
              ) {
                event.preventDefault();
                if (!navigated) {
                  setNavigated(true);
                  setHighlighted(
                    event.key === "ArrowDown" ? 0 : options.length - 1
                  );
                  return;
                }
                const step = event.key === "ArrowDown" ? 1 : -1;
                setHighlighted(
                  (index) => (index + step + options.length) % options.length
                );
                return;
              }
              if (event.nativeEvent.isComposing) {
                return;
              }
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                const exact = suggestions.find(
                  (tag) => tag.toLowerCase() === query
                );
                const picked =
                  listOpen && navigated ? options[highlighted] : undefined;
                add(picked ?? exact ?? draft);
                return;
              }
              if (event.key === "Escape") {
                setOpen(false);
                return;
              }
              if (event.key === "Backspace" && !draft && tags.length > 0) {
                onChange(tags.slice(0, -1));
              }
            }}
            placeholder={tags.length > 0 ? "" : t("placeholder")}
            role="combobox"
            value={draft}
          />
        )}
      </div>
      {listOpen ? (
        <div
          className="bg-popover text-popover-foreground ring-foreground/10 animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 absolute top-full left-0 z-30 mt-1 flex w-full origin-top flex-col rounded-lg p-1 shadow-md ring-1 duration-100 motion-reduce:animate-none"
          id={listId}
          role="listbox"
        >
          {options.map((tag, index) => (
            <button
              aria-selected={navigated && index === highlighted}
              className="data-[highlighted=true]:bg-accent cursor-pointer truncate rounded-md px-2 py-1 text-left text-sm"
              data-highlighted={navigated && index === highlighted}
              id={`${listId}-${index}`}
              key={tag}
              onMouseDown={(event) => {
                event.preventDefault();
                add(tag);
              }}
              onMouseEnter={() => {
                setNavigated(true);
                setHighlighted(index);
              }}
              role="option"
              tabIndex={-1}
              type="button"
            >
              {canCreate && index === suggestions.length
                ? t("create", { tag })
                : tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
