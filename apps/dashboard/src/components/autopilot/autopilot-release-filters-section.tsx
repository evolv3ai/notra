"use client";

import {
  Add01Icon,
  Delete02Icon,
  FolderCodeIcon,
  UserBlock01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { AutopilotCommitFilters } from "@notra/db/types/autopilot";
import {
  autopilotGitHubLoginSchema,
  autopilotRepositoryPathSchema,
} from "@notra/schemas/dashboard/autopilot";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AutopilotRepositoryPicker } from "@/components/autopilot/autopilot-repository-picker";
import { AutopilotTagInput } from "@/components/autopilot/autopilot-tag-input";
import { Button } from "@/components/button";
import {
  AUTOPILOT_AUTHOR_SUGGESTION_STALE_MS,
  AUTOPILOT_PATH_SEPARATOR,
} from "@/constants/autopilot";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutopilotReleaseFiltersSectionProps } from "@/types/autopilot";
import { autopilotAuthorPresets } from "@/utils/autopilot-commit-filters";
import { toErrorMessage } from "@/utils/error-message";

function parseLogin(value: string) {
  const parsed = autopilotGitHubLoginSchema.safeParse(value.replace(/^@/, ""));
  return parsed.success ? parsed.data.toLowerCase() : null;
}

function parsePath(value: string) {
  const parsed = autopilotRepositoryPathSchema.safeParse(
    value.replace(/^\.?\/+/, "")
  );
  return parsed.success ? parsed.data : null;
}

/** Which authors and paths Autopilot ignores; saves on every change. */
export function AutopilotReleaseFiltersSection({
  organizationId,
  filters: saved,
  repositories,
  githubConnected,
}: AutopilotReleaseFiltersSectionProps) {
  const queryClient = useQueryClient();
  // Edits show at once and saves go out in order, each with the whole list.
  // Once the newest save settles, the server's value takes over again.
  const [draft, setDraft] = useState<AutopilotCommitFilters | null>(null);
  const latestEdit = useRef(0);
  const filters = draft ?? saved;
  const [addedRepository, setAddedRepository] = useState<string | null>(null);
  const authorsQuery = useQuery({
    ...dashboardOrpc.autopilot.authorSuggestions.queryOptions({
      input: { organizationId },
    }),
    enabled: githubConnected,
    staleTime: AUTOPILOT_AUTHOR_SUGGESTION_STALE_MS,
  });
  const authors = authorsQuery.data ?? [];
  const presets = autopilotAuthorPresets(authors, filters.excludedAuthors);
  const save = useMutation({
    scope: { id: `autopilot-commit-filters:${organizationId}` },
    mutationFn: (edit: { filters: AutopilotCommitFilters; version: number }) =>
      dashboardOrpc.autopilot.setCommitFilters.call({
        organizationId,
        filters: edit.filters,
      }),
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not save the filter")),
    // A newer edit still queued carries the whole list, so only the newest
    // save decides: on success or failure the server's value is shown again.
    onSettled: async (_data, _error, edit) => {
      if (edit.version !== latestEdit.current) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.key(),
      });
      if (edit.version === latestEdit.current) {
        setDraft(null);
      }
    },
  });
  const update = (next: AutopilotCommitFilters) => {
    latestEdit.current += 1;
    setDraft(next);
    save.mutate({ filters: next, version: latestEdit.current });
  };
  const setPaths = (repository: string, paths: string[]) => {
    const others = Object.fromEntries(
      Object.entries(filters.paths).filter(([key]) => key !== repository)
    );
    update({
      ...filters,
      paths: paths.length > 0 ? { ...others, [repository]: paths } : others,
    });
  };

  const filtered = Object.keys(filters.paths);
  const rows =
    addedRepository && !filtered.includes(addedRepository)
      ? [...filtered, addedRepository]
      : filtered;
  const displayName = (key: string) =>
    repositories.find((repository) => repository.fullName.toLowerCase() === key)
      ?.fullName ?? key;
  const shown = new Set(rows);
  const addable = repositories.filter(
    (repository) => !shown.has(repository.fullName.toLowerCase())
  );

  return (
    <div className="border-shell-border bg-shell rounded-2xl border p-0.5">
      <div className="divide-table-row-border shadow-table-card bg-table-card border-table-card-border divide-y overflow-hidden rounded-[14px] border">
        <div className="flex gap-3 px-4 py-3">
          <HugeiconsIcon
            aria-hidden="true"
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
            icon={UserBlock01Icon}
            strokeWidth={1.75}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div>
              <label
                className="text-sm font-medium"
                htmlFor="autopilot-excluded-authors"
              >
                Skip authors
              </label>
              <p className="text-muted-foreground text-xs text-pretty">
                GitHub users and bots whose pull requests never get a post.
              </p>
            </div>
            <AutopilotTagInput
              id="autopilot-excluded-authors"
              label="Skip authors"
              onChange={(excludedAuthors) =>
                update({ ...filters, excludedAuthors })
              }
              parse={parseLogin}
              placeholder="GitHub login, e.g. octocat"
              suggestions={authors.map((author) => author.login)}
              values={filters.excludedAuthors}
            />
            {presets.length > 0 ? (
              <ul
                aria-label="Suggested authors"
                className="flex flex-wrap items-center gap-1.5"
              >
                {presets.map((login) => (
                  <li key={login}>
                    <Button
                      aria-label={`Skip ${login}`}
                      onClick={() =>
                        update({
                          ...filters,
                          excludedAuthors: [...filters.excludedAuthors, login],
                        })
                      }
                      size="xs"
                      variant="outline"
                    >
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={Add01Icon}
                        strokeWidth={2}
                      />
                      <span className="font-mono">{login}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        {rows.map((repository) => {
          const name = displayName(repository);
          const inputId = `autopilot-paths-${repository.replace(/[^a-z0-9]/g, "-")}`;
          return (
            <div className="flex gap-3 px-4 py-3" key={repository}>
              <HugeiconsIcon
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
                icon={FolderCodeIcon}
                strokeWidth={1.75}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <label
                      className="truncate text-sm font-medium"
                      htmlFor={inputId}
                    >
                      {name}
                    </label>
                    <p className="text-muted-foreground text-xs text-pretty">
                      Only changes under these paths count.
                    </p>
                  </div>
                  <Button
                    aria-label={`Remove the path filter for ${name}`}
                    className="text-muted-foreground -mt-1 -mr-2"
                    onClick={() => {
                      if (repository === addedRepository) {
                        setAddedRepository(null);
                      }
                      if (filters.paths[repository]) {
                        setPaths(repository, []);
                      }
                    }}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={14} />
                  </Button>
                </div>
                <AutopilotTagInput
                  id={inputId}
                  label={`Paths in ${name}`}
                  onChange={(paths) => setPaths(repository, paths)}
                  parse={parsePath}
                  separator={AUTOPILOT_PATH_SEPARATOR}
                  placeholder="apps/web or docs/**"
                  values={filters.paths[repository] ?? []}
                />
              </div>
            </div>
          );
        })}
        <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
          <HugeiconsIcon
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0"
            icon={FolderCodeIcon}
            strokeWidth={1.75}
          />
          <div className="min-w-0 flex-1">
            <label
              className="text-sm font-medium"
              htmlFor="autopilot-path-repository"
            >
              Limit a repository to paths
            </label>
          </div>
          <AutopilotRepositoryPicker
            className="w-56"
            id="autopilot-path-repository"
            label="Repository to limit"
            onChange={(repository) =>
              setAddedRepository(repository.fullName.toLowerCase())
            }
            placeholder="Choose a repository"
            repositories={addable}
            value={null}
          />
        </div>
      </div>
    </div>
  );
}
