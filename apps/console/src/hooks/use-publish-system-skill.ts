import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { consoleOrpc } from "@/lib/orpc/query";
import { publishSystemSkillInputSchema } from "@/schemas/skills";
import type { UsePublishSystemSkillOptions } from "@/types/skills";

export function usePublishSystemSkill({
  slug,
  baseVersion,
  draft,
  onSettled,
}: UsePublishSystemSkillOptions) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      const parsed = publishSystemSkillInputSchema.safeParse({
        ...draft,
        note: draft.note || undefined,
        expectedVersion: baseVersion,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid skill");
      }
      return consoleOrpc.skills.publish.call(parsed.data);
    },
    onSuccess: async (result) => {
      toast.success(
        `Published ${draft.name} v${result.version}: ${result.updatedCopies} updated, ${result.addedCopies} added`
      );
      await queryClient.invalidateQueries({
        queryKey: consoleOrpc.skills.key(),
      });
      if (baseVersion === null) {
        router.push(`/${slug}/skills/${draft.name}`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSettled,
  });
}
