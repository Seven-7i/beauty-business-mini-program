# Issue tracker：GitHub

本仓库的需求、任务和 PRD 统一存放在 GitHub Issues。所有操作优先使用 GitHub CLI（`gh`）完成。

## 基本约定

- 创建 Issue：`gh issue create --title "..." --body "..."`
- 查看 Issue：`gh issue view <编号> --comments`
- 列出 Issue：`gh issue list --state open`
- 添加评论：`gh issue comment <编号> --body "..."`
- 添加或移除标签：`gh issue edit <编号> --add-label "..."` 或 `--remove-label "..."`
- 关闭 Issue：`gh issue close <编号> --comment "..."`

仓库地址应从 `git remote -v` 获取；在正确配置远程仓库后，`gh` 会自动识别当前仓库。

## Pull Request 是否参与分诊

**PR 作为需求入口：否。**

外部 PR 默认不进入与 Issue 相同的需求分诊流程。如果以后需要，可将上面的配置改为“是”。

## 技能操作规则

当技能要求“发布到 Issue tracker”时，创建一个 GitHub Issue。

当技能要求“获取相关任务”时，使用 `gh issue view <编号> --comments`，并同时读取标签信息。

## Wayfinder 约定

- Map：使用一个带有 `wayfinder:map` 标签的 GitHub Issue，正文保存备注、已有决策和待探索内容。
- 子任务：优先使用 GitHub Sub-issues；不可用时，在 Map 的任务列表中链接子 Issue，并在子 Issue 顶部写明 `Part of #<Map编号>`。
- 类型标签：使用 `wayfinder:research`、`wayfinder:prototype`、`wayfinder:grilling` 或 `wayfinder:task`。
- 阻塞关系：优先使用 GitHub 原生 Issue dependencies；不可用时，在 Issue 顶部使用 `Blocked by: #<编号>`。
- 认领：使用 `gh issue edit <编号> --add-assignee @me`。
- 完成：先把答案写入评论，再关闭 Issue，最后把摘要和链接补充到 Map 的已有决策中。
