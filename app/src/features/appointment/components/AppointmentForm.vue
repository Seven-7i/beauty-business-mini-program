<script setup lang="ts">
import { computed, reactive, shallowRef, watch, type DeepReadonly } from "vue";
import type {
  BeautyProjectV1,
  CustomerV1,
  InventoryItemV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";
import type { SavePendingAppointmentInput } from "@/services/appointment-management-service";
import { addDecimalQuantities } from "@/utils/decimal-quantity";
import { keyboardSpacerHeight } from "../appointment-keyboard-avoidance";
import { applyProjectSelection } from "../appointment-form-state";

const props = defineProps<{
  customers: readonly DeepReadonly<CustomerV1>[];
  projects: readonly DeepReadonly<BeautyProjectV1>[];
  inventoryItems: readonly DeepReadonly<InventoryItemV1>[];
  submitting: boolean;
  editingAppointment?: DeepReadonly<PendingAppointmentV1>;
}>();

const emit = defineEmits<{
  (event: "submit", input: SavePendingAppointmentInput): void;
  (event: "cancel-edit"): void;
}>();

const KEYBOARD_CURSOR_SPACING_PX = 160;
const keyboardHeight = shallowRef(0);
const keyboardSpacerStyle = computed(() => ({
  height: `${keyboardSpacerHeight(keyboardHeight.value)}px`,
}));

function handleKeyboardHeightChange(event: {
  detail: { height?: number };
}): void {
  keyboardHeight.value = Math.max(0, Number(event.detail.height) || 0);
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const today = new Date();
const form = reactive({
  customerId: "",
  projectIds: [] as string[],
  date: formatLocalDate(today),
  time: "10:00",
  addressText: "",
  addressNote: "",
  note: "",
  actualUsageInputs: [] as Array<{
    inventoryItemId: string;
    quantityInput: string;
  }>,
  selectedInventoryItemId: "",
  selectedQuantityInput: "",
});
const customerNames = computed(() => props.customers.map(({ nickname }) => nickname));
const projectNames = computed(() => props.projects.map(({ name }) => name));
const inventoryNames = computed(() =>
  props.inventoryItems.map((item) => `${item.name}（${item.unit}）`),
);
const selectedCustomer = computed(() =>
  props.customers.find((customer) => customer.id === form.customerId),
);
const addressLabels = computed(() =>
  (selectedCustomer.value?.addresses ?? []).map((address) =>
    address.note ? `${address.addressText} · ${address.note}` : address.addressText,
  ),
);

function selectCustomer(event: { detail: { value: string } }): void {
  form.customerId = props.customers[Number(event.detail.value)]?.id ?? "";
}

function selectProject(event: { detail: { value: string } }): void {
  const projectId = props.projects[Number(event.detail.value)]?.id ?? "";
  const selection = applyProjectSelection(form.projectIds, projectId);
  if (!selection.changed) {
    return;
  }
  form.projectIds.splice(0, form.projectIds.length, ...selection.projectIds);
  resetActualUsagesFromProjects();
}

function removeProject(index: number): void {
  form.projectIds.splice(index, 1);
  resetActualUsagesFromProjects();
}

/** 项目组合变化后旧实际用量全部作废，重新合并当前项目默认用量。 */
function resetActualUsagesFromProjects(): void {
  const quantities = new Map<string, string>();
  for (const projectId of form.projectIds) {
    const project = props.projects.find((candidate) => candidate.id === projectId);
    for (const usage of project?.defaultUsages ?? []) {
      quantities.set(
        usage.inventoryItemId,
        addDecimalQuantities(
          quantities.get(usage.inventoryItemId) ?? "0",
          usage.quantity,
        ),
      );
    }
  }
  form.actualUsageInputs.splice(
    0,
    form.actualUsageInputs.length,
    ...[...quantities].map(([inventoryItemId, quantityInput]) => ({
      inventoryItemId,
      quantityInput,
    })),
  );
}

function selectInventoryItem(event: { detail: { value: string } }): void {
  form.selectedInventoryItemId =
    props.inventoryItems[Number(event.detail.value)]?.id ?? "";
}

function addActualUsage(): void {
  if (!form.selectedInventoryItemId || !form.selectedQuantityInput.trim()) {
    return;
  }
  const existing = form.actualUsageInputs.find(
    (usage) => usage.inventoryItemId === form.selectedInventoryItemId,
  );
  if (existing) {
    existing.quantityInput = form.selectedQuantityInput;
  } else {
    form.actualUsageInputs.push({
      inventoryItemId: form.selectedInventoryItemId,
      quantityInput: form.selectedQuantityInput,
    });
  }
  form.selectedInventoryItemId = "";
  form.selectedQuantityInput = "";
}

function inventoryLabel(inventoryItemId: string): string {
  const item = props.inventoryItems.find(
    (candidate) => candidate.id === inventoryItemId,
  );
  return item ? `${item.name} · ${item.unit}` : "库存物品不可用";
}

function selectAddress(event: { detail: { value: string } }): void {
  const address = selectedCustomer.value?.addresses[Number(event.detail.value)];
  if (address) {
    form.addressText = address.addressText;
    form.addressNote = address.note ?? "";
  }
}

function projectName(projectId: string): string {
  return props.projects.find((project) => project.id === projectId)?.name ?? "项目不可用";
}

function submit(): void {
  const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString();
  emit("submit", {
    appointmentId: props.editingAppointment?.id,
    customerId: form.customerId,
    projectIds: [...form.projectIds],
    actualUsageInputs: form.actualUsageInputs.map((usage) => ({ ...usage })),
    scheduledAt,
    serviceAddress: { addressText: form.addressText, note: form.addressNote },
    note: form.note,
  });
}

function reset(): void {
  form.customerId = "";
  form.projectIds.splice(0);
  form.addressText = "";
  form.addressNote = "";
  form.note = "";
  form.actualUsageInputs.splice(0);
  form.selectedInventoryItemId = "";
  form.selectedQuantityInput = "";
}

function loadAppointment(
  appointment?: DeepReadonly<PendingAppointmentV1>,
): void {
  reset();
  if (!appointment) {
    return;
  }
  const scheduledAt = new Date(appointment.scheduledAt);
  form.customerId = appointment.customerId;
  form.projectIds.push(
    ...appointment.projectSnapshots.map((snapshot) => snapshot.projectId),
  );
  form.date = formatLocalDate(scheduledAt);
  form.time = `${String(scheduledAt.getHours()).padStart(2, "0")}:${String(scheduledAt.getMinutes()).padStart(2, "0")}`;
  form.addressText = appointment.serviceAddressSnapshot.addressText;
  form.addressNote = appointment.serviceAddressSnapshot.note ?? "";
  form.note = appointment.note ?? "";
  form.actualUsageInputs.push(
    ...appointment.actualUsages.map((usage) => ({
      inventoryItemId: usage.inventoryItemId,
      quantityInput: usage.quantity,
    })),
  );
}

watch(() => form.customerId, () => {
  if (
    props.editingAppointment &&
    form.customerId === props.editingAppointment.customerId
  ) {
    return;
  }
  form.addressText = "";
  form.addressNote = "";
});
watch(() => props.editingAppointment, loadAppointment, { immediate: true });

defineExpose({ reset });
</script>

<template>
  <view class="appointment-form">
    <view class="appointment-form__heading">
      <text class="appointment-form__title">{{ editingAppointment ? "编辑待执行预约" : "新增待执行预约" }}</text>
      <button v-if="editingAppointment" :disabled="submitting" @click="emit('cancel-edit')">取消编辑</button>
    </view>
    <view class="appointment-form__row">
      <picker class="appointment-form__picker" :range="customerNames" @change="selectCustomer">
        <view>{{ selectedCustomer?.nickname ?? "选择顾客" }}</view>
      </picker>
      <view class="appointment-form__datetime">
        <picker mode="date" :value="form.date" @change="form.date = $event.detail.value"><view>{{ form.date }}</view></picker>
        <picker mode="time" :value="form.time" @change="form.time = $event.detail.value"><view>{{ form.time }}</view></picker>
      </view>
    </view>
    <view class="appointment-form__projects">
      <view v-for="(projectId, index) in form.projectIds" :key="projectId" class="appointment-form__tag">
        <text>{{ projectName(projectId) }}</text><button @click="removeProject(index)">×</button>
      </view>
      <view class="appointment-form__project-add">
        <picker :range="projectNames" @change="selectProject"><view>选择并添加服务项目</view></picker>
      </view>
      <text class="appointment-form__hint">项目变化后，实际用量会按新的默认用量重新生成。</text>
    </view>
    <view class="appointment-form__usages">
      <text class="appointment-form__usage-title">本次实际用量</text>
      <view v-for="(usage, index) in form.actualUsageInputs" :key="usage.inventoryItemId" class="appointment-form__usage-row">
        <text>{{ inventoryLabel(usage.inventoryItemId) }}</text>
        <input v-model="usage.quantityInput" type="digit" placeholder="用量" :adjust-position="true" :cursor-spacing="KEYBOARD_CURSOR_SPACING_PX" @keyboardheightchange="handleKeyboardHeightChange" />
        <button @click="form.actualUsageInputs.splice(index, 1)">移除</button>
      </view>
      <view class="appointment-form__usage-add">
        <picker :range="inventoryNames" @change="selectInventoryItem"><view>{{ form.selectedInventoryItemId ? inventoryLabel(form.selectedInventoryItemId) : "添加库存物品" }}</view></picker>
        <input v-model="form.selectedQuantityInput" type="digit" placeholder="用量" :adjust-position="true" :cursor-spacing="KEYBOARD_CURSOR_SPACING_PX" @keyboardheightchange="handleKeyboardHeightChange" />
        <button @click="addActualUsage">添加</button>
      </view>
    </view>
    <picker v-if="addressLabels.length" :range="addressLabels" @change="selectAddress">
      <view class="appointment-form__address-picker">从顾客服务地址选择</view>
    </picker>
    <input v-model="form.addressText" maxlength="100" placeholder="服务地址（必填，也可输入临时地址）" :adjust-position="true" :cursor-spacing="KEYBOARD_CURSOR_SPACING_PX" @keyboardheightchange="handleKeyboardHeightChange" />
    <input v-model="form.addressNote" maxlength="50" placeholder="地址备注（选填）" :adjust-position="true" :cursor-spacing="KEYBOARD_CURSOR_SPACING_PX" @keyboardheightchange="handleKeyboardHeightChange" />
    <textarea v-model="form.note" maxlength="300" placeholder="预约备注（选填）" :adjust-position="true" :cursor-spacing="KEYBOARD_CURSOR_SPACING_PX" @keyboardheightchange="handleKeyboardHeightChange" />
    <button class="appointment-form__submit" :disabled="submitting" @click="submit">{{ submitting ? "正在保存" : editingAppointment ? "保存预约修改" : "保存预约" }}</button>
    <view class="appointment-form__keyboard-spacer" :style="keyboardSpacerStyle" aria-hidden="true" />
  </view>
</template>

<style scoped>
.appointment-form { padding: 30rpx; border: 2rpx solid #e0e5ec; border-radius: 20rpx; background: #fff; }
.appointment-form__heading { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.appointment-form__title { color: #1e293b; font-size: 31rpx; font-weight: 700; }
.appointment-form__heading button { height: 64rpx; padding: 0 18rpx; background: transparent; color: #31549e; font-size: 20rpx; line-height: 64rpx; }
.appointment-form__row, .appointment-form__datetime, .appointment-form__project-add, .appointment-form__tag { display: flex; align-items: center; gap: 12rpx; }
.appointment-form__row { margin-top: 22rpx; }
.appointment-form__picker, .appointment-form__datetime { flex: 1; }
.appointment-form__picker, .appointment-form__datetime picker, .appointment-form__project-add picker, .appointment-form__address-picker, .appointment-form input, .appointment-form textarea { box-sizing: border-box; padding: 18rpx; border: 2rpx solid #dce2ea; border-radius: 11rpx; background: #f9fafc; color: #344158; font-size: 23rpx; }
.appointment-form__datetime picker { flex: 1; text-align: center; }
.appointment-form__projects { margin-top: 16rpx; }
.appointment-form__tag { display: inline-flex; margin: 0 10rpx 10rpx 0; padding: 8rpx 12rpx; border-radius: 10rpx; background: #e8eefb; color: #31549e; font-size: 21rpx; }
.appointment-form__tag button { background: transparent; color: #8b4a49; font-size: 22rpx; }
.appointment-form__project-add picker { min-width: 0; flex: 1; }
.appointment-form__project-add button { width: 110rpx; height: 72rpx; background: #e7edf8; color: #31549e; font-size: 22rpx; line-height: 72rpx; }
.appointment-form__hint { display: block; margin-top: 9rpx; color: #818b9a; font-size: 20rpx; }
.appointment-form__usages { margin-top: 18rpx; padding-top: 16rpx; border-top: 2rpx solid #edf0f4; }
.appointment-form__usage-title { color: #46536a; font-size: 23rpx; font-weight: 700; }
.appointment-form__usage-row, .appointment-form__usage-add { display: flex; align-items: center; gap: 10rpx; margin-top: 10rpx; }
.appointment-form__usage-row text, .appointment-form__usage-add picker { min-width: 0; flex: 1; color: #5c687d; font-size: 21rpx; }
.appointment-form__usage-row input, .appointment-form__usage-add input { width: 120rpx; margin-top: 0; }
.appointment-form__usage-row button, .appointment-form__usage-add button { width: 96rpx; height: 72rpx; background: #edf1f7; color: #576986; font-size: 20rpx; line-height: 72rpx; }
.appointment-form__address-picker, .appointment-form input, .appointment-form textarea { width: 100%; margin-top: 14rpx; }
.appointment-form textarea { min-height: 120rpx; }
.appointment-form__submit { height: 82rpx; margin-top: 22rpx; border-radius: 14rpx; background: #3159b5; color: #fff; font-size: 27rpx; font-weight: 600; line-height: 82rpx; }
.appointment-form__keyboard-spacer { width: 100%; pointer-events: none; }
</style>
