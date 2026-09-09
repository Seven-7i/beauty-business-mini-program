import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 读取预约页面源代码，锁定已确认的跨页面交互契约。 */
function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("预约执行定稿契约", () => {
  it("注册列表、新增和详情三条独立路由", () => {
    const pages = readSource("../../pages.json");

    expect(pages).toContain('"path": "pages/appointment/index"');
    expect(pages).toContain('"path": "pages/appointment-create/index"');
    expect(pages).toContain('"path": "pages/appointment-detail/index"');
  });

  it("统一新增页默认正常预约，后补默认已完成且没有待执行选项", () => {
    const form = readSource("./components/AppointmentForm.vue");

    expect(form).toContain('entryMode: "scheduled"');
    expect(form).toContain('backfilledOutcome: "completed"');
    expect(form).toContain("正常预约");
    expect(form).toContain("后补预约");
    expect(form).toContain("已完成");
    expect(form).toContain("未完成");
    expect(form).not.toContain('backfilledOutcome: "pending"');
  });

  it("预约类型和完成情况使用无原生按钮内层的语义分段控件", () => {
    const form = readSource("./components/AppointmentForm.vue");
    const selectorSection = form.slice(
      form.indexOf('<view class="segmented-control" role="tablist"'),
      form.indexOf('<view class="form-card">', form.indexOf("完成情况")),
    );

    expect(form.match(/role="tablist"/g)).toHaveLength(2);
    expect(form.match(/role="tab"/g)).toHaveLength(4);
    expect(form).toContain("segmented-control__item--active");
    expect(form).toContain(
      `v-if="form.entryMode === 'scheduled'" name="checkmark-circle-fill"`,
    );
    expect(selectorSection).not.toContain("<button");
  });

  it("正常保存不提交实际用量，后补完成才提交实际用量", () => {
    const form = readSource("./components/AppointmentForm.vue");
    const normalBranch = form.slice(
      form.indexOf('if (form.entryMode === "scheduled")'),
      form.indexOf('if (form.backfilledOutcome === "completed")'),
    );

    expect(normalBranch).not.toContain("actualUsageInputs");
    expect(form).toContain('outcome: "completed"');
    expect(form).toContain('outcome: "cancelled"');
    expect(form).toContain("cancelReason: buildCancelReason()");
  });

  it("新增预约通过右侧勾选的多选面板一次确认多个服务项目", () => {
    const form = readSource("./components/AppointmentForm.vue");
    const selector = readSource("./components/AppointmentProjectMultiSelect.vue");

    expect(form).toContain("<AppointmentProjectMultiSelect");
    expect(form).toContain('@confirm="confirmProjectSelection"');
    expect(form).toContain("resetActualUsagesFromProjects();");
    expect(form).not.toContain("projectNames");
    expect(selector).toContain("<u-checkbox");
    expect(selector).toContain(':used-alone="true"');
    expect(selector).toContain(':checked="draftProjectIds.includes(project.id)"');
    expect(selector).toContain('@click="toggleProject(project.id)"');
    expect(selector).toContain('class="project-multi-select__checkbox" @click.stop');
    expect(selector).toContain("确认选择（{{ draftProjectIds.length }}）");
  });

  it("详情展示后补标识、预计占用并以内页弹层完成或取消", () => {
    const detail = readSource("./components/AppointmentDetailPage.vue");

    expect(detail).toContain("appointment.recordOrigin === 'backfilled'");
    expect(detail).toContain('"预计占用"');
    expect(detail).toContain("<AppointmentCompletionForm");
    expect(detail).toContain("<AppointmentCancellationForm");
  });

  it("详情预约信息使用明确的左右字段列，长内容在右列换行", () => {
    const detail = readSource("./components/AppointmentDetailPage.vue");

    expect(detail).toContain('class="detail-row__label"');
    expect(detail).toContain('class="detail-row__value"');
    expect(detail).toContain(".detail-row__label { display: flex; width: 152rpx;");
    expect(detail).toContain(".detail-row__value { min-width: 0; flex: 1; color: #39333f; font-size: 27rpx;");
  });

  it("完成弹层将库存选择和实际完成时间拆为清晰的大点击区域", () => {
    const completion = readSource(
      "./components/AppointmentCompletionForm.vue",
    );
    const usageEditor = readSource("./components/AppointmentUsageEditor.vue");

    expect(completion).toContain('class="completion-sheet__datetime-picker"');
    expect(completion).toContain('class="completion-sheet__datetime-picker-content"');
    expect(completion).toContain("实际完成时间");
    expect(completion).toContain(">日期</text>");
    expect(completion).toContain(">时间</text>");
    expect(completion).toContain("validateAppointmentCompletionInput");
    expect(completion).toContain(':quantity-errors="validationErrors.usageByInventoryItemId"');
    expect(completion).toContain('class="completion-sheet__field-error"');
    expect(completion).toContain('class="completion-sheet__section-error"');
    expect(usageEditor).toContain('class="usage-editor__picker-value"');
    expect(usageEditor).toContain("usage-editor__quantity--invalid");
    expect(usageEditor).toContain("usage-editor__quantity-error");
    expect(usageEditor).toContain("availableInventoryItems");
    expect(usageEditor).toContain("选择库存物品后立刻追加空用量行");
    expect(usageEditor).toContain('class="usage-editor__row-picker"');
    expect(usageEditor).toContain("usagePickerOptions");
    expect(usageEditor).toContain("replaceInventoryItem");
    expect(usageEditor).toContain(
      "quantityInput: usage.quantityInput",
    );
    expect(usageEditor).toContain(
      '{ inventoryItemId: inventoryItem.id, quantityInput: "" }',
    );
    expect(usageEditor).toContain(':disabled="disabled || !availableInventoryItems.length"');
    expect(usageEditor).not.toContain("selectedQuantityInput");
    expect(usageEditor).not.toContain("addUsage");
  });

  it("编辑页更新原生标题，完成与取消弹层就地展示操作错误", () => {
    const route = readSource("../../pages/appointment-create/index.vue");
    const completion = readSource(
      "./components/AppointmentCompletionForm.vue",
    );
    const cancellation = readSource(
      "./components/AppointmentCancellationForm.vue",
    );

    expect(route).toContain('appointmentId.value ? "编辑预约" : "新增预约"');
    expect(completion).toContain('v-if="generalError"');
    expect(completion).toContain("externalErrorTarget");
    expect(cancellation).toContain('v-if="errorMessage"');
    expect(completion).toContain("!submitting && emit('cancel')");
    expect(cancellation).toContain("!submitting && emit('cancel')");
  });

  it("新增预约资料不足时，说明和入口逐项对应缺失的顾客与服务项目", () => {
    const page = readSource("./components/AppointmentCreatePage.vue");

    expect(page).toContain("missingActiveCustomer");
    expect(page).toContain("missingActiveProject");
    expect(page).toContain("新增预约前，请先新增一位顾客和一个服务项目。");
    expect(page).toContain("新增顾客");
    expect(page).toContain("新增服务项目");
    expect(page).toContain('url: "/pages/customer-create/index"');
    expect(page).toContain('url: "/pages/beauty-project-create/index"');
  });

  it("列表只在状态 Tab 展示各状态数量，不重复展示统计或月历入口", () => {
    const management = readSource("./components/AppointmentManagement.vue");

    expect(management).toContain("待执行 {{ statusCounts.pending }}");
    expect(management).toContain("已完成 {{ statusCounts.completed }}");
    expect(management).toContain("已取消 {{ statusCounts.cancelled }}");
    expect(management).toContain('<u-icon name="plus" color="#ffffff" size="14" />');
    expect(management).not.toContain("appointment-management__summary-count");
    expect(management).not.toContain("visibleAppointments.length }}");
    expect(management).not.toContain("openCalendar");
    expect(management).not.toContain(">月历<");
  });

  it("已完成列表不重复展示已完成标签，后补记录保留后补标识", () => {
    const list = readSource("./components/AppointmentList.vue");

    expect(list).toContain(
      `v-if="appointment.status !== 'completed' || appointment.recordOrigin === 'backfilled'"`,
    );
    expect(list).toContain('? "后补"');
    expect(list).not.toContain('"后补 · 已完成"');
  });
});
