## Agent skills

### Issue tracker

本仓库的需求、任务和 PRD 统一存放在 GitHub Issues。具体规则见 `docs/agents/issue-tracker.md`。

### Triage labels

本仓库使用 mattpocock/skills 默认的五类分诊标签。标签映射及含义见 `docs/agents/triage-labels.md`。

### Domain docs

本仓库采用单上下文结构，领域词汇位于根目录 `CONTEXT.md`，架构决策位于 `docs/adr/`。使用规则见 `docs/agents/domain.md`。

### UI delivery

设计或修改页面、维护 `ui图`、同步 UI 文档、进行微信真机预览或交付界面代码时，必须读取并使用项目技能 `.agents/skills/zhuangyue-ui-delivery/SKILL.md`。

### Delivery authorization

完成本仓库内用户请求并通过合理检查后，可以把相关改动按逻辑批次创建普通 Git commit 并推送当前分支，无需逐次请求确认。提交前审查 status、diff 和未跟踪文件；排除无关改动。该授权不包含 force-push、历史重写、删除分支或发布体验版/正式版。
