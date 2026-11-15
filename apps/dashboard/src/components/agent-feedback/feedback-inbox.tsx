"use client";

import { InboxIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { AgentFeedbackStatus } from "@notra/db/types/agent-feedback";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import {
  IconTabsList,
  IconTabsTrigger,
} from "@notra/ui/components/ui/icon-tabs";
import { Tabs, TabsContent } from "@notra/ui/components/ui/tabs";
import { cn } from "@notra/ui/lib/utils";
import { useReducedMotion } from "motion/react";
import { type ReactNode, useState } from "react";
import { useTranslations } from "use-intl";

import { AgentFeedbackEmpty } from "@/components/agent-feedback/feedback-empty";
import { AgentFeedbackStatusIcon } from "@/components/agent-feedback/feedback-status-icon";
import { AgentFeedbackTable } from "@/components/agent-feedback/feedback-table";
import { Button } from "@/components/button";
import { Confetti } from "@/components/confetti";
import { PageContainer } from "@/components/layout/container";
import {
  AGENT_FEEDBACK_DEFAULT_STATUS_FILTER,
  AGENT_FEEDBACK_STATUS_FILTERS,
} from "@/constants/agent-feedback";
import {
  useAgentFeedbackDelete,
  useAgentFeedbackList,
  useAgentFeedbackUpdateStatus,
} from "@/lib/hooks/use-agent-feedback";
import { useAgentFeedbackFilterLabels } from "@/lib/hooks/use-agent-feedback-labels";
import type {
  AgentFeedbackItem,
  AgentFeedbackInboxProps,
  AgentFeedbackStatusFilter,
} from "@/types/agent-feedback";
import { isAgentFeedbackStatusFilter } from "@/utils/agent-feedback";
import lazyComponent from "@/utils/lazy-component";

const AgentFeedbackDetailDialog = lazyComponent(() =>
  import("@/components/agent-feedback/feedback-detail-dialog").then(
    (module) => module.AgentFeedbackDetailDialog
  )
);

const FEEDBACK_CONFETTI_COLORS = [
  "var(--primary)",
  "#FFC700",
  "#FF6B6B",
  "#41BBC7",
  "#A78BFA",
  "#34D399",
];

export function AgentFeedbackInbox({
  emptyState,
  footer,
  heading,
  organizationId,
}: AgentFeedbackInboxProps) {
  const reduceMotion = useReducedMotion();
  const [statusFilter, setStatusFilter] = useState<AgentFeedbackStatusFilter>(
    AGENT_FEEDBACK_DEFAULT_STATUS_FILTER
  );
  const [selected, setSelected] = useState<AgentFeedbackItem | null>(null);
  const [hasOpenedDetail, setHasOpenedDetail] = useState(false);
  const [deleteCandidate, setDeleteCandidate] =
    useState<AgentFeedbackItem | null>(null);
  const [resolvedCelebration, setResolvedCelebration] = useState(0);

  const list = useAgentFeedbackList(organizationId, statusFilter);
  const updateStatus = useAgentFeedbackUpdateStatus(organizationId);
  const deleteFeedback = useAgentFeedbackDelete(organizationId);

  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const counts = list.data?.pages[0]?.counts;
  const totalCount = counts
    ? Object.values(counts).reduce((sum, value) => sum + value, 0)
    : 0;
  const selectedItem = selected
    ? (items.find((item) => item.id === selected.id) ?? selected)
    : null;
  const isLoading = !!organizationId && list.isPending;
  const showEmptyState = !isLoading && totalCount === 0;

  const handleStatusChange = (
    item: AgentFeedbackItem,
    status: AgentFeedbackStatus
  ) => {
    if (item.status === status) {
      return;
    }

    const wasResolved = item.status === "resolved";
    const syncSelected = (next: AgentFeedbackItem) =>
      setSelected((current) => (current?.id === next.id ? next : current));

    syncSelected({ ...item, status });
    updateStatus.mutate(
      { feedbackId: item.id, previousStatus: item.status, status },
      {
        onSuccess: (updated) => {
          syncSelected(updated);
          if (status === "resolved" && !wasResolved) {
            setResolvedCelebration((current) => current + 1);
          }
        },
        onError: () => syncSelected(item),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteCandidate) {
      return;
    }

    const feedbackId = deleteCandidate.id;
    deleteFeedback.mutate(feedbackId, {
      onSuccess: () => {
        setDeleteCandidate(null);
        setSelected((current) => (current?.id === feedbackId ? null : current));
      },
    });
  };

  return (
    <PageContainer
      className={cn(
        "flex flex-1 flex-col py-4 md:py-6",
        !showEmptyState && "h-full min-h-full overflow-hidden"
      )}
    >
      {resolvedCelebration > 0 && !reduceMotion ? (
        <FeedbackConfetti celebration={resolvedCelebration} />
      ) : null}
      <div
        className={cn(
          "w-full px-4 lg:px-6",
          showEmptyState ? "space-y-6" : "flex min-h-0 flex-1 flex-col gap-6"
        )}
      >
        {heading(showEmptyState)}

        <FeedbackList
          emptyState={emptyState}
          isDeleting={deleteFeedback.isPending}
          isFetchingNextPage={list.isFetchingNextPage}
          isLoading={isLoading}
          isPlaceholderData={list.isPlaceholderData}
          isUpdatingStatus={updateStatus.isPending}
          items={items}
          hasNextPage={list.hasNextPage}
          onDelete={setDeleteCandidate}
          onLoadMore={() => list.fetchNextPage()}
          onSelect={(item) => {
            setSelected(item);
            setHasOpenedDetail(true);
          }}
          onStatusChange={handleStatusChange}
          onStatusFilterChange={setStatusFilter}
          organizationId={organizationId}
          selectedId={selected?.id ?? null}
          showEmptyState={showEmptyState}
          statusFilter={statusFilter}
          tableGrows={!footer}
        />
        {showEmptyState || !footer ? null : (
          <div className="shrink-0">{footer}</div>
        )}
      </div>

      {hasOpenedDetail ? (
        <AgentFeedbackDetailDialog
          isUpdating={updateStatus.isPending}
          item={selectedItem}
          onDelete={() => {
            if (selectedItem) {
              setDeleteCandidate(selectedItem);
            }
          }}
          onOpenChange={(open) => {
            if (!open) {
              setSelected(null);
            }
          }}
          onStatusChange={(status) => {
            if (selectedItem) {
              handleStatusChange(selectedItem, status);
            }
          }}
          open={selectedItem !== null}
        />
      ) : null}

      <FeedbackDeleteDialog
        deleteCandidate={deleteCandidate}
        isPending={deleteFeedback.isPending}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open && !deleteFeedback.isPending) {
            setDeleteCandidate(null);
          }
        }}
      />
    </PageContainer>
  );
}

function FeedbackList({
  emptyState,
  hasNextPage,
  isDeleting,
  isFetchingNextPage,
  isLoading,
  isPlaceholderData,
  isUpdatingStatus,
  items,
  onDelete,
  onLoadMore,
  onSelect,
  onStatusChange,
  onStatusFilterChange,
  organizationId,
  selectedId,
  showEmptyState,
  statusFilter,
  tableGrows,
}: {
  emptyState?: ReactNode;
  hasNextPage: boolean;
  isDeleting: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  isPlaceholderData: boolean;
  isUpdatingStatus: boolean;
  items: AgentFeedbackItem[];
  onDelete: (item: AgentFeedbackItem) => void;
  onLoadMore: () => void;
  onSelect: (item: AgentFeedbackItem) => void;
  onStatusChange: (
    item: AgentFeedbackItem,
    status: AgentFeedbackStatus
  ) => void;
  onStatusFilterChange: (value: AgentFeedbackStatusFilter) => void;
  organizationId: string;
  selectedId: string | null;
  showEmptyState: boolean;
  statusFilter: AgentFeedbackStatusFilter;
  tableGrows: boolean;
}) {
  const tCommon = useTranslations("common");
  const filterLabels = useAgentFeedbackFilterLabels();
  if (showEmptyState) {
    return emptyState ?? <AgentFeedbackEmpty organizationId={organizationId} />;
  }

  return (
    <Tabs
      className={cn("min-h-0 gap-6", tableGrows ? "flex-1" : "flex-initial")}
      onValueChange={(value) => {
        if (isAgentFeedbackStatusFilter(value)) {
          onStatusFilterChange(value);
        }
      }}
      value={statusFilter}
    >
      <div className="w-fit max-w-full shrink-0 overflow-x-auto">
        <IconTabsList
          aria-label={tCommon("labels.filterByStatus")}
          value={statusFilter}
        >
          {AGENT_FEEDBACK_STATUS_FILTERS.map((filter) => (
            <IconTabsTrigger
              icon={
                filter.value === "all" ? (
                  <HugeiconsIcon icon={InboxIcon} size={15} />
                ) : (
                  <AgentFeedbackStatusIcon
                    status={filter.value === "open" ? "new" : filter.value}
                  />
                )
              }
              key={filter.value}
              value={filter.value}
            >
              {filterLabels[filter.value]}
            </IconTabsTrigger>
          ))}
        </IconTabsList>
      </div>

      <TabsContent
        className={cn("min-h-0", tableGrows ? "flex-1" : "flex-initial")}
        value={statusFilter}
      >
        <AgentFeedbackTable
          isDeleting={isDeleting}
          emptyState={
            statusFilter === "all" ? undefined : (
              <FeedbackFilterEmpty
                onShowAll={() => onStatusFilterChange("all")}
                filter={statusFilter}
              />
            )
          }
          isPending={isLoading || isPlaceholderData}
          isUpdatingStatus={isUpdatingStatus}
          items={items}
          loadingMore={isFetchingNextPage}
          onDelete={onDelete}
          onLoadMore={hasNextPage ? onLoadMore : undefined}
          onSelect={onSelect}
          onStatusChange={onStatusChange}
          selectedId={selectedId}
        />
      </TabsContent>
    </Tabs>
  );
}

function FeedbackFilterEmpty({
  filter,
  onShowAll,
}: {
  filter: Exclude<AgentFeedbackStatusFilter, "all">;
  onShowAll: () => void;
}) {
  const t = useTranslations("feedback.table");
  const status = filter === "open" ? "resolved" : filter;
  return (
    <Empty className="py-8 md:py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AgentFeedbackStatusIcon className="size-5" status={status} />
        </EmptyMedia>
        <EmptyTitle>{t(`filterEmpty.${filter}.title`)}</EmptyTitle>
        <EmptyDescription>
          {t(`filterEmpty.${filter}.description`)}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onShowAll} size="sm" variant="outline">
          {t("showAll")}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function FeedbackConfetti({ celebration }: { celebration: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-1/2 z-[100] -translate-x-1/2"
    >
      <Confetti
        colors={FEEDBACK_CONFETTI_COLORS}
        duration={3000}
        force={0.5}
        key={celebration}
        particleCount={120}
        particleShape="mix"
        particleSize={8}
        stageHeight={600}
        stageWidth={800}
      />
    </div>
  );
}

function FeedbackDeleteDialog({
  deleteCandidate,
  isPending,
  onConfirm,
  onOpenChange,
}: {
  deleteCandidate: AgentFeedbackItem | null;
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("feedback.delete");
  const tCommon = useTranslations("common");
  return (
    <ConfirmDialog
      confirmLabel={tCommon("actions.delete")}
      description={t("description", {
        name: deleteCandidate?.title ?? deleteCandidate?.message ?? "",
      })}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={deleteCandidate !== null}
      pending={isPending}
      title={t("title")}
      variant="destructive"
    />
  );
}
