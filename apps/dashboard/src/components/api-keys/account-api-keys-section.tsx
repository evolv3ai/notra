"use client";

import {
  Add01Icon,
  AlertCircleIcon,
  Delete02Icon,
  Dots,
  Edit02Icon,
  InformationCircleIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { API_KEY_DEFAULT_SCOPES } from "@notra/schemas/constants/dashboard/api-keys";
import type {
  CreateApiKeyInput,
  UpdateApiKeyInput,
} from "@notra/schemas/dashboard/api-keys";
import {
  createApiKeySchema,
  updateApiKeySchema,
} from "@notra/schemas/dashboard/api-keys";
import { ConfirmDialog } from "@notra/ui/components/shared/confirm-dialog";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { Alert, AlertDescription } from "@notra/ui/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notra/ui/components/ui/empty";
import { Field, FieldLabel } from "@notra/ui/components/ui/field";
import { Input } from "@notra/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable, type TableColumn } from "ui/table";
import { useTranslations } from "use-intl";

import { ApiKeyPermissionBadge } from "@/components/api-keys/api-key-permission-badge";
import { ApiKeyRevealField } from "@/components/api-keys/api-key-reveal-field";
import { ApiKeyStatusBadge } from "@/components/api-keys/api-key-status-badge";
import { ApiKeyPermissionSelector } from "@/components/api-keys/permission-selector";
import { Button } from "@/components/button";
import { SiteRelativeTime } from "@/components/sites/site-relative-time";
import {
  API_KEY_EXPIRATION_OPTIONS,
  API_KEYS_EMPTY_TABLE_HEIGHT,
} from "@/constants/api-keys";
import { inferApiKeyExpiration } from "@/lib/api-keys/expiration";
import { expandLegacyApiKeyScopes } from "@/lib/api-keys/scopes";
import { useApiKeyExpirationItems } from "@/lib/hooks/use-api-key-expiration-items";
import { useApiKeyStatusNow } from "@/lib/hooks/use-api-key-status-now";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  ApiKeyAccessMode,
  ApiKeyExpiration,
  ApiKeyListItem,
} from "@/types/api-keys";
import { apiKeyStatus } from "@/utils/api-key-status";

export function AccountApiKeysSection() {
  const t = useTranslations("apiKeys");
  const tAccount = useTranslations("apiKeys.account");
  const tApiKeysShared = useTranslations("apiKeys.shared");
  const tCommon = useTranslations("common");
  const expirationItems = useApiKeyExpirationItems();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [accessMode, setAccessMode] = useState<ApiKeyAccessMode>("restricted");
  const [scopes, setScopes] = useState<string[]>([...API_KEY_DEFAULT_SCOPES]);
  const [expiration, setExpiration] = useState<ApiKeyExpiration>("30d");
  const [editingKey, setEditingKey] = useState<ApiKeyListItem | null>(null);
  const [editValues, setEditValues] = useState({
    name: "",
    accessMode: "restricted" as ApiKeyAccessMode,
    scopes: [] as string[],
    expiration: "never" as ApiKeyExpiration,
  });
  const [deletingKey, setDeletingKey] = useState<ApiKeyListItem | null>(null);

  const accountListKey = dashboardOrpc.apiKeys.account.list.queryKey();
  const {
    data: keys = [],
    isError,
    isFetching,
    isPending,
    refetch,
  } = useQuery(dashboardOrpc.apiKeys.account.list.queryOptions());

  const createMutation = useMutation({
    mutationFn: async (values: CreateApiKeyInput) =>
      dashboardOrpc.apiKeys.account.create.call(values),
    onSuccess: (data) => {
      setCreatedKey(data.key);
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: accountListKey });
      toast.success(tAccount("toasts.created"));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: UpdateApiKeyInput) =>
      dashboardOrpc.apiKeys.account.update.call({
        keyIdParam: values.keyId,
        payload: values,
      }),
    onSuccess: () => {
      setEditingKey(null);
      queryClient.invalidateQueries({ queryKey: accountListKey });
      toast.success(tAccount("toasts.updated"));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (keyId: string) =>
      dashboardOrpc.apiKeys.account.delete.call({
        keyIdParam: keyId,
        payload: { keyId },
      }),
    onSuccess: () => {
      setDeletingKey(null);
      queryClient.invalidateQueries({ queryKey: accountListKey });
      toast.success(tAccount("toasts.deleted"));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetCreateForm = () => {
    setName("");
    setAccessMode("restricted");
    setScopes([...API_KEY_DEFAULT_SCOPES]);
    setExpiration("30d");
  };

  const handleCreateSubmit = () => {
    const result = createApiKeySchema.safeParse({
      name,
      accessMode,
      scopes,
      expiration,
    });
    if (!result.success) {
      const field = result.error.issues[0]?.path[0];
      if (field === "name") {
        setCreateError(tCommon("labels.nameIsRequired"));
      } else if (field === "scopes") {
        setCreateError(t("validation.selectPermission"));
      } else {
        setCreateError(t("validation.invalidKey"));
      }
      return;
    }
    setCreateError(null);
    createMutation.mutate(result.data);
  };

  const openEditDialog = (key: ApiKeyListItem) => {
    setEditValues({
      name: key.name,
      accessMode: key.accessMode,
      scopes: expandLegacyApiKeyScopes(key.permissions),
      expiration: inferApiKeyExpiration(key.createdAt, key.expires),
    });
    setEditingKey(key);
  };

  const handleEditSubmit = () => {
    if (!editingKey) {
      return;
    }
    const result = updateApiKeySchema.safeParse({
      keyId: editingKey.keyId,
      ...editValues,
    });
    if (!result.success) {
      toast.error(
        result.error.issues[0]?.path[0] === "name"
          ? tCommon("labels.nameIsRequired")
          : t("validation.invalidKey")
      );
      return;
    }
    updateMutation.mutate(result.data);
  };

  const now = useApiKeyStatusNow(keys);

  const columns: TableColumn<ApiKeyListItem>[] = [
    {
      key: "name",
      header: tCommon("labels.name"),
      width: "1fr",
      minWidth: "10rem",
      cell: (key) => (
        <span className="font-medium" title={key.name}>
          {key.name}
        </span>
      ),
    },
    {
      key: "start",
      header: t("columns.key"),
      width: "1fr",
      minWidth: "9rem",
      cell: (key) => (
        <span className="text-muted-foreground font-mono text-sm">
          {key.start}…
        </span>
      ),
    },
    {
      key: "permission",
      header: t("columns.permission"),
      width: "1fr",
      minWidth: "9rem",
      cell: (key) => <ApiKeyPermissionBadge permission={key.permission} />,
    },
    {
      key: "status",
      header: t("columns.status"),
      width: "9.5rem",
      collapsePriority: 2,
      cell: (key) => <ApiKeyStatusBadge status={apiKeyStatus(key, now)} />,
    },
    {
      key: "expires",
      header: tCommon("labels.expires"),
      width: "8.75rem",
      collapsePriority: 1,
      cell: (key) =>
        key.expires === null ? (
          <span className="text-muted-foreground text-sm">
            {tCommon("labels.never")}
          </span>
        ) : (
          <SiteRelativeTime
            className="text-muted-foreground text-sm whitespace-nowrap"
            date={new Date(key.expires)}
          />
        ),
    },
    {
      key: "createdAt",
      header: tCommon("labels.createdAt"),
      sortable: true,
      width: "9.5rem",
      cell: (key) => (
        <SiteRelativeTime
          className="text-muted-foreground text-sm whitespace-nowrap"
          date={new Date(key.createdAt)}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      width: "4rem",
      minWidth: "4rem",
      cell: (key) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={tCommon("labels.actionsForName", {
                  name: key.name,
                })}
                size="icon"
                variant="ghost"
              >
                <HugeiconsIcon className="size-4" icon={Dots} />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={updateMutation.isPending || deleteMutation.isPending}
                onClick={() => openEditDialog(key)}
              >
                <HugeiconsIcon className="size-4" icon={Edit02Icon} />
                {tApiKeysShared("editApiKey")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={updateMutation.isPending || deleteMutation.isPending}
                onClick={() => setDeletingKey(key)}
                variant="destructive"
              >
                <HugeiconsIcon className="size-4" icon={Delete02Icon} />
                {tApiKeysShared("deleteApiKey")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const showLoadError = isError && keys.length === 0;
  const isEmpty = !(isPending || showLoadError) && keys.length === 0;
  const visibleRows = keys.length;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">
            {tAccount("title")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {tAccount.rich("description", {
              code: (chunks) => (
                <code className="text-foreground font-mono text-[0.8125rem]">
                  {chunks}
                </code>
              ),
            })}
          </p>
        </div>
        {isEmpty ? null : (
          <Button onClick={() => setDialogOpen(true)} variant="outline">
            <HugeiconsIcon className="size-4" icon={Add01Icon} />
            {tAccount("createKey")}
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={keys}
        emptyState={
          showLoadError ? (
            <Empty className="py-0 md:py-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={AlertCircleIcon} />
                </EmptyMedia>
                <EmptyTitle>{tAccount("loadFailedTitle")}</EmptyTitle>
                <EmptyDescription>
                  {tAccount("loadFailedDescription")}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  disabled={isFetching}
                  onClick={() => refetch()}
                  size="sm"
                  variant="outline"
                >
                  {tCommon("actions.tryAgain")}
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Empty className="py-0 md:py-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={UserCircleIcon} />
                </EmptyMedia>
                <EmptyTitle>{tAccount("emptyTitle")}</EmptyTitle>
                <EmptyDescription>
                  {tAccount("emptyDescription")}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  onClick={() => setDialogOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  <HugeiconsIcon className="size-4" icon={Add01Icon} />
                  {tAccount("createKey")}
                </Button>
              </EmptyContent>
            </Empty>
          )
        }
        getRowId={(key) => key.keyId}
        height={
          isEmpty || showLoadError || isPending
            ? API_KEYS_EMPTY_TABLE_HEIGHT
            : (visibleRows + 1) * 48
        }
        loading={isPending}
        rowHeight={48}
      />

      <ResponsiveDialog
        onOpenChange={(open) => {
          if (!open && createMutation.isPending) {
            return;
          }
          setDialogOpen(open);
          if (!open) {
            setCreatedKey(null);
            setCreateError(null);
            resetCreateForm();
          }
        }}
        open={dialogOpen}
      >
        <ResponsiveDialogContent
          className={
            createdKey
              ? "sm:max-w-md"
              : "flex max-h-[85svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
          }
          drawerClassName="[&>form]:px-0"
        >
          {createdKey ? (
            <>
              <ResponsiveDialogHeader className="shrink-0">
                <ResponsiveDialogTitle>
                  {tAccount("viewTitle")}
                </ResponsiveDialogTitle>
              </ResponsiveDialogHeader>
              <div className="space-y-4">
                <Alert variant="info">
                  <HugeiconsIcon icon={InformationCircleIcon} />
                  <AlertDescription>
                    {t.rich("create.onceNotice", {
                      strong: (chunks) => (
                        <span className="text-foreground font-medium">
                          {chunks}
                        </span>
                      ),
                    })}
                  </AlertDescription>
                </Alert>
                <Field>
                  <FieldLabel>{tCommon("labels.apiKey")}</FieldLabel>
                  <ApiKeyRevealField value={createdKey} />
                </Field>
              </div>
              <ResponsiveDialogFooter>
                <ResponsiveDialogClose
                  render={<Button>{tCommon("actions.done")}</Button>}
                />
              </ResponsiveDialogFooter>
            </>
          ) : (
            <form
              action={handleCreateSubmit}
              className="flex min-h-0 flex-1 flex-col"
            >
              <ResponsiveDialogHeader className="shrink-0 border-b p-4 pr-14">
                <ResponsiveDialogTitle className="text-2xl">
                  {tAccount("createTitle")}
                </ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  {tAccount("createDescription")}
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
                <Field className="shrink-0">
                  <FieldLabel>
                    {tCommon("labels.name")}
                    <span className="text-destructive -ml-1">*</span>
                  </FieldLabel>
                  <Input
                    disabled={createMutation.isPending}
                    onChange={(event) => {
                      setCreateError(null);
                      setName(event.target.value);
                    }}
                    placeholder={tAccount("namePlaceholder")}
                    value={name}
                  />
                  {createError ? (
                    <p className="text-destructive text-sm">{createError}</p>
                  ) : null}
                </Field>
                <Field className="shrink-0">
                  <FieldLabel>{t("form.expiration")}</FieldLabel>
                  <Select
                    disabled={createMutation.isPending}
                    items={expirationItems}
                    onValueChange={(value) =>
                      setExpiration(value as ApiKeyExpiration)
                    }
                    value={expiration}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {API_KEY_EXPIRATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t("expirationOption", { value: option.value })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <FieldLabel>
                    {tCommon("labels.permissions")}
                    <span className="text-destructive -ml-1">*</span>
                  </FieldLabel>
                  <ApiKeyPermissionSelector
                    accessMode={accessMode}
                    disabled={createMutation.isPending}
                    onAccessModeChange={(mode, nextScopes) => {
                      setAccessMode(mode);
                      setScopes(nextScopes);
                    }}
                    onValueChange={setScopes}
                    value={scopes}
                  />
                </Field>
              </div>
              <ResponsiveDialogFooter className="bg-background/95 supports-backdrop-filter:bg-background/80 mx-0 mb-0 shrink-0 rounded-b-xl border-t p-4 sm:justify-between">
                <ResponsiveDialogClose
                  disabled={createMutation.isPending}
                  render={
                    <Button variant="outline">
                      {tCommon("actions.cancel")}
                    </Button>
                  }
                />
                <Button
                  data-dialog-confirm
                  disabled={createMutation.isPending}
                  type="submit"
                >
                  {createMutation.isPending
                    ? tCommon("actions.creating")
                    : t("create.submit")}
                </Button>
              </ResponsiveDialogFooter>
            </form>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ResponsiveDialog
        onOpenChange={(open) => {
          if (!open && !updateMutation.isPending) {
            setEditingKey(null);
          }
        }}
        open={!!editingKey}
      >
        <ResponsiveDialogContent className="flex max-h-[85svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <form
            action={handleEditSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <ResponsiveDialogHeader className="shrink-0 border-b p-4 pr-14">
              <ResponsiveDialogTitle className="text-2xl">
                {tAccount("editTitle")}
              </ResponsiveDialogTitle>
            </ResponsiveDialogHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
              <Field className="shrink-0">
                <FieldLabel>
                  {tCommon("labels.name")}
                  <span className="text-destructive -ml-1">*</span>
                </FieldLabel>
                <Input
                  disabled={updateMutation.isPending}
                  onChange={(e) =>
                    setEditValues((prev) => ({ ...prev, name: e.target.value }))
                  }
                  value={editValues.name}
                />
              </Field>
              <Field className="shrink-0">
                <FieldLabel>{t("form.expiration")}</FieldLabel>
                <Select
                  disabled={updateMutation.isPending}
                  items={expirationItems}
                  onValueChange={(value) =>
                    setEditValues((prev) => ({
                      ...prev,
                      expiration: value as ApiKeyExpiration,
                    }))
                  }
                  value={editValues.expiration}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {API_KEY_EXPIRATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t("expirationOption", { value: option.value })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <FieldLabel>
                  {tCommon("labels.permissions")}
                  <span className="text-destructive -ml-1">*</span>
                </FieldLabel>
                <ApiKeyPermissionSelector
                  accessMode={editValues.accessMode}
                  disabled={updateMutation.isPending}
                  onAccessModeChange={(mode, nextScopes) =>
                    setEditValues((prev) => ({
                      ...prev,
                      accessMode: mode,
                      scopes: nextScopes,
                    }))
                  }
                  onValueChange={(nextScopes) =>
                    setEditValues((prev) => ({
                      ...prev,
                      scopes: nextScopes,
                    }))
                  }
                  value={editValues.scopes}
                />
              </Field>
            </div>
            <ResponsiveDialogFooter className="bg-background/95 supports-backdrop-filter:bg-background/80 mx-0 mb-0 shrink-0 rounded-b-xl border-t p-4">
              <ResponsiveDialogClose
                disabled={updateMutation.isPending}
                render={
                  <Button variant="outline">{tCommon("actions.cancel")}</Button>
                }
              />
              <Button
                data-dialog-confirm
                disabled={updateMutation.isPending}
                type="submit"
              >
                {updateMutation.isPending
                  ? tCommon("actions.saving")
                  : tCommon("actions.saveChanges")}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ConfirmDialog
        confirmLabel={tApiKeysShared("deleteApiKey")}
        description={
          deletingKey
            ? t("delete.descriptionNamed", { name: deletingKey.name })
            : t("delete.description")
        }
        onConfirm={() => {
          if (deletingKey) {
            deleteMutation.mutate(deletingKey.keyId);
          }
        }}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) {
            setDeletingKey(null);
          }
        }}
        open={!!deletingKey}
        pending={deleteMutation.isPending}
        title={tAccount("deleteTitle")}
        variant="destructive"
      />
    </section>
  );
}
