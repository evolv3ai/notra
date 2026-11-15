"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { dashboardOrpc } from "@/lib/orpc/query";

export function useContentAuthors(organizationId: string) {
  const queryClient = useQueryClient();
  const query = useQuery(
    dashboardOrpc.content.authors.list.queryOptions({
      input: { organizationId },
      enabled: Boolean(organizationId),
    })
  );
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.content.authors.list.key(),
    });

  const ensureSelf = useMutation(
    dashboardOrpc.content.authors.ensureSelf.mutationOptions({
      onSuccess: invalidate,
    })
  );
  const create = useMutation(
    dashboardOrpc.content.authors.create.mutationOptions({
      onSuccess: invalidate,
    })
  );
  const update = useMutation(
    dashboardOrpc.content.authors.update.mutationOptions({
      onSuccess: invalidate,
    })
  );
  const remove = useMutation(
    dashboardOrpc.content.authors.delete.mutationOptions({
      onSuccess: invalidate,
    })
  );

  return {
    authors: query.data?.authors ?? [],
    currentUserId: query.data?.currentUserId ?? null,
    isLoading: query.isPending,
    ensureSelf,
    create,
    update,
    remove,
  };
}
