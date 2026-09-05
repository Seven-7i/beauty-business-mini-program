import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { filterBeautyProjects } from "./composables/useBeautyProjectManagement";

/** 读取服务项目界面源文件，用于锁定已确认图稿的稳定结构。 */
function readSource(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("服务项目确认稿界面契约", () => {
  it("列表默认只展示启用项目并在停用范围内继续支持名称搜索", () => {
    const projects = [
      { id: "active-a", name: "深层补水", status: "active" as const },
      { id: "active-b", name: "基础清洁", status: "active" as const },
      { id: "inactive", name: "停用补水", status: "inactive" as const },
    ];

    expect(filterBeautyProjects(projects, "", false).map(({ id }) => id)).toEqual([
      "active-a",
      "active-b",
    ]);
    expect(filterBeautyProjects(projects, "补水", true).map(({ id }) => id)).toEqual([
      "inactive",
    ]);
  });

  it("列表实现搜索、新增、仅看停用和整卡详情入口", () => {
    const management = readSource("./components/BeautyProjectManagement.vue");
    const list = readSource("./components/BeautyProjectList.vue");
    const card = readSource("./components/BeautyProjectCard.vue");

    expect(management).not.toContain("<BeautyProjectForm");
    expect(management).toContain("openBeautyProjectEditor");
    expect(management).toContain("openBeautyProjectDetail");
    expect(management).toContain('v-show="hasLoaded && !loading"');
    expect(list).toContain("搜索项目名称");
    expect(list).toContain("仅看停用");
    expect(list).toContain('<u-icon name="search"');
    expect(list).toContain('<u-icon name="search" color="#777078" size="20" />');
    expect(list).toContain('<u-icon name="plus"');
    expect(list).toMatch(/<u-icon name="plus" color="#FFFFFF" size="14" \/>/);
    expect(list).not.toContain('@edit="');
    expect(list).not.toContain('@delete="');
    expect(card).toContain("默认用量");
    expect(card).toContain("未设置默认物品用量");
    expect(card).toContain("project-card__name--inactive");
    expect(card).toContain("text-decoration: line-through");
    expect(card).toContain('name="arrow-right"');
    expect(card).toContain('name="arrow-right" color="#837B82" size="16"');
    expect(card).toContain("overflow-wrap: anywhere");
    expect(card).toMatch(/min-height:\s*68rpx/);
  });

  it("新增和编辑复用独立表单并保护草稿与异步完成", () => {
    const pages = readSource("../../pages.json");
    const route = readSource("../../pages/beauty-project-create/index.vue");
    const editor = readSource("./components/BeautyProjectEditor.vue");
    const form = readSource("./components/BeautyProjectForm.vue");
    const lifecycle = readSource(
      "./composables/useBeautyProjectFormLifecycle.ts",
    );

    expect(pages).toContain('"path": "pages/beauty-project-create/index"');
    expect(pages).toContain('"navigationBarTitleText": "新增服务项目"');
    expect(route).toContain('title: projectId.value ? "编辑服务项目" : "新增服务项目"');
    expect(route).toContain("peekQuickAddedInventoryItem");
    expect(route).toContain("refreshAndSelectInventoryItem");
    expect(editor).toContain("<BeautyProjectForm");
    expect(editor).toContain("useBeautyProjectFormLifecycle");
    expect(editor).toContain("if (!completionGuard.isActive())");
    expect(editor).toContain('@dirty-change="updateDirty"');
    expect(editor).toContain('v-if="!hasLoaded && (loading || !errorMessage)"');
    expect(form).toContain("项目名称");
    expect(form).toContain("标准价格");
    expect(form).toContain("预计服务时长");
    expect(form).toContain("默认物品用量");
    expect(form).toContain("新增库存物品");
    expect(form).toContain('<u-icon name="plus" color="#6340B0" size="12" />');
    expect(form).toContain('<u-icon name="arrow-down" color="#8B8490" size="14" />');
    expect(form).toContain("保存项目");
    expect(form).toContain("保存修改");
    expect(form).toContain('role="radiogroup"');
    expect(form.match(/role="radio"/g)).toHaveLength(1);
    expect(form).toContain('role="button"');
    expect(form).toContain(':aria-disabled="submitting"');
    expect(form).not.toContain('<button class="project-editor__submit"');
    expect(form).toContain("() => props.editingProject?.id");
    expect(form).not.toContain("watch(() => props.editingProject, loadProject");
    expect(lifecycle).toContain("放弃本次编辑？");
    expect(lifecycle).toContain("服务项目正在保存，离开后仍会完成保存。");
  });

  it("详情按概览、默认用量和低频操作分层且不引入无意义 Tab", () => {
    const pages = readSource("../../pages.json");
    const route = readSource("../../pages/beauty-project-detail/index.vue");
    const page = readSource("./components/BeautyProjectDetailPage.vue");
    const detail = readSource("./components/BeautyProjectDetail.vue");
    const summary = readSource("./components/BeautyProjectSummary.vue");
    const usages = readSource("./components/BeautyProjectUsageList.vue");
    const actions = readSource("./components/BeautyProjectActions.vue");

    expect(pages).toContain('"path": "pages/beauty-project-detail/index"');
    expect(pages).toContain('"navigationBarTitleText": "项目详情"');
    expect(route).toContain("readBeautyProjectId(query)");
    expect(route).toContain("onShow(refreshDetail)");
    expect(route).toContain("openBeautyProjectEditor(projectId)");
    expect(page).toContain("RecoverableErrorNotice");
    expect(page).toContain(":retryable=\"errorKind === 'read'\"");
    expect(page).toContain("setProjectStatus");
    expect(page).toContain("deleteProject");
    expect(page).toContain('v-if="!hasLoaded && (loading || !errorMessage)"');
    expect(page).toContain("确认框打开失败");
    expect(detail).toContain("<BeautyProjectSummary");
    expect(detail).toContain("<BeautyProjectUsageList");
    expect(detail).toContain("<BeautyProjectActions");
    expect(detail).not.toContain("role=\"tablist\"");
    expect(summary).toContain("标准价格");
    expect(summary).toContain("预计服务时长");
    expect(summary).toContain("编辑资料");
    expect(usages).toContain("创建预约时自动带出，实际用量可调整");
    expect(usages).toContain("未设置默认物品用量");
    expect(actions).toContain("停用项目");
    expect(actions).toContain("重新启用");
    expect(actions).toContain("彻底删除");
    expect(actions).toContain('name="trash"');
    expect(actions).toContain('name="trash" color="#D92E56" size="20"');
    expect(actions).toContain('name="arrow-right" color="#817A80" size="16"');
    expect(actions).toMatch(/min-height:\s*88rpx/);
  });
});
