//! Provider grouping is deliberately stored as one versioned settings value.
//! It does not participate in provider ordering, failover, or provider schema.

use crate::app_config::AppType;
use crate::error::AppError;
use crate::services::ProviderService;
use crate::store::AppState;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::str::FromStr;
use tauri::State;

pub const PROVIDER_GROUPS_VERSION: u32 = 1;
const DEFAULT_GROUP_ID: &str = "default";
const DEFAULT_GROUP_NAME: &str = "默认分组";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderGroup {
    pub id: String,
    pub name: String,
    pub order: usize,
    pub provider_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderGroupsConfig {
    pub version: u32,
    pub groups: Vec<ProviderGroup>,
}

fn default_config(provider_ids: &[String]) -> ProviderGroupsConfig {
    ProviderGroupsConfig {
        version: PROVIDER_GROUPS_VERSION,
        groups: vec![ProviderGroup {
            id: DEFAULT_GROUP_ID.to_string(),
            name: DEFAULT_GROUP_NAME.to_string(),
            order: 0,
            provider_ids: provider_ids.to_vec(),
        }],
    }
}

fn normalize(raw: Option<&str>, provider_ids: &[String]) -> ProviderGroupsConfig {
    let fallback = || default_config(provider_ids);
    let Some(raw) = raw else { return fallback() };
    let Ok(mut config) = serde_json::from_str::<ProviderGroupsConfig>(raw) else {
        return fallback();
    };
    if config.version != PROVIDER_GROUPS_VERSION {
        return fallback();
    }
    let known: HashSet<&str> = provider_ids.iter().map(String::as_str).collect();
    let mut seen = HashSet::new();
    let mut groups = Vec::new();
    for (index, mut group) in config.groups.drain(..).enumerate() {
        group.id = group.id.trim().to_string();
        if group.id.is_empty()
            || groups
                .iter()
                .any(|item: &ProviderGroup| item.id == group.id)
        {
            continue;
        }
        group.name = if group.id == DEFAULT_GROUP_ID {
            DEFAULT_GROUP_NAME.to_string()
        } else if group.name.trim().is_empty() {
            format!("分组 {}", index + 1)
        } else {
            group.name.trim().to_string()
        };
        group
            .provider_ids
            .retain(|id| known.contains(id.as_str()) && seen.insert(id.clone()));
        groups.push(group);
    }
    if !groups.iter().any(|group| group.id == DEFAULT_GROUP_ID) {
        groups.insert(
            0,
            ProviderGroup {
                id: DEFAULT_GROUP_ID.to_string(),
                name: DEFAULT_GROUP_NAME.to_string(),
                order: 0,
                provider_ids: Vec::new(),
            },
        );
    }
    groups.sort_by_key(|group| {
        if group.id == DEFAULT_GROUP_ID {
            (0, 0)
        } else {
            (1, group.order)
        }
    });
    let default_group = groups.first_mut().expect("default group inserted");
    default_group.name = DEFAULT_GROUP_NAME.to_string();
    default_group.provider_ids.extend(
        provider_ids
            .iter()
            .filter(|id| !seen.contains(*id))
            .cloned(),
    );
    for (order, group) in groups.iter_mut().enumerate() {
        group.order = order;
    }
    config.version = PROVIDER_GROUPS_VERSION;
    config.groups = groups;
    config
}

fn key(app: &AppType) -> String {
    format!("provider_groups_v1:{}", app.as_str())
}

fn provider_ids(state: &AppState, app: &AppType) -> Result<Vec<String>, AppError> {
    Ok(ProviderService::list(state, app.clone())?
        .keys()
        .cloned()
        .collect())
}

fn read(state: &AppState, app: &AppType) -> Result<ProviderGroupsConfig, AppError> {
    let ids = provider_ids(state, app)?;
    let raw = state.db.get_setting(&key(app))?;
    let config = normalize(raw.as_deref(), &ids);
    let serialized = serde_json::to_string(&config).map_err(|e| AppError::Config(e.to_string()))?;
    if raw.as_deref() != Some(serialized.as_str()) {
        state.db.set_setting(&key(app), &serialized)?;
    }
    Ok(config)
}

fn write(state: &AppState, app: &AppType, config: &ProviderGroupsConfig) -> Result<(), AppError> {
    let ids = provider_ids(state, app)?;
    let serialized = serde_json::to_string(config).map_err(|e| AppError::Config(e.to_string()))?;
    let normalized = normalize(Some(&serialized), &ids);
    let value = serde_json::to_string(&normalized).map_err(|e| AppError::Config(e.to_string()))?;
    state.db.set_setting(&key(app), &value)
}

#[tauri::command]
pub fn get_provider_groups(
    state: State<'_, AppState>,
    app: String,
) -> Result<ProviderGroupsConfig, String> {
    let app = AppType::from_str(&app).map_err(|e| e.to_string())?;
    read(state.inner(), &app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_provider_groups(
    state: State<'_, AppState>,
    app: String,
    config: ProviderGroupsConfig,
) -> Result<bool, String> {
    let app = AppType::from_str(&app).map_err(|e| e.to_string())?;
    write(state.inner(), &app, &config)
        .map(|_| true)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn replace_provider_group_provider_id(
    state: State<'_, AppState>,
    app: String,
    #[allow(non_snake_case)] oldId: String,
    #[allow(non_snake_case)] newId: String,
) -> Result<bool, String> {
    let app = AppType::from_str(&app).map_err(|e| e.to_string())?;
    let mut ids = provider_ids(state.inner(), &app).map_err(|e| e.to_string())?;
    // The provider update has already committed the new ID. Exclude it while
    // reconciling the old JSON, otherwise it is appended to the default group
    // before the old membership can be replaced.
    ids.retain(|id| id != &newId);
    if !ids.contains(&oldId) {
        ids.push(oldId.clone());
    }
    let raw = state
        .inner()
        .db
        .get_setting(&key(&app))
        .map_err(|e| e.to_string())?;
    let mut config = normalize(raw.as_deref(), &ids);
    for group in &mut config.groups {
        for id in &mut group.provider_ids {
            if *id == oldId {
                *id = newId.clone();
            }
        }
    }
    write(state.inner(), &app, &config)
        .map(|_| true)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_provider_from_groups(
    state: State<'_, AppState>,
    app: String,
    #[allow(non_snake_case)] providerId: String,
) -> Result<bool, String> {
    let app = AppType::from_str(&app).map_err(|e| e.to_string())?;
    let mut config = read(state.inner(), &app).map_err(|e| e.to_string())?;
    for group in &mut config.groups {
        group.provider_ids.retain(|id| id != &providerId);
    }
    write(state.inner(), &app, &config)
        .map(|_| true)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::Database;

    #[test]
    fn damaged_config_falls_back_and_missing_ids_join_default() {
        let result = normalize(Some("{\"version\":99}"), &["a".into(), "b".into()]);
        assert_eq!(result.groups[0].provider_ids, vec!["a", "b"]);
        let result = normalize(
            Some(
                r#"{"version":1,"groups":[{"id":"x","name":"X","order":1,"providerIds":["a","gone"]}]}"#,
            ),
            &["a".into(), "b".into()],
        );
        assert_eq!(result.groups[0].id, DEFAULT_GROUP_ID);
        assert_eq!(result.groups[0].provider_ids, vec!["b"]);
    }

    #[test]
    fn database_backup_and_sync_exports_include_provider_groups() {
        let db = Database::memory().expect("memory database");
        db.set_setting("provider_groups_v1:claude", r#"{"version":1,"groups":[]}"#)
            .expect("store provider groups");

        let backup = db.export_sql_string().expect("export backup");
        let sync = db.export_sql_string_for_sync().expect("export sync");
        assert!(backup.contains("provider_groups_v1:claude"));
        assert!(sync.contains("provider_groups_v1:claude"));
    }

    #[test]
    fn provider_id_replacement_preserves_the_original_group() {
        let mut config = normalize(
            Some(
                r#"{"version":1,"groups":[{"id":"default","name":"默认分组","order":0,"providerIds":[]},{"id":"custom","name":"Custom","order":1,"providerIds":["old"]}]}"#,
            ),
            &["old".to_string()],
        );
        for group in &mut config.groups {
            for id in &mut group.provider_ids {
                if id == "old" {
                    *id = "new".to_string();
                }
            }
        }
        let serialized = serde_json::to_string(&config).expect("serialize groups");
        let result = normalize(Some(&serialized), &["new".to_string()]);
        assert_eq!(
            result
                .groups
                .iter()
                .find(|group| group.id == "custom")
                .expect("custom group")
                .provider_ids,
            vec!["new"]
        );
        assert!(result.groups[0].provider_ids.is_empty());
    }

    #[test]
    fn explicit_group_order_is_restored_with_default_first() {
        let result = normalize(
            Some(
                r#"{"version":1,"groups":[{"id":"two","name":"Two","order":2,"providerIds":[]},{"id":"default","name":"Changed","order":99,"providerIds":[]},{"id":"one","name":"One","order":1,"providerIds":[]}]}"#,
            ),
            &[],
        );
        assert_eq!(
            result
                .groups
                .iter()
                .map(|group| group.id.as_str())
                .collect::<Vec<_>>(),
            vec!["default", "one", "two"]
        );
        assert_eq!(
            result
                .groups
                .iter()
                .map(|group| group.order)
                .collect::<Vec<_>>(),
            vec![0, 1, 2]
        );
        assert_eq!(result.groups[0].name, DEFAULT_GROUP_NAME);
    }
}
