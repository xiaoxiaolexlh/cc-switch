import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROVIDER_GROUP_ID,
  createProviderGroup,
  deleteProviderGroup,
  moveProviderToGroup,
  normalizeProviderGroups,
  reorderProviderGroups,
  replaceProviderIdInGroups,
} from "./model";

describe("provider group model", () => {
  it("recovers damaged data and reconciles provider membership", () => {
    expect(
      normalizeProviderGroups({ version: 99 }, ["a", "b"]).groups[0]
        .providerIds,
    ).toEqual(["a", "b"]);
    const result = normalizeProviderGroups(
      {
        version: 1,
        groups: [
          {
            id: "custom",
            name: "Custom",
            order: 1,
            providerIds: ["a", "gone"],
          },
        ],
      },
      ["a", "b"],
    );
    expect(
      result.groups.find((group) => group.id === "custom")?.providerIds,
    ).toEqual(["a"]);
    expect(
      result.groups.find((group) => group.id === DEFAULT_PROVIDER_GROUP_ID)
        ?.providerIds,
    ).toEqual(["b"]);
  });

  it("moves providers without touching provider sort indexes", () => {
    const providers = {
      a: { id: "a", sortIndex: 7 },
      b: { id: "b", sortIndex: 2 },
    };
    const initial = normalizeProviderGroups(
      {
        version: 1,
        groups: [{ id: "default", name: "x", order: 0, providerIds: ["a"] }],
      },
      ["a", "b"],
    );
    const withGroup = createProviderGroup(initial, "Second", "second");
    const moved = moveProviderToGroup(withGroup, "a", "second");
    expect(
      moved.groups.find((group) => group.id === "second")?.providerIds,
    ).toEqual(["a"]);
    expect(providers.a.sortIndex).toBe(7);
    expect(providers.b.sortIndex).toBe(2);
  });

  it("reorders providers in the same group at the drop target", () => {
    const initial = normalizeProviderGroups(
      {
        version: 1,
        groups: [
          { id: "default", name: "x", order: 0, providerIds: ["a", "b", "c"] },
        ],
      },
      ["a", "b", "c"],
    );
    expect(
      moveProviderToGroup(initial, "b", "default", 2).groups[0].providerIds,
    ).toEqual(["a", "c", "b"]);
    expect(
      moveProviderToGroup(initial, "c", "default", 0).groups[0].providerIds,
    ).toEqual(["c", "a", "b"]);
  });

  it("reorders custom groups while keeping the default group first", () => {
    const initial = normalizeProviderGroups(
      {
        version: 1,
        groups: [
          { id: "default", name: "x", order: 0, providerIds: [] },
          { id: "one", name: "One", order: 1, providerIds: [] },
          { id: "two", name: "Two", order: 2, providerIds: [] },
        ],
      },
      [],
    );
    expect(
      reorderProviderGroups(initial, "two", "one").groups.map(
        (group) => group.id,
      ),
    ).toEqual(["default", "two", "one"]);
  });

  it("returns deleted group members to the default group and keeps id changes", () => {
    const initial = normalizeProviderGroups(
      {
        version: 1,
        groups: [
          { id: "default", name: "x", order: 0, providerIds: [] },
          { id: "second", name: "Second", order: 1, providerIds: ["old"] },
        ],
      },
      ["old"],
    );
    const renamed = replaceProviderIdInGroups(initial, "old", "new");
    const deleted = deleteProviderGroup(renamed, "second");
    expect(deleted.groups[0].providerIds).toEqual(["new"]);
  });
});
