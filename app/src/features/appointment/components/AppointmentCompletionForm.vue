<script setup lang="ts">
import { computed, reactive, watch, type DeepReadonly } from "vue";
import type {
  CompletedAppointmentV1,
  InventoryItemV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";
import type { CompleteAppointmentInput } from "@/services/appointment-management-service";

const props = defineProps<{
  appointment: DeepReadonly<
    PendingAppointmentV1 | CompletedAppointmentV1
  >;
  inventoryItems: readonly DeepReadonly<InventoryItemV1>[];
  submitting: boolean;
}>();

const emit = defineEmits<{
  (event: "submit", input: CompleteAppointmentInput): void;
  (event: "cancel"): void;
}>();

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatLocalTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const currentTime = new Date();
const form = reactive({
  transactionAmountInput: "",
  completedDate: formatLocalDate(currentTime),
  completedTime: formatLocalTime(currentTime),
  note: "",
  actualUsageInputs: [] as Array<{
    inventoryItemId: string;
    itemLabel: string;
    quantityInput: string;
  }>,
  selectedInventoryItemId: "",
  selectedQuantityInput: "",
});

const inventoryNames = computed(() =>
  props.inventoryItems.map((item) => `${item.name}（${item.unit}）`),
);

function selectInventoryItem(event: { detail: { value: string } }): void {
  form.selectedInventoryItemId =
    props.inventoryItems[Number(event.detail.value)]?.id ?? "";
}

function selectedInventoryLabel(): string {
  const item = props.inventoryItems.find(
    (candidate) => candidate.id === form.selectedInventoryItemId,
  );
  return item ? `${item.name} · ${item.unit}` : "添加库存物品";
}

function addActualUsage(): void {
  const item = props.inventoryItems.find(
    (candidate) => candidate.id === form.selectedInventoryItemId,
  );
  if (!item || !form.selectedQuantityInput.trim()) {
    return;
  }
  const existing = form.actualUsageInputs.find(
    (usage) => usage.inventoryItemId === item.id,
  );
  if (existing) {
    existing.quantityInput = form.selectedQuantityInput;
  } else {
    form.actualUsageInputs.push({
      inventoryItemId: item.id,
      itemLabel: `${item.name} · ${item.unit}`,
      quantityInput: form.selectedQuantityInput,
    });
  }
  form.selectedInventoryItemId = "";
  form.selectedQuantityInput = "";
}

/** 每次选择另一预约时以其标准金额、备注和已保存实际用量初始化确认表单。 */
function loadAppointment(
  appointment: DeepReadonly<
    PendingAppointmentV1 | CompletedAppointmentV1
  >,
): void {
  const loadedAt =
    appointment.status === "completed"
      ? new Date(appointment.completedAt)
      : new Date();
  form.transactionAmountInput = (
    (appointment.status === "completed"
      ? appointment.transactionAmountCents
      : appointment.standardAmountCents) / 100
  ).toFixed(2);
  form.completedDate = formatLocalDate(loadedAt);
  form.completedTime = formatLocalTime(loadedAt);
  form.note = appointment.note ?? "";
  form.selectedInventoryItemId = "";
  form.selectedQuantityInput = "";
  form.actualUsageInputs.splice(
    0,
    form.actualUsageInputs.length,
    ...appointment.actualUsages.map((usage) => ({
      inventoryItemId: usage.inventoryItemId,
      itemLabel: `${usage.itemNameSnapshot} · ${usage.unitSnapshot}`,
      quantityInput: usage.quantity,
    })),
  );
}

function submit(): void {
  emit("submit", {
    appointmentId: props.appointment.id,
    transactionAmountInput: form.transactionAmountInput,
    completedAt: new Date(
      `${form.completedDate}T${form.completedTime}:00`,
    ).toISOString(),
    actualUsageInputs: form.actualUsageInputs.map(
      ({ inventoryItemId, quantityInput }) => ({
        inventoryItemId,
        quantityInput,
      }),
    ),
    note: form.note,
  });
}

watch(() => props.appointment, loadAppointment, { immediate: true });
</script>

<template>
  <view class="completion-form">
    <view class="completion-form__heading">
      <view class="completion-form__copy">
        <text class="completion-form__title">{{ appointment.status === "completed" ? "更正完成信息" : "确认完成预约" }}</text>
        <text class="completion-form__hint">{{ appointment.status === "completed" ? "更正会同步补回或补扣库存，顾客和项目保持不变。" : "完成后会立即扣减库存并生成只读预约消耗。" }}</text>
      </view>
      <button :disabled="submitting" @click="emit('cancel')">返回</button>
    </view>
    <label class="completion-form__field">
      <text>成交金额（元）</text>
      <input v-model="form.transactionAmountInput" type="digit" placeholder="0.00" />
    </label>
    <view class="completion-form__datetime">
      <picker mode="date" :value="form.completedDate" @change="form.completedDate = $event.detail.value"><view>{{ form.completedDate }}</view></picker>
      <picker mode="time" :value="form.completedTime" @change="form.completedTime = $event.detail.value"><view>{{ form.completedTime }}</view></picker>
    </view>
    <view class="completion-form__usages">
      <text class="completion-form__section-title">最终实际用量</text>
      <view v-if="!form.actualUsageInputs.length" class="completion-form__empty">本次预约没有库存用量。</view>
      <label v-for="(usage, index) in form.actualUsageInputs" :key="usage.inventoryItemId" class="completion-form__usage">
        <text>{{ usage.itemLabel }}</text>
        <input v-model="usage.quantityInput" type="digit" placeholder="用量" />
        <button :disabled="submitting" @click="form.actualUsageInputs.splice(index, 1)">移除</button>
      </label>
      <view class="completion-form__usage completion-form__usage-add">
        <picker :range="inventoryNames" @change="selectInventoryItem"><view>{{ selectedInventoryLabel() }}</view></picker>
        <input v-model="form.selectedQuantityInput" type="digit" placeholder="用量" />
        <button :disabled="submitting" @click="addActualUsage">添加</button>
      </view>
    </view>
    <textarea v-model="form.note" maxlength="300" placeholder="完成备注（选填）" />
    <button class="completion-form__submit" :disabled="submitting" @click="submit">{{ submitting ? "正在保存" : appointment.status === "completed" ? "保存完成信息更正" : "确认完成并扣减库存" }}</button>
  </view>
</template>

<style scoped>
.completion-form { margin-top: 24rpx; padding: 28rpx; border: 2rpx solid #cddbcf; border-radius: 18rpx; background: #fbfefc; }
.completion-form__heading, .completion-form__datetime, .completion-form__usage { display: flex; align-items: center; }
.completion-form__heading { justify-content: space-between; gap: 18rpx; }
.completion-form__copy { display: flex; min-width: 0; flex-direction: column; }
.completion-form__title { color: #244533; font-size: 29rpx; font-weight: 700; }
.completion-form__hint, .completion-form__empty { margin-top: 7rpx; color: #758477; font-size: 20rpx; line-height: 1.5; }
.completion-form__heading button { height: 64rpx; padding: 0 20rpx; background: transparent; color: #536c5c; font-size: 20rpx; line-height: 64rpx; }
.completion-form__field { display: flex; margin-top: 22rpx; flex-direction: column; color: #465b4e; font-size: 22rpx; font-weight: 600; }
.completion-form input, .completion-form textarea, .completion-form__datetime picker { box-sizing: border-box; padding: 18rpx; border: 2rpx solid #d8e3da; border-radius: 11rpx; background: #fff; color: #2e4034; font-size: 23rpx; }
.completion-form__field input { width: 100%; margin-top: 10rpx; }
.completion-form__datetime { gap: 12rpx; margin-top: 14rpx; }
.completion-form__datetime picker { flex: 1; text-align: center; }
.completion-form__usages { margin-top: 22rpx; padding-top: 18rpx; border-top: 2rpx solid #e6eee7; }
.completion-form__section-title { color: #3c5545; font-size: 23rpx; font-weight: 700; }
.completion-form__usage { gap: 12rpx; margin-top: 12rpx; }
.completion-form__usage text, .completion-form__usage picker { min-width: 0; flex: 1; color: #617166; font-size: 21rpx; }
.completion-form__usage input { width: 150rpx; }
.completion-form__usage button { width: 92rpx; height: 68rpx; background: #edf3ee; color: #536c5c; font-size: 20rpx; line-height: 68rpx; }
.completion-form textarea { width: 100%; min-height: 120rpx; margin-top: 18rpx; }
.completion-form__submit { height: 82rpx; margin-top: 20rpx; border-radius: 14rpx; background: #34704d; color: #fff; font-size: 25rpx; font-weight: 600; line-height: 82rpx; }
</style>
