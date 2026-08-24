import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Provider } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { generateUUID } from "@/utils/uuid";
import {
  DEFAULT_PROVIDER_GROUP_ID,
  createProviderGroup,
  deleteProviderGroup,
  moveProviderToGroup,
  renameProviderGroup,
  reorderProviderGroups,
  type ProviderGroup,
  type ProviderGroupsConfig,
} from "./model";

interface ProviderGroupViewProps {
  providers: Record<string, Provider>;
  visibleProviderIds?: Set<string>;
  config: ProviderGroupsConfig;
  isEditing: boolean;
  visibleGroupIds?: Set<string> | null;
  onVisibleGroupIdsChange?: (groupIds: string[] | null) => void;
  onChange: (config: ProviderGroupsConfig) => void;
  renderProvider: (
    provider: Provider,
    dragHandleProps?: ProviderGroupDragHandleProps,
  ) => ReactNode;
}

export interface ProviderGroupDragHandleProps {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  isDragging: boolean;
}

const groupDndId = (id: string) => `group:${id}`;
const providerDndId = (id: string) => `provider:${id}`;

function parseDndId(
  value: string | number,
): { kind: "group" | "provider"; id: string } | null {
  const text = String(value);
  if (text.startsWith("group:")) return { kind: "group", id: text.slice(6) };
  if (text.startsWith("provider:"))
    return { kind: "provider", id: text.slice(9) };
  return null;
}

function findProviderGroup(
  config: ProviderGroupsConfig,
  providerId: string,
): ProviderGroup | undefined {
  return config.groups.find((group) => group.providerIds.includes(providerId));
}

export function ProviderGroupView({
  providers,
  visibleProviderIds,
  config,
  isEditing,
  visibleGroupIds: selectedVisibleGroupIds,
  onVisibleGroupIdsChange,
  onChange,
  renderProvider,
}: ProviderGroupViewProps) {
  const { t } = useTranslation();
  const [newGroupName, setNewGroupName] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const defaultGroup = config.groups.find(
    (group) => group.id === DEFAULT_PROVIDER_GROUP_ID,
  );
  const customGroups = config.groups.filter(
    (group) => group.id !== DEFAULT_PROVIDER_GROUP_ID,
  );
  const allGroupIds = useMemo(
    () => config.groups.map((group) => group.id),
    [config.groups],
  );
  const visibleGroupIds = useMemo(() => {
    if (
      selectedVisibleGroupIds === undefined ||
      selectedVisibleGroupIds === null
    ) {
      return new Set(allGroupIds);
    }
    return new Set(
      allGroupIds.filter((groupId) => selectedVisibleGroupIds.has(groupId)),
    );
  }, [allGroupIds, selectedVisibleGroupIds]);
  const visibleDefaultGroup = visibleGroupIds.has(DEFAULT_PROVIDER_GROUP_ID)
    ? defaultGroup
    : undefined;
  const visibleCustomGroups = customGroups.filter((group) =>
    visibleGroupIds.has(group.id),
  );

  const visibleCount = useMemo(
    () => visibleProviderIds?.size ?? Object.keys(providers).length,
    [providers, visibleProviderIds],
  );

  const handleCreate = () => {
    const name = newGroupName.trim();
    if (!name) return;
    const groupId = `group-${generateUUID()}`;
    onChange(createProviderGroup(config, name, groupId));
    if (selectedVisibleGroupIds) {
      onVisibleGroupIdsChange?.([...selectedVisibleGroupIds, groupId]);
    }
    setNewGroupName("");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const active = parseDndId(event.active.id);
    const over = event.over ? parseDndId(event.over.id) : null;
    if (!active || !over || event.active.id === event.over?.id) return;
    if (active.kind === "group") {
      const targetGroupId =
        over.kind === "group"
          ? over.id
          : findProviderGroup(config, over.id)?.id;
      if (targetGroupId) {
        onChange(reorderProviderGroups(config, active.id, targetGroupId));
      }
      return;
    }
    if (active.kind !== "provider") return;
    if (over.kind === "group") {
      onChange(moveProviderToGroup(config, active.id, over.id));
      return;
    }
    const targetGroup = findProviderGroup(config, over.id);
    if (!targetGroup) return;
    onChange(
      moveProviderToGroup(
        config,
        active.id,
        targetGroup.id,
        targetGroup.providerIds.indexOf(over.id),
      ),
    );
  };

  const content = (
    <div className="space-y-4">
      {isEditing && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 p-3">
          <Input
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleCreate();
            }}
            placeholder={t("providerGroups.newGroupPlaceholder", {
              defaultValue: "新分组名称",
            })}
            className="h-9 min-w-48 flex-1"
          />
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!newGroupName.trim()}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("providerGroups.addGroup", { defaultValue: "添加分组" })}
          </Button>
          <span className="w-full text-xs text-muted-foreground">
            {t("providerGroups.dragHint", {
              defaultValue:
                "拖动供应商可跨组移动；此处排序不会改变故障转移优先级。",
            })}
          </span>
        </div>
      )}

      {visibleDefaultGroup && (
        <DroppableDefaultGroupPanel
          group={visibleDefaultGroup}
          providers={providers}
          visibleProviderIds={visibleProviderIds}
          isEditing={isEditing}
          isDefault
          renderProvider={renderProvider}
          onRename={() => undefined}
          onDelete={() => undefined}
        />
      )}

      {visibleCustomGroups.length > 0 && (
        <SortableContext
          items={visibleCustomGroups.map((group) => groupDndId(group.id))}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,28rem),1fr))] items-start gap-4">
            {visibleCustomGroups.map((group) => (
              <SortableGroupPanel
                key={group.id}
                group={group}
                providers={providers}
                visibleProviderIds={visibleProviderIds}
                isEditing={isEditing}
                renderProvider={renderProvider}
                onRename={(name) =>
                  onChange(renameProviderGroup(config, group.id, name))
                }
                onDelete={() => onChange(deleteProviderGroup(config, group.id))}
              />
            ))}
          </div>
        </SortableContext>
      )}

      {visibleCount > 0 && customGroups.length === 0 && !isEditing && (
        <p className="text-xs text-muted-foreground">
          {t("providerGroups.createHint", {
            defaultValue: "可从顶部编辑入口创建自定义分组。",
          })}
        </p>
      )}
    </div>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {content}
    </DndContext>
  );
}

interface GroupPanelProps {
  group: ProviderGroup;
  providers: Record<string, Provider>;
  visibleProviderIds?: Set<string>;
  isEditing: boolean;
  isDefault?: boolean;
  renderProvider: (
    provider: Provider,
    dragHandleProps?: ProviderGroupDragHandleProps,
  ) => ReactNode;
  onRename: (name: string) => void;
  onDelete: () => void;
  dragHandle?: {
    attributes: DraggableAttributes;
    listeners?: DraggableSyntheticListeners;
  };
  panelRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  isDragging?: boolean;
  isOver?: boolean;
}

function GroupPanel({
  group,
  providers,
  visibleProviderIds,
  isEditing,
  isDefault = false,
  renderProvider,
  onRename,
  onDelete,
  dragHandle,
  panelRef,
  style,
  isDragging = false,
  isOver = false,
}: GroupPanelProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(group.name);
  useEffect(() => setName(group.name), [group.name]);
  const visibleProviders = group.providerIds
    .filter((id) => !visibleProviderIds || visibleProviderIds.has(id))
    .map((id) => providers[id])
    .filter(Boolean);

  return (
    <section
      ref={panelRef}
      style={style}
      className={cn(
        "rounded-2xl border border-border bg-card/40 p-3",
        isDefault && "w-full",
        isOver && "border-primary bg-primary/5",
        isDragging && "z-20 opacity-80 shadow-xl",
      )}
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        {isEditing && !isDefault && dragHandle && (
          <button
            type="button"
            className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
            aria-label={t("providerGroups.dragGroup", {
              defaultValue: "拖动分组",
            })}
            {...dragHandle.attributes}
            {...dragHandle.listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        {isEditing && !isDefault ? (
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              if (name.trim() && name.trim() !== group.name) onRename(name);
              else setName(group.name);
            }}
            className="h-8 flex-1 font-semibold"
            aria-label={t("providerGroups.groupName", {
              defaultValue: "分组名称",
            })}
          />
        ) : (
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
            {group.name}
          </h2>
        )}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {visibleProviders.length}
        </span>
        {isEditing && !isDefault && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label={t("providerGroups.deleteGroup", {
              defaultValue: "删除分组",
            })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <SortableContext
        items={visibleProviders.map((provider) => providerDndId(provider.id))}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {visibleProviders.map((provider) =>
            isEditing ? (
              <SortableGroupedProvider
                key={provider.id}
                provider={provider}
                renderProvider={renderProvider}
              />
            ) : (
              <div key={provider.id}>{renderProvider(provider)}</div>
            ),
          )}
          {visibleProviders.length === 0 && (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
              {t("providerGroups.emptyGroup", {
                defaultValue: "拖动供应商到此分组",
              })}
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function DroppableDefaultGroupPanel(
  props: Omit<GroupPanelProps, "panelRef" | "isOver">,
) {
  const droppable = useDroppable({
    id: groupDndId(props.group.id),
    disabled: !props.isEditing,
  });
  return (
    <GroupPanel
      {...props}
      panelRef={droppable.setNodeRef}
      isOver={droppable.isOver}
    />
  );
}

function SortableGroupPanel(
  props: Omit<GroupPanelProps, "panelRef" | "style" | "dragHandle">,
) {
  const sortable = useSortable({
    id: groupDndId(props.group.id),
    disabled: !props.isEditing,
  });
  return (
    <GroupPanel
      {...props}
      panelRef={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      isDragging={sortable.isDragging}
      isOver={sortable.isOver}
      dragHandle={{
        attributes: sortable.attributes,
        listeners: sortable.listeners,
      }}
    />
  );
}

function SortableGroupedProvider({
  provider,
  renderProvider,
}: {
  provider: Provider;
  renderProvider: (
    provider: Provider,
    dragHandleProps?: ProviderGroupDragHandleProps,
  ) => ReactNode;
}) {
  const sortable = useSortable({ id: providerDndId(provider.id) });
  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={cn("relative", sortable.isDragging && "z-30 opacity-80")}
    >
      {renderProvider(provider, {
        attributes: sortable.attributes,
        listeners: sortable.listeners,
        isDragging: sortable.isDragging,
      })}
    </div>
  );
}
