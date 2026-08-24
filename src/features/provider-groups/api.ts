import { invoke } from "@tauri-apps/api/core";
import type { AppId } from "@/lib/api/types";
import type { ProviderGroupsConfig } from "./model";

export const providerGroupsApi = {
  get(app: AppId): Promise<ProviderGroupsConfig> {
    return invoke("get_provider_groups", { app });
  },
  save(app: AppId, config: ProviderGroupsConfig): Promise<boolean> {
    return invoke("save_provider_groups", { app, config });
  },
  replaceProviderId(
    app: AppId,
    oldId: string,
    newId: string,
  ): Promise<boolean> {
    return invoke("replace_provider_group_provider_id", { app, oldId, newId });
  },
  removeProvider(app: AppId, providerId: string): Promise<boolean> {
    return invoke("remove_provider_from_groups", { app, providerId });
  },
};
