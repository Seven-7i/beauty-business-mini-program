<script setup lang="ts">
import { shallowRef, watch, type DeepReadonly } from "vue";
import type { PendingAppointmentV1 } from "@/domain/data-schema";
import type { CancelAppointmentInput } from "@/services/appointment-management-service";

const props = defineProps<{
  appointment: DeepReadonly<PendingAppointmentV1>;
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "submit", input: CancelAppointmentInput): void;
  (event: "cancel"): void;
}>();

const cancelReason = shallowRef("");

watch(
  () => props.appointment.id,
  () => {
    cancelReason.value = "";
  },
  { immediate: true },
);

function submit(): void {
  emit("submit", {
    appointmentId: props.appointment.id,
    cancelReason: cancelReason.value,
  });
}
</script>

<template>
  <view class="cancellation-form">
    <text class="cancellation-form__title">取消预约</text>
    <text class="cancellation-form__hint">取消后释放库存占用并保留预约记录，原因可以不填。</text>
    <textarea v-model="cancelReason" maxlength="200" placeholder="取消原因（选填）" />
    <view class="cancellation-form__actions">
      <button :disabled="submitting" @click="emit('cancel')">暂不取消</button>
      <button class="cancellation-form__confirm" :disabled="submitting" @click="submit">{{ submitting ? "正在取消" : "确认取消预约" }}</button>
    </view>
  </view>
</template>

<style scoped>
.cancellation-form { display: flex; margin-top: 24rpx; padding: 28rpx; border: 2rpx solid #ead7d4; border-radius: 18rpx; background: #fffafa; flex-direction: column; }
.cancellation-form__title { color: #733f3c; font-size: 29rpx; font-weight: 700; }
.cancellation-form__hint { margin-top: 8rpx; color: #8a6d69; font-size: 21rpx; line-height: 1.5; }
.cancellation-form textarea { width: 100%; min-height: 120rpx; box-sizing: border-box; margin-top: 18rpx; padding: 18rpx; border: 2rpx solid #eadbd9; border-radius: 11rpx; background: #fff; font-size: 23rpx; }
.cancellation-form__actions { display: flex; justify-content: flex-end; gap: 12rpx; margin-top: 18rpx; }
.cancellation-form__actions button { height: 72rpx; padding: 0 24rpx; border-radius: 11rpx; background: #f1eeee; color: #675b5a; font-size: 21rpx; line-height: 72rpx; }
.cancellation-form__actions .cancellation-form__confirm { background: #9a4a47; color: #fff; }
</style>
