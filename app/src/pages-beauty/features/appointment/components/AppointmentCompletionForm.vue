<script setup lang="ts">
import { computed, reactive, ref, watch, type DeepReadonly } from "vue";
import type {
  CompletedAppointmentV1,
  InventoryItemV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";
import type { CompleteAppointmentInput } from "@/services/appointment-management-service";
import type { AppointmentUsageDraft } from "../appointment-form-state";
import {
  validateAppointmentCompletionInput,
  type AppointmentCompletionValidationErrors,
} from "../appointment-completion-validation";
import AppointmentUsageEditor from "./AppointmentUsageEditor.vue";
import { useDialogFocusTrap } from "@/features/shared/composables/useDialogFocusTrap";

interface AppointmentCompletionFormProps {
  /** 待完成或正在修正完成信息的预约。 */
  appointment: DeepReadonly<PendingAppointmentV1 | CompletedAppointmentV1>;
  /** 可供选择并用于解析单位的库存物品。 */
  inventoryItems: readonly DeepReadonly<InventoryItemV1>[];
  /** 正常待执行预约完成时带入的实际用量初始值。 */
  defaultUsageInputs: readonly AppointmentUsageDraft[];
  /** 提交期间锁定表单和遮罩关闭。 */
  submitting: boolean;
  /** 服务端或仓储返回的可恢复错误。 */
  errorMessage?: string;
}

const props = defineProps<AppointmentCompletionFormProps>();
// 当前 uni-mp-vue 运行时尚未导出 Vue 3.5 useTemplateRef，使用显式模板 ref 保持兼容。
const dialogPanel = ref<HTMLElement | null>(null);

const emit = defineEmits<{
  /** 提交最终成交金额、时间和实际用量。 */
  (event: "submit", input: CompleteAppointmentInput): void;
  /** 用户主动关闭完成面板。 */
  (event: "cancel"): void;
  /** 输入变化后通知父组件清除旧错误。 */
  (event: "change"): void;
}>();

useDialogFocusTrap(dialogPanel, () => {
  if (!props.submitting) emit("cancel");
});

/** 把本地日期格式化为日期选择器可识别的值。 */
function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 把本地时间格式化为时间选择器可识别的值。 */
function formatLocalTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const form = reactive({
  transactionAmountInput: "",
  completedDate: "",
  completedTime: "",
  note: "",
  actualUsageInputs: [] as AppointmentUsageDraft[],
});

const validationErrors = reactive<AppointmentCompletionValidationErrors>({
  transactionAmount: "",
  completedAt: "",
  usageByInventoryItemId: {},
});

type CompletionErrorTarget = "amount" | "time" | "usage" | "general";

/** 将服务层可恢复错误落到最贴近用户可修正字段的位置。 */
const externalErrorTarget = computed<CompletionErrorTarget>(() => {
  const message = props.errorMessage ?? "";
  if (!message) {
    return "general";
  }
  if (message.includes("成交金额")) {
    return "amount";
  }
  if (message.includes("实际完成时间")) {
    return "time";
  }
  return /库存|用量|数量/.test(message) ? "usage" : "general";
});
const transactionAmountError = computed(
  () =>
    validationErrors.transactionAmount ||
    (externalErrorTarget.value === "amount" ? props.errorMessage ?? "" : ""),
);
const completedAtError = computed(
  () =>
    validationErrors.completedAt ||
    (externalErrorTarget.value === "time" ? props.errorMessage ?? "" : ""),
);
const usageError = computed(() =>
  externalErrorTarget.value === "usage" ? props.errorMessage ?? "" : "",
);
const generalError = computed(() =>
  externalErrorTarget.value === "general" ? props.errorMessage ?? "" : "",
);

/** 切换预约时，以预计用量或已保存实际用量初始化完成表单。 */
function loadAppointment(
  appointment: DeepReadonly<PendingAppointmentV1 | CompletedAppointmentV1>,
): void {
  const completedAt =
    appointment.status === "completed"
      ? new Date(appointment.completedAt)
      : new Date();
  form.transactionAmountInput = (
    (appointment.status === "completed"
      ? appointment.transactionAmountCents
      : appointment.standardAmountCents) / 100
  ).toFixed(2);
  form.completedDate = formatLocalDate(completedAt);
  form.completedTime = formatLocalTime(completedAt);
  form.note = appointment.note ?? "";
  const usageInputs =
    appointment.status === "pending"
      ? props.defaultUsageInputs
      : appointment.actualUsages.map((usage) => ({
          inventoryItemId: usage.inventoryItemId,
          quantityInput: usage.quantity,
        }));
  form.actualUsageInputs = usageInputs.map((usage) => ({ ...usage }));
}

/** 清除本地输入错误，保持用户下一次编辑只看到仍未修正的问题。 */
function clearValidationErrors(): void {
  validationErrors.transactionAmount = "";
  validationErrors.completedAt = "";
  validationErrors.usageByInventoryItemId = {};
}

/** 校验本地可确定的输入，服务层继续负责库存、状态和事务边界。 */
function validateForm(): boolean {
  const nextErrors = validateAppointmentCompletionInput({
    transactionAmountInput: form.transactionAmountInput,
    completedDate: form.completedDate,
    completedTime: form.completedTime,
    actualUsageInputs: form.actualUsageInputs,
    inventoryItems: props.inventoryItems,
  });
  validationErrors.transactionAmount = nextErrors.transactionAmount;
  validationErrors.completedAt = nextErrors.completedAt;
  validationErrors.usageByInventoryItemId = nextErrors.usageByInventoryItemId;
  return !(
    nextErrors.transactionAmount ||
    nextErrors.completedAt ||
    Object.keys(nextErrors.usageByInventoryItemId).length
  );
}

/** 提交最终成交信息，由服务层原子扣减库存。 */
function submit(): void {
  if (!validateForm()) {
    return;
  }
  emit("submit", {
    appointmentId: props.appointment.id,
    transactionAmountInput: form.transactionAmountInput,
    completedAt: new Date(
      `${form.completedDate}T${form.completedTime}:00`,
    ).toISOString(),
    actualUsageInputs: form.actualUsageInputs.map((usage) => ({ ...usage })),
    note: form.note,
  });
}

watch(() => props.appointment, loadAppointment, { immediate: true });
watch(
  form,
  () => {
    clearValidationErrors();
    emit("change");
  },
  { deep: true },
);
</script>

<template>
  <view class="completion-sheet" role="dialog" aria-modal="true">
    <view class="completion-sheet__mask" @click="!submitting && emit('cancel')" />
    <view ref="dialogPanel" class="completion-sheet__panel" tabindex="-1" aria-label="完成预约">
      <view class="completion-sheet__handle" />
      <button
        class="completion-sheet__close"
        :disabled="submitting"
        aria-label="关闭完成预约弹层"
        @click="emit('cancel')"
      >
        <u-icon name="close" color="#57535d" size="22" />
      </button>
      <text class="completion-sheet__title">
        {{ appointment.status === "completed" ? "更正完成信息" : "完成预约" }}
      </text>
      <text class="completion-sheet__hint">
        请确认本次实际用量，默认带出项目正常用量
      </text>
      <text v-if="generalError" class="completion-sheet__error">{{ generalError }}</text>

      <view class="completion-sheet__section-heading">
        <text>本次实际用量</text>
        <text>{{ form.actualUsageInputs.length }} 项</text>
      </view>
      <AppointmentUsageEditor
        v-model="form.actualUsageInputs"
        :inventory-items="inventoryItems"
        :disabled="submitting"
        :quantity-errors="validationErrors.usageByInventoryItemId"
      />
      <text v-if="usageError" class="completion-sheet__section-error">{{ usageError }}</text>

      <view class="completion-sheet__field">
        <text class="completion-sheet__label">成交金额 <text class="completion-sheet__required">*</text></text>
        <view class="completion-sheet__field-main">
          <view class="completion-sheet__control completion-sheet__money">
            <text>¥</text>
            <input v-model="form.transactionAmountInput" :disabled="submitting" type="digit" placeholder="0.00" />
          </view>
          <text v-if="transactionAmountError" class="completion-sheet__field-error">{{ transactionAmountError }}</text>
        </view>
      </view>
      <view class="completion-sheet__field">
        <text class="completion-sheet__label">实际完成时间 <text class="completion-sheet__required">*</text></text>
        <view class="completion-sheet__field-main">
          <view class="completion-sheet__datetime">
            <picker
              class="completion-sheet__datetime-picker"
              mode="date"
              :value="form.completedDate"
              :disabled="submitting"
              @change="form.completedDate = $event.detail.value"
            >
              <view class="completion-sheet__datetime-picker-content">
                <view class="completion-sheet__datetime-copy">
                  <text class="completion-sheet__datetime-label">日期</text>
                  <text class="completion-sheet__datetime-value">{{ form.completedDate }}</text>
                </view>
                <u-icon name="calendar" color="#676271" size="18" />
              </view>
            </picker>
            <picker
              class="completion-sheet__datetime-picker"
              mode="time"
              :value="form.completedTime"
              :disabled="submitting"
              @change="form.completedTime = $event.detail.value"
            >
              <view class="completion-sheet__datetime-picker-content">
                <view class="completion-sheet__datetime-copy">
                  <text class="completion-sheet__datetime-label">时间</text>
                  <text class="completion-sheet__datetime-value">{{ form.completedTime }}</text>
                </view>
                <u-icon name="clock" color="#676271" size="18" />
              </view>
            </picker>
          </view>
          <text v-if="completedAtError" class="completion-sheet__field-error">{{ completedAtError }}</text>
        </view>
      </view>
      <view class="completion-sheet__field">
        <text class="completion-sheet__label">完成备注（选填）</text>
        <input v-model="form.note" class="completion-sheet__control" :disabled="submitting" maxlength="300" placeholder="补充本次服务说明" />
      </view>
      <view class="completion-sheet__actions">
        <button :disabled="submitting" @click="emit('cancel')">暂不完成</button>
        <button class="completion-sheet__confirm" :disabled="submitting" @click="submit">
          {{ submitting ? "正在保存" : "确认完成" }}
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.completion-sheet { position: fixed; z-index: 120; inset: 0; }
.completion-sheet__mask { position: absolute; inset: 0; background: rgba(26, 23, 31, 0.58); }
.completion-sheet__panel { position: absolute; bottom: 0; left: 0; width: 100%; max-height: 88vh; box-sizing: border-box; padding: 22rpx 38rpx calc(30rpx + env(safe-area-inset-bottom)); border-radius: 36rpx 36rpx 0 0; background: #fff; overflow-y: auto; }
.completion-sheet__handle { width: 84rpx; height: 8rpx; margin: 0 auto 22rpx; border-radius: 999rpx; background: #d8d6dc; }
.completion-sheet__close { position: absolute; top: 36rpx; right: 32rpx; display: flex; width: 66rpx; height: 66rpx; align-items: center; justify-content: center; padding: 0; border-radius: 50%; background: #f2f1f4; }
.completion-sheet__title, .completion-sheet__hint { display: block; text-align: center; }
.completion-sheet__title { color: #17151c; font-size: 34rpx; font-weight: 700; }
.completion-sheet__hint { margin: 12rpx 70rpx 28rpx; color: #6f6a78; font-size: 23rpx; line-height: 1.55; }
.completion-sheet__error { display: block; margin: 0 0 24rpx; padding: 18rpx 20rpx; border-radius: 12rpx; background: #fff0f1; color: #d92f42; font-size: 23rpx; line-height: 1.5; }
.completion-sheet__section-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14rpx; color: #25212c; font-size: 27rpx; font-weight: 650; }
.completion-sheet__section-heading text:last-child { color: #696474; font-size: 22rpx; font-weight: 400; }
.completion-sheet__section-error { display: block; margin: 10rpx 0 2rpx; color: #d92f42; font-size: 21rpx; line-height: 1.45; }
.completion-sheet__field { display: flex; align-items: center; gap: 20rpx; margin-top: 20rpx; }
.completion-sheet__label { width: 230rpx; color: #4d4858; font-size: 24rpx; }
.completion-sheet__required { color: #ff263f; }
.completion-sheet__field-main { min-width: 0; flex: 1; }
.completion-sheet__field-error { display: block; margin-top: 7rpx; color: #d92f42; font-size: 20rpx; line-height: 1.35; }
.completion-sheet__control { min-width: 0; min-height: 76rpx; box-sizing: border-box; flex: 1; border: 2rpx solid #dedbe5; border-radius: 12rpx; background: #fff; }
.completion-sheet__control { padding: 0 20rpx; font-size: 24rpx; }
.completion-sheet__money { display: flex; align-items: center; padding: 0 20rpx; }
.completion-sheet__money input { min-width: 0; height: 72rpx; flex: 1; font-size: 24rpx; }
.completion-sheet__datetime { display: flex; min-width: 0; flex: 1; gap: 12rpx; }
.completion-sheet__datetime-picker { display: block; min-width: 0; flex: 1; }
.completion-sheet__datetime-picker-content { display: flex; min-height: 84rpx; box-sizing: border-box; align-items: center; justify-content: space-between; gap: 8rpx; padding: 0 14rpx; border: 2rpx solid #dedbe5; border-radius: 12rpx; background: #fff; }
.completion-sheet__datetime-copy { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3rpx; }
.completion-sheet__datetime-label { color: #817b88; font-size: 18rpx; }
.completion-sheet__datetime-value { color: #27232e; font-size: 22rpx; line-height: 1.2; white-space: nowrap; }
.completion-sheet__actions { display: flex; gap: 24rpx; margin-top: 30rpx; }
.completion-sheet__actions button { height: 88rpx; flex: 1; border: 2rpx solid #5335ec; border-radius: 14rpx; background: #fff; color: #4c31dd; font-size: 27rpx; font-weight: 600; line-height: 84rpx; }
.completion-sheet__actions .completion-sheet__confirm { border: 0; background: linear-gradient(135deg, #5635df, #3d20d6); color: #fff; line-height: 88rpx; }
</style>
