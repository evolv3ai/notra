"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Button } from "@notra/ui/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { Label } from "@notra/ui/components/ui/label";
import { ORPCError } from "@orpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";

import { dashboardOrpc } from "@/lib/orpc/query";
import type { CreateAutopilotSlackChannelProps } from "@/types/slack-integration";
import { toErrorMessage } from "@/utils/error-message";

export function CreateSlackChannelDialog({
  organizationId,
  integrationId,
  authorizeUrl,
  onCreated,
  onCancel,
  returnFocus,
}: CreateAutopilotSlackChannelProps) {
  const queryClient = useQueryClient();
  const id = useId();
  const [name, setName] = useState("notra-autopilot");
  const create = useMutation({
    mutationFn: () =>
      dashboardOrpc.integrations.slack.createChannel.call({
        organizationId,
        integrationId,
        name,
      }),
    onSuccess: async ({ channel }) => {
      const queryKey =
        dashboardOrpc.integrations.slack.listChannels.queryOptions({
          input: { organizationId, integrationId },
        }).queryKey;
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, (previous) => ({
        channels: [
          ...(previous?.channels ?? []).filter(
            (item) => item.id !== channel.id
          ),
          channel,
        ],
      }));
      onCreated(channel);
      toast.success(
        `Created #${channel.name}. Join it in Slack to see your daily brief.`
      );
    },
  });
  const needsReconnect =
    create.error instanceof ORPCError &&
    create.error.data?.slackReconnectRequired === true;

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !create.isPending) {
          onCancel();
        }
      }}
    >
      <ResponsiveDialogContent
        className="sm:max-w-md"
        finalFocus={returnFocus}
        showCloseButton={!create.isPending}
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Create Slack channel</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            A public channel for your daily brief. Notra joins automatically.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form
          className="space-y-2"
          id={`${id}-form`}
          onSubmit={(event) => {
            event.preventDefault();
            if (!create.isPending) {
              create.mutate();
            }
          }}
        >
          <Label htmlFor={`${id}-name`}>Channel name</Label>
          <InputGroup>
            <InputGroupAddon aria-hidden="true">#</InputGroupAddon>
            <InputGroupInput
              aria-describedby={`${id}-hint ${id}-error`}
              aria-invalid={create.isError}
              autoComplete="off"
              disabled={create.isPending}
              id={`${id}-name`}
              maxLength={80}
              name="slack-channel-name"
              onChange={(event) => {
                setName(event.target.value);
                create.reset();
              }}
              pattern="[a-z0-9_\-]+"
              required
              value={name}
            />
          </InputGroup>
          <p className="text-muted-foreground text-xs" id={`${id}-hint`}>
            Lowercase letters, numbers, hyphens, and underscores.
          </p>
          <p
            className="text-destructive text-xs"
            id={`${id}-error`}
            role="alert"
          >
            {create.isError
              ? toErrorMessage(
                  create.error,
                  "Could not create the Slack channel"
                )
              : ""}
          </p>
        </form>
        <ResponsiveDialogFooter>
          <Button
            disabled={create.isPending}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          {needsReconnect ? (
            <Button
              nativeButton={false}
              render={<a aria-label="Reconnect Slack" href={authorizeUrl} />}
              variant="secondary"
            >
              Reconnect Slack
            </Button>
          ) : (
            <Button
              data-dialog-confirm
              form={`${id}-form`}
              loading={create.isPending}
              type="submit"
            >
              Create channel
            </Button>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
