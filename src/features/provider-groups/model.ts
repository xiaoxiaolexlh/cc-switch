export const PROVIDER_GROUPS_VERSION = 1;
export const DEFAULT_PROVIDER_GROUP_ID = "default";

export interface ProviderGroup {
  id: string;
  name: string;
  order: number;
  providerIds: string[];
}

export interface ProviderGroupsConfig {
  version: typeof PROVIDER_GROUPS_VERSION;
  groups: ProviderGroup[];
}

export interface ProviderGroupDraft {
  id?: string;
  name: string;
}

export type ProviderGroupEditMode = "groups" | "sort" | null;

const DEFAULT_GROUP_NAME = "默认分组";

export function defaultProviderGroups(
  providerIds: string[],
): ProviderGroupsConfig {
  return {
    version: PROVIDER_GROUPS_VERSION,
    groups: [
      {
        id: DEFAULT_PROVIDER_GROUP_ID,
        name: DEFAULT_GROUP_NAME,
        order: 0,
        providerIds: [...providerIds],
      },
    ],
  };
}

function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      ),
    ),
  );
}

export function normalizeProviderGroups(
  raw: unknown,
  providerIds: string[],
): ProviderGroupsConfig {
  const fallback = defaultProviderGroups(providerIds);
  if (!raw || typeof raw !== "object") return fallback;
  const value = raw as { version?: unknown; groups?: unknown };
  if (
    value.version !== PROVIDER_GROUPS_VERSION ||
    !Array.isArray(value.groups)
  ) {
    return fallback;
  }

  const known = new Set(providerIds);
  const seenProviders = new Set<string>();
  const groups: ProviderGroup[] = [];
  for (const [index, item] of value.groups.entries()) {
    if (!item || typeof item !== "object") continue;
    const group = item as Record<string, unknown>;
    const id = typeof group.id === "string" ? group.id.trim() : "";
    if (!id || groups.some((existing) => existing.id === id)) continue;
    const isDefault = id === DEFAULT_PROVIDER_GROUP_ID;
    const name = isDefault
      ? DEFAULT_GROUP_NAME
      : typeof group.name === "string" && group.name.trim()
        ? group.name.trim()
        : `分组 ${groups.length}`;
    const order =
      typeof group.order === "number" && Number.isFinite(group.order)
        ? group.order
        : index;
    const ids = uniqueStrings(group.providerIds).filter((providerId) => {
      if (!known.has(providerId) || seenProviders.has(providerId)) return false;
      seenProviders.add(providerId);
      return true;
    });
    groups.push({ id, name, order, providerIds: ids });
  }

  let defaultGroup = groups.find(
    (group) => group.id === DEFAULT_PROVIDER_GROUP_ID,
  );
  if (!defaultGroup) {
    defaultGroup = {
      id: DEFAULT_PROVIDER_GROUP_ID,
      name: DEFAULT_GROUP_NAME,
      order: 0,
      providerIds: [],
    };
    groups.unshift(defaultGroup);
  } else {
    defaultGroup.name = DEFAULT_GROUP_NAME;
  }

  defaultGroup.providerIds.push(
    ...providerIds.filter((id) => !seenProviders.has(id)),
  );
  groups.sort((a, b) => {
    if (a.id === DEFAULT_PROVIDER_GROUP_ID) return -1;
    if (b.id === DEFAULT_PROVIDER_GROUP_ID) return 1;
    return a.order - b.order;
  });
  return {
    version: PROVIDER_GROUPS_VERSION,
    groups: groups.map((group, index) => ({ ...group, order: index })),
  };
}

export function moveProviderToGroup(
  config: ProviderGroupsConfig,
  providerId: string,
  targetGroupId: string,
  targetIndex?: number,
): ProviderGroupsConfig {
  const groups = config.groups.map((group) => ({
    ...group,
    providerIds: [...group.providerIds],
  }));
  const source = groups.find((group) => group.providerIds.includes(providerId));
  const target = groups.find((group) => group.id === targetGroupId);
  if (!target) return config;
  source?.providerIds.splice(source.providerIds.indexOf(providerId), 1);
  const index =
    targetIndex === undefined
      ? target.providerIds.length
      : Math.max(0, Math.min(targetIndex, target.providerIds.length));
  target.providerIds.splice(index, 0, providerId);
  return { ...config, groups };
}

export function reorderProviderGroups(
  config: ProviderGroupsConfig,
  activeId: string,
  overId: string,
): ProviderGroupsConfig {
  const groups = [...config.groups];
  const from = groups.findIndex((group) => group.id === activeId);
  const to = groups.findIndex((group) => group.id === overId);
  if (
    from < 0 ||
    to < 0 ||
    from === to ||
    activeId === DEFAULT_PROVIDER_GROUP_ID ||
    overId === DEFAULT_PROVIDER_GROUP_ID
  )
    return config;
  const [group] = groups.splice(from, 1);
  groups.splice(to, 0, group);
  return {
    ...config,
    groups: groups.map((item, order) => ({ ...item, order })),
  };
}

export function createProviderGroup(
  config: ProviderGroupsConfig,
  name: string,
  id: string,
): ProviderGroupsConfig {
  const cleanName = name.trim();
  const cleanId = id.trim();
  if (
    !cleanName ||
    !cleanId ||
    config.groups.some((group) => group.id === cleanId)
  )
    return config;
  return {
    ...config,
    groups: [
      ...config.groups,
      {
        id: cleanId,
        name: cleanName,
        order: config.groups.length,
        providerIds: [],
      },
    ],
  };
}

export function renameProviderGroup(
  config: ProviderGroupsConfig,
  id: string,
  name: string,
): ProviderGroupsConfig {
  const cleanName = name.trim();
  if (!cleanName || id === DEFAULT_PROVIDER_GROUP_ID) return config;
  return {
    ...config,
    groups: config.groups.map((group) =>
      group.id === id ? { ...group, name: cleanName } : group,
    ),
  };
}

export function deleteProviderGroup(
  config: ProviderGroupsConfig,
  id: string,
): ProviderGroupsConfig {
  if (id === DEFAULT_PROVIDER_GROUP_ID) return config;
  const removed = config.groups.find((group) => group.id === id);
  if (!removed) return config;
  const groups = config.groups
    .filter((group) => group.id !== id)
    .map((group) => ({ ...group, providerIds: [...group.providerIds] }));
  groups
    .find((group) => group.id === DEFAULT_PROVIDER_GROUP_ID)
    ?.providerIds.push(...removed.providerIds);
  return {
    ...config,
    groups: groups.map((group, order) => ({ ...group, order })),
  };
}

export function replaceProviderIdInGroups(
  config: ProviderGroupsConfig,
  oldId: string,
  newId: string,
): ProviderGroupsConfig {
  if (!oldId || !newId || oldId === newId) return config;
  return {
    ...config,
    groups: config.groups.map((group) => ({
      ...group,
      providerIds: group.providerIds.map((id) => (id === oldId ? newId : id)),
    })),
  };
}

export function removeProviderFromGroups(
  config: ProviderGroupsConfig,
  providerId: string,
): ProviderGroupsConfig {
  return {
    ...config,
    groups: config.groups.map((group) => ({
      ...group,
      providerIds: group.providerIds.filter((id) => id !== providerId),
    })),
  };
}
