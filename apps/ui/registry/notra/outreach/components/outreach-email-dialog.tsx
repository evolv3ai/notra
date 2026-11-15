"use client";

import {
  DicesIcon,
  LoaderCircleIcon,
  SendIcon,
  WandSparklesIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { WorkflowLogo } from "../../workflow/components/workflow-logo";
import { findModel } from "../../workflow/lib/workflow";
import {
  OUTREACH_MODEL,
  OUTREACH_REWRITE_MS,
  OUTREACH_SEND_MS,
} from "../constants/outreach";
import { fillTemplate } from "../lib/outreach";
import type {
  OutreachDraft,
  OutreachEmailComposerProps,
  OutreachEmailDialogProps,
  OutreachVariable,
} from "../types/outreach";

const EmailComposer = ({
  drafts,
  model,
  onSend,
  prospect,
  variables,
}: OutreachEmailComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timers = useRef<number[]>([]);
  const draftIndex = useRef(0);
  const [subject, setSubject] = useState(drafts[0]?.subject ?? "");
  const [body, setBody] = useState(drafts[0]?.body ?? "");
  const [rewriting, setRewriting] = useState(false);
  const [sending, setSending] = useState(false);
  const modelInfo = findModel(model);
  const [firstName] = prospect.contact.name.trim().split(/\s+/);

  useEffect(
    () => () => {
      for (const timer of timers.current) {
        window.clearTimeout(timer);
      }
    },
    []
  );
  const filled: OutreachVariable[] = variables.map((variable) => {
    if (variable.key === "first_name") {
      return { ...variable, value: firstName || variable.value };
    }
    if (variable.key === "listicle_title") {
      return { ...variable, value: prospect.title };
    }
    return variable;
  });

  const insertVariable = (key: string) => {
    const textarea = textareaRef.current;
    const token = `{{${key}}}`;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    setBody(`${body.slice(0, start)}${token}${body.slice(end)}`);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const rewrite = () => {
    setRewriting(true);
    const timer = window.setTimeout(() => {
      const next = (draftIndex.current + 1) % drafts.length;
      draftIndex.current = next;
      setSubject(drafts[next]?.subject ?? subject);
      setBody(drafts[next]?.body ?? body);
      setRewriting(false);
    }, OUTREACH_REWRITE_MS);
    timers.current.push(timer);
  };

  const send = () => {
    setSending(true);
    const draft: OutreachDraft = {
      body: fillTemplate(body, filled),
      subject: fillTemplate(subject, filled),
      to: prospect.contact.email,
    };
    const timer = window.setTimeout(() => {
      setSending(false);
      onSend?.(prospect, draft);
    }, OUTREACH_SEND_MS);
    timers.current.push(timer);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="pr-8 break-all">{`Pitch ${prospect.domain}`}</DialogTitle>
        <DialogDescription className="break-words">
          {`Ask ${prospect.contact.name} to add you to “${prospect.title}”.`}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <label
            className="text-sm leading-none font-medium"
            htmlFor="outreach-to"
          >
            To
          </label>
          <Input
            id="outreach-to"
            readOnly
            value={`${prospect.contact.name} <${prospect.contact.email}>`}
          />
        </div>
        <div className="grid gap-1.5">
          <label
            className="text-sm leading-none font-medium"
            htmlFor="outreach-subject"
          >
            Subject
          </label>
          <Input
            id="outreach-subject"
            onChange={(event) => setSubject(event.target.value)}
            value={subject}
          />
        </div>
        <Tabs defaultValue="write">
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <Button
              disabled={drafts.length < 2 || rewriting}
              onClick={rewrite}
              size="sm"
              variant="outline"
            >
              {rewriting && (
                <LoaderCircleIcon
                  className="animate-spin"
                  data-icon="inline-start"
                />
              )}
              {!rewriting && modelInfo && (
                <WorkflowLogo className="size-3.5" name={modelInfo.logo} />
              )}
              {!(rewriting || modelInfo) && (
                <WandSparklesIcon data-icon="inline-start" />
              )}
              {rewriting ? "Rewriting" : "Rewrite"}
            </Button>
          </div>
          <TabsContent className="grid gap-2" value="write">
            <Textarea
              aria-label="Email body"
              className="min-h-40 font-mono text-xs leading-5 sm:min-h-56"
              onChange={(event) => setBody(event.target.value)}
              ref={textareaRef}
              value={body}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Insert</span>
              {filled.map((variable) => (
                <Button
                  key={variable.key}
                  onClick={() => insertVariable(variable.key)}
                  size="xs"
                  title={variable.value}
                  variant="outline"
                >
                  {variable.label}
                </Button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="preview">
            <div className="border-table-card-border bg-table-card rounded-xl border text-[0.8125rem]">
              <div className="text-muted-foreground border-table-card-border grid gap-0.5 border-b px-3 py-2 text-xs">
                <span>
                  To:{" "}
                  <span className="text-foreground">
                    {prospect.contact.email}
                  </span>
                </span>
                <span>
                  Subject:{" "}
                  <span className="text-foreground font-medium">
                    {fillTemplate(subject, filled)}
                  </span>
                </span>
              </div>
              <p className="max-h-64 overflow-y-auto px-3 py-3 leading-6 whitespace-pre-wrap">
                {fillTemplate(body, filled)}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <DialogFooter className="items-center sm:justify-between">
        <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
          <DicesIcon className="size-3.5 shrink-0 text-violet-500" />
          <span className="truncate">{`Written by ${modelInfo?.label ?? model}`}</span>
        </span>
        <div className="flex gap-2">
          <DialogClose disabled={sending} render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button disabled={sending} onClick={send}>
            {sending ? (
              <LoaderCircleIcon
                className="animate-spin"
                data-icon="inline-start"
              />
            ) : (
              <SendIcon data-icon="inline-start" />
            )}
            {sending ? "Sending" : "Send pitch"}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
};

export const OutreachEmailDialog = ({
  drafts,
  model = OUTREACH_MODEL,
  onSend,
  prospect,
  variables,
  ...props
}: OutreachEmailDialogProps) => (
  <Dialog {...props}>
    <DialogContent
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
      data-slot="outreach-email-dialog"
    >
      {prospect && (
        <EmailComposer
          drafts={drafts}
          key={prospect.id}
          model={model}
          onSend={onSend}
          prospect={prospect}
          variables={variables}
        />
      )}
    </DialogContent>
  </Dialog>
);
