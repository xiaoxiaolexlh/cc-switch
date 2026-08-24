# 上游正式版本邮件通知配置

本仓库通过 `.github/workflows/check-upstream-release.yml` 每 6 小时检查一次 `farion1231/cc-switch` 的正式 Release。草稿版和 prerelease 不会触发通知。

## 工作方式

1. 读取 upstream 最新的正式 Release。
2. 从 Repository Variable `LAST_UPSTREAM_RELEASE_TAG` 读取上次已处理版本。
3. 第一次运行时只写入当前版本作为基线，不发送邮件。
4. 检测到不同 tag 时，通过 SMTP 发送邮件。
5. 只有邮件发送成功后才更新 `LAST_UPSTREAM_RELEASE_TAG`。
6. SMTP 失败时保留旧 tag，下一次定时运行继续重试。

工作流使用并发锁，同一时间只允许一个检查任务运行，避免两个任务同时读取旧 tag 后重复发送。

## 默认分支要求

GitHub 的 `schedule` 只会运行默认分支中的工作流。本 fork 保持：

- `main`：官方代码镜像。
- `custom/main`：本地定制、打包和 Actions 运行分支。

因此 GitHub 仓库的默认分支必须设为 `custom/main`。这不会改变本地 `main` 继续作为 upstream 镜像的职责。

可以在 GitHub 仓库的 `Settings -> General -> Default branch` 中修改，也可以使用：

```powershell
gh repo edit xiaoxiaolexlh/cc-switch --default-branch custom/main
```

## 必需的 Actions Secrets

在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions -> Secrets` 中配置：

| Secret                           | 说明                                                |
| -------------------------------- | --------------------------------------------------- |
| `UPSTREAM_RELEASE_SMTP_HOST`     | SMTP 服务器地址                                     |
| `UPSTREAM_RELEASE_SMTP_PORT`     | `465` 使用 SSL；其他端口使用 STARTTLS，通常为 `587` |
| `UPSTREAM_RELEASE_SMTP_USERNAME` | SMTP 登录用户名，通常是发件邮箱                     |
| `UPSTREAM_RELEASE_SMTP_PASSWORD` | SMTP 密码或邮箱服务商生成的应用专用密码             |
| `UPSTREAM_RELEASE_SMTP_FROM`     | 邮件 From 地址，通常与用户名相同                    |
| `UPSTREAM_RELEASE_SMTP_TO`       | 固定收件邮箱                                        |

不要把密码、授权码或邮箱凭据提交到 Git。缺少必需 Secret 时，发送步骤会列出缺少的 Secret 名称，但不会输出任何 Secret 值。

`LAST_UPSTREAM_RELEASE_TAG` 不需要手动创建，第一次成功运行会自动建立。

## 首次启用

确认默认分支和 Secrets 配置完成后，在 GitHub Actions 页面手动运行一次 `Check upstream release`。

也可以使用：

```powershell
gh workflow run check-upstream-release.yml --repo xiaoxiaolexlh/cc-switch --ref custom/main
gh run watch --repo xiaoxiaolexlh/cc-switch
```

第一次运行的预期结果：

- 找到 upstream 当前正式版本。
- 创建 `LAST_UPSTREAM_RELEASE_TAG`。
- 不发送邮件。

可以通过以下命令确认变量已经建立，只会显示变量名称和值中的版本 tag，不涉及 SMTP 密码：

```powershell
gh variable get LAST_UPSTREAM_RELEASE_TAG --repo xiaoxiaolexlh/cc-switch
```

## 验证邮件和失败重试

首次基线不会发送测试邮件。需要验证 SMTP 时，可以暂时把 `LAST_UPSTREAM_RELEASE_TAG` 设置为一个不存在的旧 tag，然后手动运行工作流：

```powershell
gh variable set LAST_UPSTREAM_RELEASE_TAG --repo xiaoxiaolexlh/cc-switch --body test-old-tag
gh workflow run check-upstream-release.yml --repo xiaoxiaolexlh/cc-switch --ref custom/main
gh run watch --repo xiaoxiaolexlh/cc-switch
```

邮件成功后，变量会恢复为 upstream 当前正式 tag。邮件失败时变量仍保持 `test-old-tag`，下次运行会继续重试。

这个验证会真实发送一封邮件，执行前应确认收件地址正确。

## 日常维护

- 定时任务按 UTC 在 `17 */6 * * *` 运行，即每天 UTC 00:17、06:17、12:17、18:17。
- GitHub 可能延迟执行定时任务，不能把它当成精确到分钟的监控系统。
- 公共仓库长时间没有活动时，GitHub 可能自动禁用 scheduled workflow；恢复仓库活动后需要在 Actions 页面重新启用。
- SMTP 服务商修改授权策略或撤销应用密码后，任务会失败，但 tag 不会前移。
- 不自动合并 upstream；收到邮件后仍需按 fork 分支维护文档手动同步。
