"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { consoleOrpc } from "@/lib/orpc/query";
import type { SaveFreeScanClaimInput } from "@/types/free-scans";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useFreeScanActions() {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: consoleOrpc.freeScans.key() });

  const save = useMutation({
    mutationFn: (input: SaveFreeScanClaimInput) =>
      consoleOrpc.freeScans.save.call(input),
    onSuccess: async () => {
      toast.success("Free scan saved");
      await refresh();
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not save the free scan")),
  });

  const run = useMutation({
    mutationFn: (input: { domain: string }) =>
      consoleOrpc.freeScans.run.call(input),
    onSuccess: async (result) => {
      if (result.started) {
        toast.success(`Scan started with ${result.promptCount} prompts`);
      } else {
        toast.error(`Scan not started: ${result.reason.replaceAll("_", " ")}`);
      }
      await refresh();
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not start the scan")),
  });

  return { save, run };
}
