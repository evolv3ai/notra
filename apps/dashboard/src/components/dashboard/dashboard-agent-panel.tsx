"use client";

import { useChat } from "@ai-sdk/react";
import { uiMessageSchema } from "@notra/ai/schemas/chat";
import type { ChatAttachment, ChatSessionSummary } from "@notra/ai/types/chat";
import {
  dashboardAgentChatHistoryQueryKey,
  dashboardAgentChatSessionsQueryKey,
} from "@notra/ai/utils/chat";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { cn } from "@notra/ui/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { nanoid } from "nanoid";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import ChatInput from "@/components/chat-input";
import type { QueuedMessage } from "@/components/chat/chat-queue";
import { ChatQuoteProvider } from "@/components/chat/chat-quote";
import { ChatSuggestions } from "@/components/chat/chat-suggestions";
import { ContentChatActivityPanel } from "@/components/content/content-chat-activity-panel";
import { useRightPanel } from "@/components/dashboard/right-panel-context";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { DASHBOARD_AGENT_SUGGESTIONS } from "@/constants/chat-suggestions";
import { localStorageKeys } from "@/constants/storage";
import { emitAutumnRefresh } from "@/lib/billing/autumn-refresh";
import { useActiveProject } from "@/lib/hooks/use-active-project";
import { useChatModelEffort } from "@/lib/hooks/use-chat-model-effort";
import { useDesktopBreakpoint } from "@/lib/hooks/use-desktop-breakpoint";
import { usePathname, useRouter } from "@/lib/navigation";
import { dashboardOrpcClient } from "@/lib/orpc/client";
import type { ContentChatInputHandle } from "@/types/components/chat-input";
import type { DashboardAgentChatProps } from "@/types/components/dashboard-agent";
import {
  hasPendingApproval,
  shouldContinueAfterApprovalResponse,
} from "@/utils/chat-approvals";
import { handleStandaloneChatError } from "@/utils/chat-error";
import { buildUserMessageParts } from "@/utils/chat-message-parts";
import {
  markQueuedMessageSteering,
  shouldDrainQueueAfterFinish,
} from "@/utils/chat-queue";
import { dashboardAgentOpenChatPath } from "@/utils/dashboard-agent-chat-path";

function DashboardAgentChat({
  hasOpened,
  organizationId,
  organizationSlug,
  onClose,
}: DashboardAgentChatProps) {
  const t = useTranslations("dashboard.agent");
  const tCommon = useTranslations("common");
  const tChatErrors = useTranslations("chat.errors");
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { active, expanded } = useRightPanel();
  const isDesktop = useDesktopBreakpoint();
  const open = active === "agent";
  const [chatInputValue, setChatInputValue] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string>(() =>
    crypto.randomUUID()
  );
  const [isHydratingHistory, setIsHydratingHistory] = useState(false);
  const messagesRef = useRef<UIMessage[]>([]);
  const isAgentBusyRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const closeAfterNavigationRef = useRef(false);
  const { projectId: activeProjectId, isResolved: isProjectResolved } =
    useActiveProject();
  const modelEffort = useChatModelEffort();
  const { model: effectiveModel, thinkingLevel } = modelEffort;
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const queuedMessagesRef = useRef<QueuedMessage[]>([]);
  const steerAfterStopRef = useRef<QueuedMessage | null>(null);
  // Steering sends only once the stop request has returned AND the old
  // response has finished, so a late stop() can't abort the steered message.
  const steerStopPendingRef = useRef(false);
  // The queued message currently being sent; restored to the queue if it fails.
  const inFlightQueuedRef = useRef<{
    message: QueuedMessage;
    messageCount: number;
  } | null>(null);
  const wasStoppedByUserRef = useRef(false);
  const drainQueueRef = useRef<() => void>(() => {});
  const flushSteerRef = useRef<() => void>(() => {});
  const chatInputRef = useRef<ContentChatInputHandle | null>(null);

  const updateQueue = useCallback((next: QueuedMessage[]) => {
    queuedMessagesRef.current = next;
    setQueuedMessages(next);
  }, []);

  const sessionsQuery = useQuery<ChatSessionSummary[]>({
    queryKey: dashboardAgentChatSessionsQueryKey(organizationId),
    queryFn: async () => {
      const { sessions } = await dashboardOrpcClient.chat.sessions.list({
        organizationId,
      });
      return sessions;
    },
    enabled: hasOpened,
    staleTime: 60_000,
  });
  const sessions = (sessionsQuery.data ?? []).filter(
    (session) =>
      !session.externalChannelId || session.externalChannelId.source === "agent"
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/organizations/${organizationId}/chat`,
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: {
            ...body,
            chatId: activeChatId,
            projectId:
              isProjectResolved && activeProjectId
                ? activeProjectId
                : undefined,
            model: effectiveModel,
            thinkingLevel,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            // A response stopped before its first chunk leaves an empty
            // assistant message, which the request schema rejects.
            messages: messages.filter((message) => message.parts.length > 0),
            surface: "dashboard-agent",
          },
        }),
        fetch: async (input, init) => {
          const triggerResponse = await fetch(input, init);
          if (!triggerResponse.ok) {
            return triggerResponse;
          }

          const contentType = triggerResponse.headers.get("content-type") ?? "";
          if (contentType.includes("text/event-stream")) {
            return triggerResponse;
          }

          return fetch(
            `/api/organizations/${organizationId}/chat/${encodeURIComponent(activeChatId)}/stream`,
            {
              method: "GET",
              headers: init?.headers,
              credentials: init?.credentials,
              signal: init?.signal,
            }
          );
        },
      }),
    [
      activeChatId,
      activeProjectId,
      effectiveModel,
      isProjectResolved,
      organizationId,
      thinkingLevel,
    ]
  );

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
    addToolApprovalResponse,
  } = useChat({
    transport,
    sendAutomaticallyWhen: shouldContinueAfterApprovalResponse,
    onFinish: ({
      messages: finishedMessages,
      isAbort,
      isDisconnect,
      isError,
    }) => {
      messagesRef.current = finishedMessages;
      if (!isError) {
        inFlightQueuedRef.current = null;
      }
      emitAutumnRefresh();
      if (activeChatId) {
        queryClient.setQueryData(
          dashboardAgentChatHistoryQueryKey(organizationId, activeChatId),
          finishedMessages
        );
      }
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["chat-sessions", organizationId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["chat-history", organizationId, activeChatId],
        }),
      ]).catch((invalidateError) => {
        console.error("Failed to refresh agent chat sessions", invalidateError);
      });
      isAgentBusyRef.current = false;
      if (steerAfterStopRef.current) {
        flushSteerRef.current();
        return;
      }
      if (
        shouldDrainQueueAfterFinish({
          isAbort,
          isError,
          isDisconnect,
          wasStoppedByUser: wasStoppedByUserRef.current,
        })
      ) {
        drainQueueRef.current();
      }
    },
    onError: (err) => {
      isAgentBusyRef.current = false;
      const failed = inFlightQueuedRef.current;
      if (failed) {
        inFlightQueuedRef.current = null;
        setMessages((current) => current.slice(0, failed.messageCount));
        updateQueue([failed.message, ...queuedMessagesRef.current]);
      }
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["chat-sessions", organizationId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["chat-history", organizationId, activeChatId],
        }),
      ]).catch((invalidateError) => {
        console.error("Failed to refresh agent chat sessions", invalidateError);
      });
      queryClient
        .invalidateQueries({
          queryKey: dashboardAgentChatHistoryQueryKey(
            organizationId,
            activeChatId
          ),
        })
        .catch((invalidateError) => {
          console.error(
            "Failed to refresh agent chat history",
            invalidateError
          );
        });

      const { isUsageLimit } = handleStandaloneChatError(err, {
        setChatError,
        messages: {
          usageLimit: tChatErrors("usageLimit"),
          fallback: tChatErrors("fallback"),
        },
      });
      if (!isUsageLimit) {
        toast.error(t("sendFailed"));
      }
    },
  });

  const isAgentBusy = status === "streaming" || status === "submitted";
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useLayoutEffect(() => {
    messagesRef.current = messages;
    isAgentBusyRef.current = isAgentBusy || isHydratingHistory;
  }, [isAgentBusy, isHydratingHistory, messages]);

  const resetQueue = () => {
    steerAfterStopRef.current = null;
    steerStopPendingRef.current = false;
    inFlightQueuedRef.current = null;
    wasStoppedByUserRef.current = false;
    updateQueue([]);
  };

  const handleSelectChat = async (chatId: string) => {
    if (isAgentBusyRef.current || chatId === activeChatId) {
      return;
    }
    isAgentBusyRef.current = true;
    setIsHydratingHistory(true);
    try {
      const history = await queryClient.fetchQuery({
        queryKey: dashboardAgentChatHistoryQueryKey(organizationId, chatId),
        queryFn: async () => {
          const payload = await dashboardOrpcClient.chat.sessions.get({
            organizationId,
            chatId,
          });
          return uiMessageSchema.array().parse(payload.messages);
        },
        staleTime: 0,
      });
      setChatInputValue("");
      setChatError(null);
      resetQueue();
      setMessages(history);
      setActiveChatId(chatId);
    } catch {
      toast.error(t("historyLoadFailed"));
    }
    setIsHydratingHistory(false);
    isAgentBusyRef.current = false;
  };

  const handleNewChat = () => {
    if (isAgentBusyRef.current) {
      return;
    }
    setChatInputValue("");
    setChatError(null);
    resetQueue();
    if (messagesRef.current.length === 0) {
      return;
    }
    setMessages([]);
    setActiveChatId(crypto.randomUUID());
  };

  const handleApproveTool = (approvalId: string) => {
    addToolApprovalResponse({
      id: approvalId,
      approved: true,
    });
  };

  const handleDenyTool = (approvalId: string) => {
    addToolApprovalResponse({
      id: approvalId,
      approved: false,
      reason: "discard",
    });
  };

  const dispatchMessage = async (
    instruction: string,
    attachments: ChatAttachment[] = []
  ) => {
    for (const message of messagesRef.current) {
      if (message.role !== "assistant") {
        continue;
      }
      for (const part of message.parts) {
        if (!(isToolUIPart(part) && part.state === "approval-requested")) {
          continue;
        }
        const approvalId = part.approval?.id;
        if (!approvalId) {
          continue;
        }
        addToolApprovalResponse({
          id: approvalId,
          approved: false,
          reason: "discard",
        });
      }
    }
    isAgentBusyRef.current = true;
    wasStoppedByUserRef.current = false;
    if (attachments.length > 0) {
      await sendMessage({
        role: "user",
        parts: buildUserMessageParts(instruction, attachments),
      });
      return;
    }
    await sendMessage({ text: instruction });
  };

  const handleSend = async (
    instruction: string,
    attachments: ChatAttachment[] = []
  ) => {
    if (!activeChatId) {
      return;
    }
    if (isAgentBusyRef.current) {
      updateQueue([
        ...queuedMessagesRef.current,
        {
          id: nanoid(10),
          text: instruction,
          ...(attachments.length > 0 ? { attachments } : {}),
        },
      ]);
      return;
    }
    await dispatchMessage(instruction, attachments);
  };

  const dispatchQueued = (message: QueuedMessage) => {
    updateQueue(queuedMessagesRef.current.filter((m) => m.id !== message.id));
    inFlightQueuedRef.current = {
      message,
      messageCount: messagesRef.current.length,
    };
    dispatchMessage(message.text, message.attachments).catch((error) => {
      console.error("Failed to send queued agent message", error);
      isAgentBusyRef.current = false;
      if (inFlightQueuedRef.current?.message.id === message.id) {
        inFlightQueuedRef.current = null;
        updateQueue([message, ...queuedMessagesRef.current]);
      }
    });
  };

  const flushSteer = () => {
    const steered = steerAfterStopRef.current;
    if (!steered || steerStopPendingRef.current || isAgentBusyRef.current) {
      return;
    }
    steerAfterStopRef.current = null;
    const queued = queuedMessagesRef.current.find((m) => m.id === steered.id);
    if (queued) {
      dispatchQueued({ ...queued, steering: false });
    }
  };

  useEffect(() => {
    flushSteerRef.current = flushSteer;
    drainQueueRef.current = () => {
      const current = messagesRef.current;
      if (
        isAgentBusyRef.current ||
        wasStoppedByUserRef.current ||
        steerAfterStopRef.current ||
        hasPendingApproval(current) ||
        // The SDK resends on its own after an approval; draining now would double-submit.
        shouldContinueAfterApprovalResponse({ messages: current })
      ) {
        return;
      }
      const next = queuedMessagesRef.current[0];
      if (next) {
        dispatchQueued(next);
      }
    };
  });

  const stopResponse = useCallback(async () => {
    const response = await fetch(
      `/api/organizations/${organizationId}/chat/${encodeURIComponent(activeChatId)}/stop`,
      { method: "POST" }
    ).catch((stopError) => {
      console.error("Failed to stop dashboard agent response", stopError);
      return null;
    });

    if (!response?.ok) {
      if (response) {
        console.error(
          `Failed to stop dashboard agent response: status ${response.status}`
        );
      }
      toast.error(t("stopFailed"));
      return false;
    }

    stop();
    return true;
  }, [activeChatId, organizationId, stop, t]);

  const handleStop = async () => {
    steerAfterStopRef.current = null;
    steerStopPendingRef.current = false;
    wasStoppedByUserRef.current = true;
    updateQueue(
      queuedMessagesRef.current.map((message) => ({
        ...message,
        steering: false,
      }))
    );
    await stopResponse();
  };

  const handleRemoveQueued = (id: string) => {
    if (steerAfterStopRef.current?.id === id) {
      steerAfterStopRef.current = null;
    }
    updateQueue(queuedMessagesRef.current.filter((m) => m.id !== id));
  };

  const handleEditQueued = (message: QueuedMessage) => {
    if (
      message.attachments?.length &&
      !chatInputRef.current?.setAttachments(message.attachments)
    ) {
      return;
    }
    if (steerAfterStopRef.current?.id === message.id) {
      steerAfterStopRef.current = null;
    }
    updateQueue(queuedMessagesRef.current.filter((m) => m.id !== message.id));
    setChatInputValue(message.text);
  };

  const handleSteerQueued = async (message: QueuedMessage) => {
    if (
      steerAfterStopRef.current ||
      !queuedMessagesRef.current.some((queued) => queued.id === message.id)
    ) {
      return;
    }
    if (!isAgentBusyRef.current) {
      // dispatchMessage discards a pending approval, which the drain would wait on.
      dispatchQueued(message);
      return;
    }
    updateQueue(
      markQueuedMessageSteering(queuedMessagesRef.current, message.id)
    );
    steerAfterStopRef.current = message;
    steerStopPendingRef.current = true;
    const stopped = await stopResponse();
    steerStopPendingRef.current = false;
    if (stopped) {
      flushSteer();
      return;
    }
    steerAfterStopRef.current = null;
    updateQueue(
      queuedMessagesRef.current.map((queued) => ({
        ...queued,
        steering: false,
      }))
    );
    drainQueueRef.current();
  };

  const handleSuggestionSelect = (prompt: string) => {
    setChatInputValue(prompt);
  };

  const handleOpenChat = () => {
    const hasConversation =
      messagesRef.current.length > 0 ||
      Boolean(
        sessionsQuery.data?.some((session) => session.chatId === activeChatId)
      );
    const path = dashboardAgentOpenChatPath(organizationSlug, {
      chatId: activeChatId,
      hasConversation,
    });

    if (pathname === path) {
      onClose();
      return;
    }

    closeAfterNavigationRef.current = true;
    router.prefetch(path);
    router.push(path, { scroll: false });
  };

  useEffect(() => {
    if (!closeAfterNavigationRef.current) {
      return;
    }
    closeAfterNavigationRef.current = false;
    onCloseRef.current();
  }, [pathname]);

  const isChatDisabled = isHydratingHistory;
  const showExamplePrompts =
    messages.length === 0 && !isAgentBusy && !isHydratingHistory;

  const chat = hasOpened ? (
    <div className="h-full min-h-0 max-w-full min-w-0">
      <ChatQuoteProvider key={activeChatId}>
        <ContentChatActivityPanel
          activeChatId={activeChatId}
          isHistoryLoading={sessionsQuery.isPending || isHydratingHistory}
          messages={messages}
          onApproveTool={handleApproveTool}
          onClose={onClose}
          onDenyTool={handleDenyTool}
          onNewChat={handleNewChat}
          onOpenChat={handleOpenChat}
          onSelectChat={handleSelectChat}
          organizationSlug={organizationSlug}
          showHistory={false}
          sessions={sessions}
          status={status}
          title={tCommon("labels.agent")}
        >
          {showExamplePrompts ? (
            <div className="px-2">
              <ChatSuggestions
                disabled={isChatDisabled}
                dismissStorageKey={
                  localStorageKeys.dashboardAgentSuggestionsDismissed
                }
                hidden={chatInputValue.trim().length > 0}
                layout="list"
                onSelect={handleSuggestionSelect}
                rotate
                suggestions={DASHBOARD_AGENT_SUGGESTIONS}
              />
            </div>
          ) : null}
          <div className="shrink-0 p-2 pt-1">
            <ChatInput
              disabled={isChatDisabled}
              error={chatError}
              isLoading={isAgentBusy}
              modelEffort={modelEffort}
              onClearError={() => setChatError(null)}
              onEditQueued={handleEditQueued}
              onRemoveQueued={handleRemoveQueued}
              onSend={handleSend}
              onSteerQueued={handleSteerQueued}
              onStop={handleStop}
              onValueChange={setChatInputValue}
              organizationId={organizationId}
              organizationSlug={
                chatError && chatError !== tChatErrors("usageLimit")
                  ? ""
                  : organizationSlug
              }
              placeholder={t("placeholder")}
              queuedMessages={queuedMessages}
              ref={chatInputRef}
              value={chatInputValue}
            />
          </div>
        </ContentChatActivityPanel>
      </ChatQuoteProvider>
    </div>
  ) : null;

  if (isDesktop) {
    return chat;
  }

  return (
    <ResponsiveDialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      open={open}
    >
      <ResponsiveDialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          expanded
            ? "h-svh max-h-svh max-w-none rounded-none sm:max-w-none"
            : "h-[85svh] max-h-[85svh] sm:max-w-md"
        )}
        drawerClassName={cn(
          "[&>*:not([data-slot=sheet-header]):not([data-slot=sheet-footer]):not([data-slot=sheet-close])]:px-0",
          expanded && "h-svh max-h-svh rounded-none"
        )}
        keepMounted
        showCloseButton={false}
      >
        <ResponsiveDialogHeader className="sr-only">
          <ResponsiveDialogTitle>
            {tCommon("labels.agent")}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {t("description")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {chat}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function DashboardAgentHost() {
  const { closePanel, hasOpened } = useRightPanel();
  const { activeOrganization } = useOrganizationsContext();
  const organizationId = activeOrganization?.id ?? "";
  const organizationSlug = activeOrganization?.slug ?? "";

  if (!organizationId) {
    return null;
  }

  return (
    <DashboardAgentChat
      hasOpened={hasOpened.agent}
      key={organizationId}
      onClose={() => closePanel("agent")}
      organizationId={organizationId}
      organizationSlug={organizationSlug}
    />
  );
}
