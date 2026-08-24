# Fork 分支与 upstream 同步维护说明

本文用于维护包含本地定制功能的 CC Switch fork。目标是让官方代码可以持续同步，同时让供应商分组、版本通知等本地功能保持独立，降低后续合并冲突。

本文假设：

- `upstream` 指官方仓库 `farion1231/cc-switch`。
- `origin` 指自己的 fork，例如 `xiaoxiaolexlh/cc-switch`。
- 官方分支名为 `main`。
- 本地集成分支名为 `custom/main`。

如果实际仓库名称不同，只替换远程地址，不要改变分支职责。

## 分支职责

```text
upstream/main
      │
      │ 只做 fast-forward 同步
      ▼
main                         官方代码镜像，不放本地定制
      │
      │ 合并官方更新
      ▼
custom/main                  本地定制集成、测试和打包分支
      ▲
      │ cherry-pick 单个交付提交
      │
feature/provider-groups      某项功能的开发分支
feature/*-squash             临时交付分支，通常只保留一个提交
```

分支规则：

| 分支                     | 用途                         | 是否允许直接开发     |
| ------------------------ | ---------------------------- | -------------------- |
| `main`                   | 官方仓库的本地镜像           | 否                   |
| `custom/main`            | 实际测试、打包和发布         | 否，使用交付提交合入 |
| `feature/<topic>`        | 功能开发，可保留多个过程提交 | 是                   |
| `feature/<topic>-squash` | 将功能整理成单个交付提交     | 否，仅临时使用       |

不要把本地定制直接提交到 `main`。不要把 `custom/main` 反向合并回 `main`。

## 首次配置远程

先确认当前工作区没有未保存的修改：

```powershell
git status --short --branch
git remote -v
```

如果还没有官方远程，添加它：

```powershell
git remote add upstream https://github.com/farion1231/cc-switch.git
git fetch upstream
```

`origin` 仍然用于推送自己的 fork；`upstream` 只用于读取官方更新。建议保留 `main` 对 `origin/main` 的跟踪关系，并在同步和推送时显式写出远程，避免误推到官方仓库：

```powershell
git push origin main
```

如果当前工作区已有未提交功能，不要直接执行切换、拉取或历史改写。先创建功能分支并提交，或者使用临时补丁保存修改。

## 当前功能的首次落地

如果工作区中的修改就是一个完整功能，例如供应商分组：

```powershell
git switch -c feature/provider-groups
git add src/features/provider-groups
git add src-tauri/src/provider_groups
git add src-tauri/src/lib.rs
git add src/App.tsx
git add src/components/providers/ProviderList.tsx
git add tests/components/ProviderList.test.tsx
git add tests/components/ProviderGroupSelector.test.tsx
git add tests/integration/App.test.tsx
git add tests/msw/handlers.ts
git commit -m "feat: add independent provider grouping"
```

上游版本通知工作流应单独提交，便于以后单独启用、停用或替换：

```powershell
git switch -c feature/upstream-release-notifier main
git add .github/workflows/check-upstream-release.yml
git add tests/workflows
git commit -m "ci: notify on upstream releases"
```

如果这些功能已经在同一个功能分支中，不要为了套用示例而重写历史；只需在交付前按功能边界整理提交即可。

## 日常开发

新的本地功能从最新的 `custom/main` 创建：

```powershell
git switch custom/main
git status --short
git switch -c feature/<topic>
```

开发期间可以保留多个有意义的提交：

```powershell
git add <相关文件>
git commit -m "feat: <具体变更>"
```

每个功能分支只处理一个主题。不要把 upstream 同步、无关格式化和功能实现混在同一个交付提交中。

## 交付到 custom/main

功能准备合入时，先确认工作区干净，并记录功能分支从哪里分叉：

```powershell
git switch feature/<topic>
git status --short
git merge-base feature/<topic> custom/main
git log --oneline --decorate --graph -20 feature/<topic>
```

创建临时 squash 分支。下面的 `<base-commit>` 必须是功能分支实际分叉的提交：

```powershell
git switch -c feature/<topic>-squash feature/<topic>
git status --short
git reset --soft <base-commit>
git commit -m "feat: <交付摘要>"
```

原始 `feature/<topic>` 不会被改写；`feature/<topic>-squash` 会产生一个干净的交付提交。然后更新集成分支并 cherry-pick：

```powershell
git switch custom/main
git status --short
git cherry-pick <delivery-commit>
git push origin custom/main
```

若 cherry-pick 产生冲突，暂停操作，不要自动覆盖 upstream 的修改：

```powershell
git status

# 手动编辑冲突文件后
git add <已解决文件>
git cherry-pick --continue
```

如果决定取消本次交付：

```powershell
git cherry-pick --abort
```

## 同步官方 upstream

先只更新官方镜像分支：

```powershell
git fetch upstream
git switch main
git status --short
git merge --ff-only upstream/main
git push origin main
```

`--ff-only` 失败时，说明 `main` 已经出现本地提交或历史分叉。不要使用 `reset --hard`；先查看：

```powershell
git log --oneline --decorate --graph --all -30
git diff upstream/main...main
```

官方更新进入本地集成分支：

```powershell
git switch custom/main
git status --short
git merge main
```

解决冲突后运行完整检查，再推送：

```powershell
git add <已解决文件>
git commit
pnpm typecheck
pnpm test:unit
pnpm format:check
git push origin custom/main
```

不要把 `custom/main` 合并回 `main`，否则官方镜像会重新混入本地定制。

## 本项目的预期冲突边界

分组功能的实现文件应继续保持在新增目录中：

- `src/features/provider-groups/`
- `src-tauri/src/provider_groups/`
- `tests/workflows/`
- `.github/workflows/check-upstream-release.yml`

正常同步 upstream 时，主要需要检查以下接线文件：

- `src/App.tsx`：分组控制器、工具栏和列表的少量接线。
- `src/components/providers/ProviderList.tsx`：可选的分组视图分支。
- `src-tauri/src/lib.rs`：分组模块声明和命令注册。

这些文件发生冲突时，保留官方新增的供应商业务逻辑，同时保留分组功能的独立调用边界。不要把分组逻辑复制到供应商切换、故障转移或 `sortIndex` 代码中。

## 测试与打包

在 `custom/main` 或交付前的功能分支运行：

```powershell
pnpm typecheck
pnpm test:unit
pnpm format:check
git diff --check
```

修改 Rust 后再运行：

```powershell
cd src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test
cd ..
```

Windows 正式打包：

```powershell
pnpm build
```

如果 `cc-switch.exe` 正在运行，先关闭当前仓库构建出的那个进程，否则 Rust 链接或 Tauri bundler 可能遇到文件占用。`pnpm build` 可能已经生成 MSI/NSIS 安装包，但在 updater 私钥未配置时，最后的签名步骤会失败；这不等同于安装包本体生成失败。发布更新包前必须另外配置 `TAURI_SIGNING_PRIVATE_KEY`，且不能把私钥写入仓库或文档。

## 版本标签

只从 `custom/main` 打标签：

```powershell
git switch custom/main
git status --short
git tag -a v3.20.0-custom.1 -m "CC Switch custom build v3.20.0-custom.1"
git push origin custom/main --tags
```

官方版本和本地定制版本使用不同的标签后缀，例如：

- 官方：`v3.20.0`
- 本地定制：`v3.20.0-custom.1`
- 同一版本的修订包：`v3.20.0-custom.2`

## 安全和历史操作规则

- 在 `pull`、`merge`、`cherry-pick`、`reset --soft` 前确认 `git status`。
- 不使用 `git reset --hard`、`git clean` 或宽范围删除命令清理工作区。
- 不在 `main` 上 force-push。
- 不把密钥、SMTP 密码、签名私钥写入 Git、Actions 日志或文档。
- 同步 upstream 时优先使用 `git merge --ff-only` 更新 `main`。
- 需要历史压缩时只改写临时 `-squash` 分支，保留原始功能分支不变。

为提高重复冲突处理的稳定性，可以在本机启用：

```powershell
git config rerere.enabled true
git config merge.conflictStyle zdiff3
```

本文只描述本地 fork 的维护流程；如果要向官方仓库提交 Pull Request，仍需遵循仓库根目录 `CONTRIBUTING.md` 的要求。

上游正式 Release 邮件通知的默认分支、SMTP Secrets 和首次基线配置见 [上游正式版本邮件通知配置](./upstream-release-notification-zh.md)。
