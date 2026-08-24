import { Check, Layers3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { ProviderGroup } from "./model";

interface ProviderGroupSelectorProps {
  groups: ProviderGroup[];
  selectedGroupIds: string[] | null;
  onChange: (groupIds: string[] | null) => void;
}

export function ProviderGroupSelector({
  groups,
  selectedGroupIds,
  onChange,
}: ProviderGroupSelectorProps) {
  const { t } = useTranslation();
  const allSelected = selectedGroupIds === null;
  const selected = new Set(selectedGroupIds ?? groups.map((group) => group.id));

  const toggleGroup = (groupId: string) => {
    if (allSelected) {
      onChange([groupId]);
      return;
    }
    const next = new Set(selected);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    if (next.size === 0) return;
    onChange(next.size === groups.length ? null : Array.from(next));
  };

  return (
    <div
      className="flex min-w-0 max-w-[min(36vw,36rem)] items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label={t("providerGroups.displayGroups", {
        defaultValue: "显示分组",
      })}
    >
      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <Layers3 className="h-4 w-4" />
        <span>
          {t("providerGroups.displayGroups", { defaultValue: "显示分组" })}
        </span>
      </div>
      <Button
        type="button"
        variant={allSelected ? "default" : "outline"}
        size="sm"
        className="h-7 shrink-0 rounded-full px-3 text-xs"
        aria-pressed={allSelected}
        onClick={() => onChange(null)}
      >
        {allSelected && <Check className="mr-1 h-3 w-3" />}
        {t("providerGroups.all", { defaultValue: "全部" })}
      </Button>
      {groups.map((group) => {
        const isSelected = !allSelected && selected.has(group.id);
        return (
          <Button
            key={group.id}
            type="button"
            variant={isSelected ? "default" : "outline"}
            size="sm"
            className="h-7 max-w-40 shrink-0 rounded-full px-3 text-xs"
            aria-pressed={isSelected}
            onClick={() => toggleGroup(group.id)}
            title={group.name}
          >
            {isSelected && <Check className="mr-1 h-3 w-3" />}
            <span className="truncate">{group.name}</span>
            <span className="ml-1.5 opacity-60">
              {group.providerIds.length}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
