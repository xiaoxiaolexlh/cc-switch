import { Check, Layers3, ListOrdered, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ProviderGroupSelector } from "./ProviderGroupSelector";
import type { ProviderGroup, ProviderGroupEditMode } from "./model";

export type { ProviderGroupEditMode } from "./model";

interface ProviderGroupsToolbarProps {
  groups: ProviderGroup[];
  selectedGroupIds: string[] | null;
  onGroupSelectionChange: (groupIds: string[] | null) => void;
  editMode: ProviderGroupEditMode;
  onEditModeChange: (mode: ProviderGroupEditMode) => void;
}

export function ProviderGroupsToolbar({
  groups,
  selectedGroupIds,
  onGroupSelectionChange,
  editMode,
  onEditModeChange,
}: ProviderGroupsToolbarProps) {
  const { t } = useTranslation();
  const editLabel = t("providerGroups.edit", {
    defaultValue: "编辑供应商分组",
  });

  return (
    <div className="mx-6 mb-3 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/75 px-3 py-1.5 shadow-sm backdrop-blur-sm">
      <ProviderGroupSelector
        groups={groups}
        selectedGroupIds={selectedGroupIds}
        onChange={onGroupSelectionChange}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            title={editLabel}
            aria-label={editLabel}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEditModeChange("groups")}>
            <Layers3 className="mr-2 h-4 w-4" />
            {t("providerGroups.editGroups", { defaultValue: "编辑分组" })}
            {editMode === "groups" && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEditModeChange("sort")}>
            <ListOrdered className="mr-2 h-4 w-4" />
            {t("providerGroups.editSort", {
              defaultValue: "编辑供应商排序",
            })}
            {editMode === "sort" && <Check className="ml-auto h-4 w-4" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onEditModeChange(null)}>
            {t("providerGroups.done", { defaultValue: "完成" })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
