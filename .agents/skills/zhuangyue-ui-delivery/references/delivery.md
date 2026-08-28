# 交付流程

## 验证

按风险从紧到宽执行。最终交付必须通过以下命令，除非对应脚本不存在或用户明确缩小验证范围：

```powershell
cd app
npm run type-check
npm run test
npm run build:mp-weixin
```

构建后从仓库根目录确认微信产物没有位图文件或引用：

```powershell
rg -n "data:image|url\([^)]*\.(png|jpe?g|webp)" app/dist/build/mp-weixin -g "*.wxss" -g "*.wxml" -g "*.js"
rg --files app/dist/build/mp-weixin | rg "\.(png|jpe?g|webp|gif|bmp)$"
```

以上两条扫描没有匹配时，`rg` 会返回非零退出码，这代表检查通过；只有出现匹配内容才算失败。

运行 `git diff --check`。测试因 Windows 沙箱父目录权限失败时，用同一条、最小范围命令申请提升权限后重试，不把权限失败误报成代码失败。

## 真机自动预览

使用微信开发者工具 CLI 的 `auto_preview`，默认参数：

- CLI：`D:\zhangshuang\software\微信web开发者工具\wechatide.cmd`
- client：`codex`
- project：`C:/Users/admin/Desktop/1/r/app/dist/build/mp-weixin`
- page-path：从 `app/src/pages.json` 查找本轮最相关页面；启动流程问题使用 `pages/index/index`

非启动流程找不到目标路由时，视为实现尚未完成，不用 `pages/index/index` 替代目标页预览。

先构建，再推送。`auto_preview` 返回 `success: true` 才算推送完成；失败时保留构建结果并报告真实错误。成功不等于真机视觉已获用户验收，也不等于上传体验版或发布正式版。

代码通过检查后按授权自动提交和 Git 推送，不等待第二次真机视觉确认；最终将视觉状态写为“已推送，待用户真机反馈”。

## 分批提交与推送

1. 审查 `git status`、全部 diff 和未跟踪文件，确认没有密钥、生成垃圾或与本轮无关的用户改动。
2. 以可独立理解的逻辑批次提交，例如代码与回归测试、设计/需求文档、项目工作流；避免为了数量机械拆分。
3. 提交信息使用简洁 Conventional Commit，例如 `fix(backup): 避免启动确认框重复弹出`。
4. 每批只暂存对应路径；提交后复查剩余状态。
5. 将当前分支普通推送到其远端。拒绝 force-push、历史重写或删除分支。
6. 最终报告 commit hash、提交范围、推送结果和仍未提交的文件。
