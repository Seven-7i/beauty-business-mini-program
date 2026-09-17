<script setup lang="ts">
import { computed, ref, shallowRef, watch, type DeepReadonly } from "vue";
import type { PendingAppointmentV1 } from "@/domain/data-schema";
import type { CancelAppointmentInput } from "@/services/appointment-management-service";
import { useDialogFocusTrap } from "@/features/shared/composables/useDialogFocusTrap";

interface AppointmentCancellationFormProps {
  /** 当前待取消的正常预约。 */
  appointment: DeepReadonly<PendingAppointmentV1>;
  /** 提交期间锁定表单和遮罩关闭。 */
  submitting: boolean;
  /** 服务端或仓储返回的可恢复错误。 */
  errorMessage?: string;
}

const props = defineProps<AppointmentCancellationFormProps>();
// 当前 uni-mp-vue 运行时尚未导出 Vue 3.5 useTemplateRef，使用显式模板 ref 保持兼容。
const dialogPanel = ref<HTMLElement | null>(null);

const emit = defineEmits<{
  /** 提交包含必填取消原因的业务命令。 */
  (event: "submit", input: CancelAppointmentInput): void;
  /** 用户主动关闭取消面板。 */
  (event: "cancel"): void;
  /** 输入变化后通知父组件清除旧错误。 */
  (event: "change"): void;
}>();

useDialogFocusTrap(dialogPanel, () => {
  if (!props.submitting) emit("cancel");
});

const cancelReason = shallowRef("");
const canSubmit = computed(
  () => cancelReason.value.trim().length > 0 && !props.submitting,
);

watch(
  () => props.appointment.id,
  () => {
    cancelReason.value = "";
  },
  { immediate: true },
);
watch(cancelReason, () => emit("change"));

/** 仅在已填写取消原因时提交，服务层会再次执行同样校验。 */
function submit(): void {
  if (!cancelReason.value.trim()) {
    uni.showToast({ title: "请填写取消原因", icon: "none" });
    return;
  }
  emit("submit", {
    appointmentId: props.appointment.id,
    cancelReason: cancelReason.value,
  });
}
</script>

<template>
  <view class="cancellation-sheet" role="dialog" aria-modal="true">
    <view class="cancellation-sheet__mask" @click="!submitting && emit('cancel')" />
    <view ref="dialogPanel" class="cancellation-sheet__panel" tabindex="-1" aria-label="取消预约">
      <view class="cancellation-sheet__handle" />
      <text class="cancellation-sheet__title">取消预约</text>
      <text class="cancellation-sheet__hint">
        取消后释放预计占用并保留记录，请填写顾客取消原因
      </text>
      <text v-if="errorMessage" class="cancellation-sheet__error">{{ errorMessage }}</text>
      <text class="cancellation-sheet__label">取消原因 <text>*</text></text>
      <textarea
        v-model="cancelReason"
        :disabled="submitting"
        maxlength="200"
        placeholder="例如：顾客临时有事、身体不适或时间冲突"
      />
      <view class="cancellation-sheet__actions">
        <button :disabled="submitting" @click="emit('cancel')">暂不取消</button>
        <button
          class="cancellation-sheet__confirm"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ submitting ? "正在取消" : "确认取消预约" }}
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.cancellation-sheet { position: fixed; z-index: 125; inset: 0; }
.cancellation-sheet__mask { position: absolute; inset: 0; background: rgba(26, 23, 31, 0.58); }
.cancellation-sheet__panel { position: absolute; bottom: 0; left: 0; width: 100%; box-sizing: border-box; padding: 22rpx 38rpx calc(34rpx + env(safe-area-inset-bottom)); border-radius: 36rpx 36rpx 0 0; background: #fff; }
.cancellation-sheet__handle { width: 84rpx; height: 8rpx; margin: 0 auto 24rpx; border-radius: 999rpx; background: #d8d6dc; }
.cancellation-sheet__title, .cancellation-sheet__hint { display: block; text-align: center; }
.cancellation-sheet__title { color: #201b24; font-size: 34rpx; font-weight: 700; }
.cancellation-sheet__hint { margin-top: 12rpx; color: #77707c; font-size: 23rpx; line-height: 1.5; }
.cancellation-sheet__error { display: block; margin-top: 22rpx; padding: 18rpx 20rpx; border-radius: 12rpx; background: #fff0f1; color: #d92f42; font-size: 23rpx; line-height: 1.5; }
.cancellation-sheet__label { display: block; margin-top: 30rpx; color: #302a35; font-size: 25rpx; font-weight: 650; }
.cancellation-sheet__label text { color: #ff273e; }
.cancellation-sheet textarea { width: 100%; min-height: 176rpx; box-sizing: border-box; margin-top: 14rpx; padding: 20rpx; border: 2rpx solid #dfd9e3; border-radius: 14rpx; background: #fff; color: #2c2730; font-size: 24rpx; }
.cancellation-sheet__actions { display: flex; gap: 22rpx; margin-top: 26rpx; }
.cancellation-sheet__actions button { height: 86rpx; flex: 1; border: 2rpx solid #5a3bea; border-radius: 14rpx; background: #fff; color: #4d34d8; font-size: 26rpx; line-height: 82rpx; }
.cancellation-sheet__actions .cancellation-sheet__confirm { border: 0; background: #f03447; color: #fff; line-height: 86rpx; }
.cancellation-sheet__confirm[disabled] { opacity: 0.45; }
</style>
