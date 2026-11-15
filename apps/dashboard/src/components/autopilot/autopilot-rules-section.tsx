"use client";

import {
  Add01Icon,
  Delete02Icon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/button";
import { AUTOPILOT_RULE_PREFIX } from "@/constants/autopilot";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutopilotRulesSectionProps } from "@/types/autopilot";
import { toAutopilotRuleText } from "@/utils/autopilot-rules";
import { toErrorMessage } from "@/utils/error-message";

/** What the team told Autopilot to skip; every decision reads these. */
export function AutopilotRulesSection({
  organizationId,
  rules,
}: AutopilotRulesSectionProps) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [topic, setTopic] = useState("");
  const close = () => {
    setTopic("");
    setAdding(false);
  };
  const ruleText = toAutopilotRuleText(topic);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: dashboardOrpc.autopilot.key() });
  const add = useMutation({
    mutationFn: (text: string) =>
      dashboardOrpc.autopilot.addRule.call({ organizationId, text }),
    onSuccess: async () => {
      close();
      await invalidate();
    },
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not save the rule")),
  });
  const remove = useMutation({
    mutationFn: (ruleId: string) =>
      dashboardOrpc.autopilot.deleteRule.call({ organizationId, ruleId }),
    onSuccess: invalidate,
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not remove the rule")),
  });

  return (
    <div className="border-shell-border bg-shell rounded-2xl border p-0.5">
      <div className="divide-table-row-border shadow-table-card bg-table-card border-table-card-border divide-y overflow-hidden rounded-[14px] border">
        <div className="px-4 py-3">
          <p className="text-sm font-medium">Topics to skip</p>
          <p className="text-muted-foreground text-xs text-pretty">
            {rules.length > 0
              ? "Autopilot reads these before every suggestion."
              : "When you decline a suggestion and say why, Autopilot remembers it here and reads it before every suggestion."}
          </p>
        </div>
        {rules.map((rule) => {
          const sourceLabel =
            rule.source === "github" ? "From GitHub" : "From the dashboard";
          return (
            <div className="flex items-start gap-3 px-4 py-2.5" key={rule.id}>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm text-pretty">{rule.text}</span>
                <span className="text-muted-foreground text-xs">
                  {rule.sourceUrl ? (
                    <a
                      className="hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline"
                      href={rule.sourceUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {sourceLabel}
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={LinkSquare02Icon}
                        size={12}
                      />
                    </a>
                  ) : (
                    sourceLabel
                  )}
                  {rule.createdBy ? ` · ${rule.createdBy}` : ""}
                </span>
              </span>
              <Button
                aria-label={`Remove rule: ${rule.text}`}
                className="text-muted-foreground"
                disabled={remove.isPending}
                onClick={() => remove.mutate(rule.id)}
                size="icon-sm"
                variant="ghost"
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} />
              </Button>
            </div>
          );
        })}
        {adding ? (
          <form
            className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (ruleText) {
                add.mutate(ruleText);
              }
            }}
          >
            <InputGroup>
              <InputGroupAddon>{AUTOPILOT_RULE_PREFIX}</InputGroupAddon>
              <InputGroupInput
                aria-label="Topic to skip"
                autoFocus
                maxLength={250}
                onChange={(event) => setTopic(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && !add.isPending) {
                    close();
                  }
                }}
                placeholder="e.g. dependency bumps"
                value={topic}
              />
            </InputGroup>
            <div className="flex justify-end gap-2">
              <Button
                disabled={!ruleText}
                loading={add.isPending}
                size="sm"
                type="submit"
              >
                Add
              </Button>
              <Button
                disabled={add.isPending}
                onClick={close}
                size="sm"
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="px-2 py-1.5">
            <Button onClick={() => setAdding(true)} size="sm" variant="ghost">
              <HugeiconsIcon
                aria-hidden="true"
                icon={Add01Icon}
                strokeWidth={2}
              />
              Add a topic
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
