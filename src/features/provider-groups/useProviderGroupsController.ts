import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { AppId } from "@/lib/api";
import { extractErrorMessage } from "@/utils/errorUtils";
import { providerGroupsApi } from "./api";
import { normalizeProviderGroups } from "./model";
import type { ProviderGroupEditMode } from "./model";

interface UseProviderGroupsControllerOptions {
  appId: AppId;
  providers: Readonly<Record<string, unknown>>;
  enabled: boolean;
}

export function useProviderGroupsController({
  appId,
  providers,
  enabled,
}: UseProviderGroupsControllerOptions) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState<ProviderGroupEditMode>(null);
  const [visibleGroupsByApp, setVisibleGroupsByApp] = useState<
    Partial<Record<AppId, string[]>>
  >({});

  const { data } = useQuery({
    queryKey: ["providerGroups", appId],
    queryFn: () => providerGroupsApi.get(appId),
    enabled,
  });
  const providerIds = useMemo(() => Object.keys(providers), [providers]);
  const config = useMemo(
    () => normalizeProviderGroups(data, providerIds),
    [data, providerIds],
  );
  const visibleGroupIds = useMemo(() => {
    const selected = visibleGroupsByApp[appId];
    if (!selected) return null;
    const knownGroupIds = new Set(config.groups.map((group) => group.id));
    const valid = selected.filter((groupId) => knownGroupIds.has(groupId));
    return valid.length > 0 ? valid : null;
  }, [appId, config.groups, visibleGroupsByApp]);

  const setVisibleGroupIds = useCallback(
    (groupIds: string[] | null) => {
      setVisibleGroupsByApp((current) => {
        if (groupIds === null) {
          const next = { ...current };
          delete next[appId];
          return next;
        }
        return { ...current, [appId]: groupIds };
      });
    },
    [appId],
  );

  const refreshCurrent = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: ["providerGroups", appId],
      }),
    [appId, queryClient],
  );

  const afterProviderIdChanged = useCallback(
    async (oldId?: string, newId?: string) => {
      if (!oldId || !newId || oldId === newId) return;
      try {
        await providerGroupsApi.replaceProviderId(appId, oldId, newId);
        await refreshCurrent();
      } catch (error) {
        console.error(
          "[ProviderGroups] Failed to preserve group after provider ID update",
          error,
        );
        toast.error(
          t("providerGroups.idUpdateFailed", {
            defaultValue: "供应商已更新，但分组关系维护失败：{{error}}",
            error: extractErrorMessage(error),
          }),
        );
      }
    },
    [appId, refreshCurrent, t],
  );

  const afterProviderDeleted = useCallback(
    async (providerId: string) => {
      try {
        await providerGroupsApi.removeProvider(appId, providerId);
        await refreshCurrent();
      } catch (error) {
        console.error(
          "[ProviderGroups] Failed to remove deleted provider from groups",
          error,
        );
      }
    },
    [appId, refreshCurrent],
  );

  const refreshAll = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["providerGroups"] }),
    [queryClient],
  );

  const displayMode =
    editMode === "groups"
      ? ("group-edit" as const)
      : editMode === "sort"
        ? ("sort" as const)
        : ("groups" as const);

  return {
    toolbarProps: {
      groups: config.groups,
      selectedGroupIds: visibleGroupIds,
      onGroupSelectionChange: setVisibleGroupIds,
      editMode,
      onEditModeChange: setEditMode,
    },
    listProps: {
      displayMode,
      visibleGroupIds,
      onVisibleGroupIdsChange: setVisibleGroupIds,
    },
    afterProviderAdded: refreshCurrent,
    afterProviderIdChanged,
    afterProviderDeleted,
    afterProvidersImported: refreshAll,
  };
}
