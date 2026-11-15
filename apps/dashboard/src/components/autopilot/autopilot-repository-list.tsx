"use client";

import {
  Github01Icon,
  Search01Icon,
  SquareLock02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { AutopilotSetupRowsProps } from "@/types/autopilot";

/** Inline, searchable repository choice for the first setup. */
export function AutopilotRepositoryList({ setup }: AutopilotSetupRowsProps) {
  const [search, setSearch] = useState("");

  if (!setup.githubConnected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
        <p className="text-muted-foreground text-sm">
          Connect GitHub to pick the repository of your website.
        </p>
        <Button
          loading={setup.installing}
          onClick={setup.installGitHub}
          size="sm"
          variant="secondary"
        >
          <HugeiconsIcon icon={Github01Icon} size={16} />
          Connect GitHub
        </Button>
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const visible = setup.repositories.filter((repository) =>
    repository.fullName.toLowerCase().includes(query)
  );

  return (
    <div className="space-y-2">
      <InputGroup>
        <InputGroupAddon>
          <HugeiconsIcon aria-hidden="true" icon={Search01Icon} size={14} />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search repositories"
          autoComplete="off"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search repositories"
          spellCheck={false}
          type="search"
          value={search}
        />
      </InputGroup>
      <ul
        aria-label="Website repository"
        className="max-h-40 divide-y overflow-y-auto overscroll-contain rounded-xl border"
      >
        {visible.map((repository) => {
          const selected = repository.fullName === setup.repositoryKey;
          return (
            <li key={repository.fullName}>
              <button
                aria-pressed={selected}
                className={cn(
                  "hover:bg-muted/60 focus-visible:bg-muted/60 flex h-10 w-full items-center gap-1.5 px-3 text-left text-sm outline-none",
                  selected && "bg-muted/60"
                )}
                onClick={() => setup.setRepositoryKey(repository.fullName)}
                type="button"
              >
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">
                    {repository.owner}/
                  </span>
                  <span className="font-medium">{repository.name}</span>
                </span>
                {repository.private ? (
                  <HugeiconsIcon
                    aria-label="Private"
                    className="text-muted-foreground size-3 shrink-0"
                    icon={SquareLock02Icon}
                    role="img"
                  />
                ) : null}
                {selected ? (
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="ml-auto size-4 shrink-0"
                    icon={Tick02Icon}
                  />
                ) : null}
              </button>
            </li>
          );
        })}
        {visible.length === 0 ? (
          <li className="text-muted-foreground px-3 py-6 text-center text-sm">
            {setup.repositories.length === 0
              ? "No repositories yet."
              : "No repository matches."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
