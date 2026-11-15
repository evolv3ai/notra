"use client";

import { ArrowLeft02Icon, SourceCodeIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import { Badge } from "@notra/ui/components/ui/badge";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@notra/ui/components/ui/tabs";
import { Textarea } from "@notra/ui/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/button";
import { SystemSkillCodeAlert } from "@/components/skills/system-skill-code-alert";
import { SystemSkillContentField } from "@/components/skills/system-skill-content-field";
import { SystemSkillHeader } from "@/components/skills/system-skill-header";
import { SystemSkillVersions } from "@/components/skills/system-skill-versions";
import { ADOPTION_STATS } from "@/constants/skills";
import { usePublishSystemSkill } from "@/hooks/use-publish-system-skill";
import { consoleOrpc } from "@/lib/orpc/query";
import type {
  SystemSkillDetail,
  SystemSkillEditorPageProps,
} from "@/types/skills";
import { publishSummary } from "@/utils/skills";

export function SystemSkillEditorClient({
  slug,
  name,
}: SystemSkillEditorPageProps) {
  const query = useQuery({
    ...consoleOrpc.skills.get.queryOptions({ input: { name: name ?? "" } }),
    enabled: name !== null,
  });

  if (name !== null && query.isPending) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 lg:px-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }
  if (name !== null && !query.data) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-6">
        <div className="rounded-lg border p-4 text-sm" role="alert">
          Could not load this skill. {query.error?.message}
        </div>
      </main>
    );
  }

  return (
    <SystemSkillEditor
      key={query.data ? `${query.data.name}@${query.data.version}` : "new"}
      skill={query.data ?? null}
      slug={slug}
    />
  );
}

function SystemSkillEditor({
  slug,
  skill,
}: {
  slug: string;
  skill: SystemSkillDetail | null;
}) {
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [content, setContent] = useState(skill?.content ?? "");
  const [note, setNote] = useState("");
  const [view, setView] = useState("edit");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasChanges =
    !skill || description !== skill.description || content !== skill.content;
  const nextVersion = (skill?.version ?? 0) + 1;

  const publish = usePublishSystemSkill({
    slug,
    baseVersion: skill?.version ?? null,
    draft: { name, description, content, note },
    onSettled: () => setConfirmOpen(false),
  });

  function loadIntoEditor(source: { description: string; content: string }) {
    setDescription(source.description);
    setContent(source.content);
    setView("edit");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <SystemSkillHeader
        hasChanges={hasChanges}
        nextVersion={nextVersion}
        onDiscard={() => {
          if (skill) {
            loadIntoEditor(skill);
            setNote("");
          }
        }}
        onPublish={() => setConfirmOpen(true)}
        pending={publish.isPending}
        skill={skill}
        slug={slug}
      />

      {skill?.codeDefinition ? (
        <SystemSkillCodeAlert
          onLoad={() => {
            if (skill.codeDefinition) {
              loadIntoEditor(skill.codeDefinition);
              setNote("Synced from code");
            }
          }}
          version={skill.version}
        />
      ) : null}

      <section className="flex flex-col gap-5">
        {skill ? null : (
          <div className="grid max-w-md gap-2">
            <Label htmlFor="system-skill-name">Name</Label>
            <Input
              className="font-mono"
              id="system-skill-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="my-skill"
              value={name}
            />
            <p className="text-muted-foreground text-xs">
              Lowercase kebab-case. Agents load the skill by this name, and it
              cannot change later.
            </p>
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="system-skill-description">Description</Label>
          <Textarea
            className="min-h-20 leading-relaxed"
            id="system-skill-description"
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </div>
        <SystemSkillContentField
          content={content}
          description={description}
          onContentChange={setContent}
          onViewChange={setView}
          skill={skill}
          view={view}
        />
        <div className="grid max-w-2xl gap-2">
          <Label htmlFor="system-skill-note">What changed</Label>
          <Textarea
            className="min-h-16"
            id="system-skill-note"
            onChange={(event) => setNote(event.target.value)}
            placeholder="Shown to workspaces whose copy is customized."
            value={note}
          />
        </div>
      </section>

      {skill ? (
        <SystemSkillVersions
          onLoad={(version) => {
            loadIntoEditor(version);
            setNote(`Restored v${version.version}`);
          }}
          skill={skill}
        />
      ) : null}

      <ConfirmDialog
        confirmLabel={`Publish v${nextVersion}`}
        description={publishSummary(skill?.adoption ?? null)}
        onConfirm={() => publish.mutate()}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        pending={publish.isPending}
        title={`Publish ${name || "skill"}?`}
      />
    </main>
  );
}
