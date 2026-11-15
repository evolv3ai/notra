"use client";

import { LineDiff } from "@notra/ui/components/shared/line-diff";
import { Label } from "@notra/ui/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@notra/ui/components/ui/tabs";
import { Textarea } from "@notra/ui/components/ui/textarea";

import { DiffSection } from "@/components/skills/diff-section";
import type { SystemSkillContentFieldProps } from "@/types/skills";

export function SystemSkillContentField({
  skill,
  view,
  description,
  content,
  onViewChange,
  onContentChange,
}: SystemSkillContentFieldProps) {
  return (
    <Tabs className="gap-3" onValueChange={onViewChange} value={view}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="system-skill-content">Content</Label>
        {skill ? (
          <TabsList variant="line">
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="changes">
              Changes from v{skill.version}
            </TabsTrigger>
          </TabsList>
        ) : null}
      </div>
      <TabsContent value="edit">
        <Textarea
          className="max-h-[min(70vh,48rem)] min-h-96 resize-y font-mono text-sm leading-relaxed"
          id="system-skill-content"
          onChange={(event) => onContentChange(event.target.value)}
          spellCheck={false}
          value={content}
        />
      </TabsContent>
      {skill ? (
        <TabsContent value="changes">
          <div className="divide-y overflow-hidden rounded-lg border">
            {description === skill.description ? null : (
              <DiffSection label="Description">
                <LineDiff after={description} before={skill.description} />
              </DiffSection>
            )}
            <DiffSection label="Content">
              <LineDiff after={content} before={skill.content} />
            </DiffSection>
          </div>
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
