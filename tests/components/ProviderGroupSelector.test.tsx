import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderGroupSelector } from "@/features/provider-groups/ProviderGroupSelector";
import type { ProviderGroup } from "@/features/provider-groups/model";

const groups: ProviderGroup[] = [
  { id: "default", name: "默认分组", order: 0, providerIds: ["a"] },
  { id: "one", name: "分组一", order: 1, providerIds: ["b"] },
  { id: "two", name: "分组二", order: 2, providerIds: ["c"] },
];

describe("ProviderGroupSelector", () => {
  it("supports all, single, and multiple group selection", () => {
    const onChange = vi.fn();
    const view = render(
      <ProviderGroupSelector
        groups={groups}
        selectedGroupIds={null}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTitle("默认分组"));
    expect(onChange).toHaveBeenLastCalledWith(["default"]);

    onChange.mockClear();
    view.rerender(
      <ProviderGroupSelector
        groups={groups}
        selectedGroupIds={["default"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getAllByTitle("分组一")[0]);
    expect(onChange).toHaveBeenLastCalledWith(["default", "one"]);

    onChange.mockClear();
    view.rerender(
      <ProviderGroupSelector
        groups={groups}
        selectedGroupIds={["default", "one"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "全部" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
