<script setup lang="ts">
import { computed, reactive, shallowRef, watch, type DeepReadonly } from "vue";
import type {
  BeautyProjectV1,
  CustomerV1,
  InventoryItemV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";
import type {
  SaveBackfilledAppointmentInput,
  SavePendingAppointmentInput,
} from "@/services/appointment-management-service";
import { addDecimalQuantities } from "@/utils/decimal-quantity";
import {
  buildDefaultUsageDrafts,
  type AppointmentEntryMode,
  type AppointmentUsageDraft,
  type BackfilledOutcome,
} from "../appointment-form-state";
import AppointmentUsageEditor from "./AppointmentUsageEditor.vue";
import AppointmentProjectMultiSelect from "./AppointmentProjectMultiSelect.vue";
import { keyboardSpacerHeight } from "../appointment-keyboard-avoidance";

const props = defineProps<{
  customers: readonly DeepReadonly<CustomerV1>[];
  projects: readonly DeepReadonly<BeautyProjectV1>[];
  inventoryItems: readonly DeepReadonly<InventoryItemV1>[];
  submitting: boolean;
  editingAppointment?: DeepReadonly<PendingAppointmentV1>;
}>();

const emit = defineEmits<{
  (event: "submit-scheduled", input: SavePendingAppointmentInput): void;
  (event: "submit-backfilled", input: SaveBackfilledAppointmentInput): void;
  (event: "cancel-edit"): void;
}>();

/** 格式化本地日期供小程序日期选择器使用。 */
function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** 格式化本地时间供小程序时间选择器使用。 */
function formatLocalTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const currentTime = new Date();
const initialTime = new Date(currentTime);
initialTime.setMinutes(initialTime.getMinutes() + 30);
const form = reactive({
  entryMode: "scheduled" as AppointmentEntryMode,
  backfilledOutcome: "completed" as BackfilledOutcome,
  customerId: "",
  projectIds: [] as string[],
  date: formatLocalDate(initialTime),
  time: formatLocalTime(initialTime),
  addressText: "",
  addressNote: "",
  note: "",
  completedDate: formatLocalDate(currentTime),
  completedTime: formatLocalTime(currentTime),
  transactionAmountInput: "",
  actualUsageInputs: [] as AppointmentUsageDraft[],
  cancellationCategory: "",
  cancellationNote: "",
});
const keyboardHeight = shallowRef(0);
const usingCustomAddress = shallowRef(false);
const projectSelectorVisible = shallowRef(false);
const keyboardSpacerStyle = computed(() => ({
  height: `${keyboardSpacerHeight(keyboardHeight.value)}px`,
}));

/** 记录软键盘高度，为页面底部输入框补充可滚动空间。 */
function handleKeyboardHeightChange(event: {
  detail: { height?: number };
}): void {
  keyboardHeight.value = Math.max(0, Number(event.detail.height) || 0);
}

const customerNames = computed(() =>
  props.customers.map(({ nickname, phone }) => `${nickname}  ${phone}`),
);
const selectedCustomer = computed(() =>
  props.customers.find((customer) => customer.id === form.customerId),
);
const selectedProjects = computed(() =>
  form.projectIds
    .map((projectId) =>
      props.projects.find((project) => project.id === projectId),
    )
    .filter((project): project is DeepReadonly<BeautyProjectV1> => Boolean(project)),
);
const totalDurationMinutes = computed(() =>
  selectedProjects.value.reduce(
    (total, project) => total + project.durationMinutes,
    0,
  ),
);
const standardAmountCents = computed(() =>
  selectedProjects.value.reduce(
    (total, project) => total + project.standardPriceCents,
    0,
  ),
);
const addressLabels = computed(() =>
  (selectedCustomer.value?.addresses ?? []).map((address) =>
    address.note
      ? `${address.addressText} · ${address.note}`
      : address.addressText,
  ),
);
const addressOptions = computed(() => [
  ...addressLabels.value,
  "填写临时地址",
]);
const cancellationCategories = [
  "顾客临时有事",
  "身体不适",
  "时间冲突",
  "其他",
] as const;

/** 切换预约录入方式；编辑既有预约时始终保持正常预约。 */
function setEntryMode(mode: AppointmentEntryMode): void {
  if (props.submitting || props.editingAppointment) {
    return;
  }
  form.entryMode = mode;
  const now = new Date();
  if (mode === "backfilled") {
    form.date = formatLocalDate(now);
    form.time = formatLocalTime(now);
    form.completedDate = formatLocalDate(now);
    form.completedTime = formatLocalTime(now);
    if (form.backfilledOutcome === "completed") {
      resetActualUsagesFromProjects();
    }
  } else {
    const scheduled = new Date(now);
    scheduled.setMinutes(scheduled.getMinutes() + 30);
    form.date = formatLocalDate(scheduled);
    form.time = formatLocalTime(scheduled);
  }
}

/** 设置后补记录最终结果；默认并优先显示已完成。 */
function setBackfilledOutcome(outcome: BackfilledOutcome): void {
  if (props.submitting) {
    return;
  }
  form.backfilledOutcome = outcome;
  if (outcome === "completed") {
    resetActualUsagesFromProjects();
  }
}

/** 从选择器更新顾客并清空旧地址快照。 */
function selectCustomer(event: { detail: { value: string } }): void {
  form.customerId = props.customers[Number(event.detail.value)]?.id ?? "";
}

/** 添加一个不重复的服务项目并刷新后补完成默认用量。 */
/** 打开项目多选面板；保存期间不能修改预约项目组合。 */
function openProjectSelector(): void {
  if (!props.submitting) {
    projectSelectorVisible.value = true;
  }
}

/** 关闭项目多选面板并丢弃尚未确认的临时勾选。 */
function closeProjectSelector(): void {
  projectSelectorVisible.value = false;
}

/** 确认多选项目后统一刷新后补实际用量、金额与时长汇总。 */
function confirmProjectSelection(projectIds: string[]): void {
  const selectableIds = new Set(props.projects.map((project) => project.id));
  const nextProjectIds = projectIds.filter(
    (projectId, index) =>
      selectableIds.has(projectId) && projectIds.indexOf(projectId) === index,
  );
  const changed =
    nextProjectIds.length !== form.projectIds.length ||
    nextProjectIds.some((projectId, index) => projectId !== form.projectIds[index]);
  form.projectIds = nextProjectIds;
  projectSelectorVisible.value = false;
  if (changed) {
    resetActualUsagesFromProjects();
  }
}

/** 移除服务项目并重新合并项目默认用量。 */
function removeProject(projectId: string): void {
  form.projectIds = form.projectIds.filter((id) => id !== projectId);
  resetActualUsagesFromProjects();
}

/** 依据当前项目组合生成后补完成的可调整实际用量初始值。 */
function resetActualUsagesFromProjects(): void {
  form.actualUsageInputs = buildDefaultUsageDrafts(
    form.projectIds,
    props.projects,
    addDecimalQuantities,
  );
  if (form.entryMode === "backfilled" && form.backfilledOutcome === "completed") {
    const amountCents = form.projectIds.reduce((total, projectId) => {
      const project = props.projects.find(
        (candidate) => candidate.id === projectId,
      );
      return total + (project?.standardPriceCents ?? 0);
    }, 0);
    form.transactionAmountInput = (amountCents / 100).toFixed(2);
  }
}

/** 从顾客资料选取服务地址并立即形成表单快照。 */
function selectAddress(event: { detail: { value: string } }): void {
  const selectedIndex = Number(event.detail.value);
  const addresses = selectedCustomer.value?.addresses ?? [];
  if (selectedIndex === addresses.length) {
    form.addressText = "";
    form.addressNote = "";
    usingCustomAddress.value = true;
    return;
  }
  const address = addresses[selectedIndex];
  if (!address) {
    return;
  }
  form.addressText = address.addressText;
  form.addressNote = address.note ?? "";
  usingCustomAddress.value = false;
}

/** 打开快速新增顾客页；返回后父页面会自动刷新可选顾客。 */
function openCustomerCreate(): void {
  uni.navigateTo({ url: "/pages/customer-create/index" });
}

/** 拼装后补未完成的必填原因与可选补充说明。 */
function buildCancelReason(): string {
  const category = form.cancellationCategory.trim();
  const note = form.cancellationNote.trim();
  return category && note ? `${category}：${note}` : category || note;
}

/** 提交正常预约或直接落最终状态的后补预约。 */
function submit(): void {
  const scheduledAt = new Date(`${form.date}T${form.time}:00`).toISOString();
  const serviceAddress = {
    addressText: form.addressText,
    note: form.addressNote,
  };
  if (form.entryMode === "scheduled") {
    emit("submit-scheduled", {
      appointmentId: props.editingAppointment?.id,
      customerId: form.customerId,
      projectIds: [...form.projectIds],
      scheduledAt,
      serviceAddress,
      note: form.note,
    });
    return;
  }
  if (form.backfilledOutcome === "completed") {
    emit("submit-backfilled", {
      outcome: "completed",
      customerId: form.customerId,
      projectIds: [...form.projectIds],
      scheduledAt,
      serviceAddress,
      note: form.note,
      transactionAmountInput: form.transactionAmountInput,
      completedAt: new Date(
        `${form.completedDate}T${form.completedTime}:00`,
      ).toISOString(),
      actualUsageInputs: form.actualUsageInputs.map((usage) => ({ ...usage })),
    });
    return;
  }
  emit("submit-backfilled", {
    outcome: "cancelled",
    customerId: form.customerId,
    projectIds: [...form.projectIds],
    scheduledAt,
    serviceAddress,
    note: form.note,
    cancelReason: buildCancelReason(),
  });
}

/** 载入待执行预约用于编辑，正常预约不会显示实际用量字段。 */
function loadAppointment(
  appointment?: DeepReadonly<PendingAppointmentV1>,
): void {
  if (!appointment) {
    return;
  }
  const scheduledAt = new Date(appointment.scheduledAt);
  form.entryMode = "scheduled";
  form.customerId = appointment.customerId;
  form.projectIds = appointment.projectSnapshots.map(
    (snapshot) => snapshot.projectId,
  );
  form.date = formatLocalDate(scheduledAt);
  form.time = formatLocalTime(scheduledAt);
  form.addressText = appointment.serviceAddressSnapshot.addressText;
  form.addressNote = appointment.serviceAddressSnapshot.note ?? "";
  const customer = props.customers.find(
    (candidate) => candidate.id === appointment.customerId,
  );
  usingCustomAddress.value = !customer?.addresses.some(
    (address) =>
      address.addressText === appointment.serviceAddressSnapshot.addressText &&
      (address.note ?? "") === (appointment.serviceAddressSnapshot.note ?? ""),
  );
  form.note = appointment.note ?? "";
}

watch(
  () => form.customerId,
  (customerId, previousCustomerId) => {
    if (!previousCustomerId || customerId === props.editingAppointment?.customerId) {
      return;
    }
    form.addressText = "";
    form.addressNote = "";
    usingCustomAddress.value = false;
  },
);
watch(() => props.editingAppointment, loadAppointment, { immediate: true });
</script>

<template>
  <view class="appointment-form">
    <view v-if="!editingAppointment" class="form-card form-card--mode">
      <text class="form-card__title">预约类型</text>
      <view class="segmented-control" role="tablist" aria-label="预约类型">
        <view
          :class="[
            'segmented-control__item',
            {
              'segmented-control__item--active': form.entryMode === 'scheduled',
              'segmented-control__item--disabled': submitting,
            },
          ]"
          role="tab"
          :aria-selected="form.entryMode === 'scheduled'"
          :aria-disabled="submitting"
          hover-class="segmented-control__item--pressed"
          :hover-start-time="20"
          :hover-stay-time="80"
          @click="setEntryMode('scheduled')"
        >
          <u-icon v-if="form.entryMode === 'scheduled'" name="checkmark-circle-fill" color="#4c35dc" size="18" />
          正常预约
        </view>
        <view
          :class="[
            'segmented-control__item',
            {
              'segmented-control__item--active': form.entryMode === 'backfilled',
              'segmented-control__item--disabled': submitting,
            },
          ]"
          role="tab"
          :aria-selected="form.entryMode === 'backfilled'"
          :aria-disabled="submitting"
          hover-class="segmented-control__item--pressed"
          :hover-start-time="20"
          :hover-stay-time="80"
          @click="setEntryMode('backfilled')"
        >
          <u-icon v-if="form.entryMode === 'backfilled'" name="checkmark-circle-fill" color="#4c35dc" size="18" />
          后补预约
        </view>
      </view>
      <text class="form-card__hint">
        {{ form.entryMode === "scheduled" ? "正常预约用于安排待执行服务" : "用于补录此前遗漏的预约，保存后保留后补标识" }}
      </text>
    </view>

    <view v-if="form.entryMode === 'backfilled'" class="form-card">
      <text class="form-card__title">完成情况</text>
      <view class="segmented-control" role="tablist" aria-label="完成情况">
        <view
          :class="[
            'segmented-control__item',
            {
              'segmented-control__item--active': form.backfilledOutcome === 'completed',
              'segmented-control__item--disabled': submitting,
            },
          ]"
          role="tab"
          :aria-selected="form.backfilledOutcome === 'completed'"
          :aria-disabled="submitting"
          hover-class="segmented-control__item--pressed"
          :hover-start-time="20"
          :hover-stay-time="80"
          @click="setBackfilledOutcome('completed')"
        >
          <u-icon v-if="form.backfilledOutcome === 'completed'" name="checkmark-circle-fill" color="#4c35dc" size="18" />
          已完成
        </view>
        <view
          :class="[
            'segmented-control__item',
            {
              'segmented-control__item--active': form.backfilledOutcome === 'cancelled',
              'segmented-control__item--disabled': submitting,
            },
          ]"
          role="tab"
          :aria-selected="form.backfilledOutcome === 'cancelled'"
          :aria-disabled="submitting"
          hover-class="segmented-control__item--pressed"
          :hover-start-time="20"
          :hover-stay-time="80"
          @click="setBackfilledOutcome('cancelled')"
        >
          <u-icon v-if="form.backfilledOutcome === 'cancelled'" name="checkmark-circle-fill" color="#4c35dc" size="18" />
          未完成
        </view>
      </view>
      <text class="form-card__hint">
        {{ form.backfilledOutcome === "completed" ? "默认已完成；保存后直接扣减实际用量" : "未完成表示顾客取消，必须填写取消原因" }}
      </text>
    </view>

    <view class="form-card">
      <view class="form-card__heading">
        <text class="form-card__title">顾客与项目</text>
        <button class="form-card__outline-button" :disabled="submitting" @click="openCustomerCreate">快速新增顾客</button>
      </view>
      <text class="field-label">顾客 <text>*</text></text>
      <picker :range="customerNames" :disabled="submitting" @change="selectCustomer">
        <view class="field-control field-control--picker">
          <text>{{ selectedCustomer ? `${selectedCustomer.nickname}　${selectedCustomer.phone}` : "请选择顾客" }}</text>
          <u-icon name="arrow-right" color="#6f6a78" size="18" />
        </view>
      </picker>
      <text class="field-label">预约项目组合 <text>*</text></text>
      <view class="project-row">
        <view class="project-row__tags">
          <view v-for="project in selectedProjects" :key="project.id" class="project-tag">
            <text>{{ project.name }}</text>
            <button :disabled="submitting" aria-label="移除项目" @click="removeProject(project.id)">×</button>
          </view>
        </view>
        <button class="form-card__outline-button" :disabled="submitting" @click="openProjectSelector">
          选择项目
        </button>
      </view>
      <view class="project-summary">
        <view><text>预计总时长</text><strong>{{ totalDurationMinutes }} 分钟</strong></view>
        <view><text>标准金额</text><strong>¥{{ (standardAmountCents / 100).toFixed(2) }}</strong></view>
      </view>
    </view>

    <text v-if="form.entryMode === 'scheduled'" class="outside-hint">
      待执行预约按项目默认用量占用库存
    </text>

    <view class="form-card">
      <text class="form-card__title">{{ form.entryMode === "scheduled" ? "预约安排" : "时间与地址" }}</text>
      <text class="field-label">预约开始时间 <text>*</text></text>
      <view class="field-control field-control--datetime">
        <picker mode="date" :value="form.date" :disabled="submitting" @change="form.date = $event.detail.value">
          <view>{{ form.date }}</view>
        </picker>
        <picker mode="time" :value="form.time" :disabled="submitting" @change="form.time = $event.detail.value">
          <view>{{ form.time }}</view>
        </picker>
        <u-icon name="calendar" color="#676271" size="22" />
      </view>
      <text class="field-label">服务地址 <text>*</text></text>
      <picker v-if="addressLabels.length" :range="addressOptions" :disabled="submitting" @change="selectAddress">
        <view class="field-control field-control--picker">
          <text>{{ form.addressText || "从顾客地址中选择" }}</text>
          <u-icon name="arrow-right" color="#6f6a78" size="18" />
        </view>
      </picker>
      <input
        v-if="usingCustomAddress || !addressLabels.length"
        v-model="form.addressText"
        :disabled="submitting"
        class="field-control"
        maxlength="100"
        placeholder="填写本次临时服务地址"
      />
      <input v-model="form.addressNote" class="field-control field-control--secondary" :disabled="submitting" maxlength="50" placeholder="地址备注（选填）" />
      <text class="form-card__hint">保存后使用本次地址快照</text>
    </view>

    <view
      v-if="form.entryMode === 'backfilled' && form.backfilledOutcome === 'completed'"
      class="form-card"
    >
      <text class="form-card__title">完成信息</text>
      <text class="field-label">实际完成时间 <text>*</text></text>
      <view class="field-control field-control--datetime">
        <picker mode="date" :value="form.completedDate" :disabled="submitting" @change="form.completedDate = $event.detail.value">
          <view>{{ form.completedDate }}</view>
        </picker>
        <picker mode="time" :value="form.completedTime" :disabled="submitting" @change="form.completedTime = $event.detail.value">
          <view>{{ form.completedTime }}</view>
        </picker>
        <u-icon name="calendar" color="#676271" size="22" />
      </view>
      <text class="field-label">成交金额 <text>*</text></text>
      <view class="field-control field-control--money">
        <text>¥</text>
        <input v-model="form.transactionAmountInput" type="digit" :disabled="submitting" placeholder="0.00" />
      </view>
      <view class="section-heading">
        <view><text>本次实际用量</text><small>默认带出项目正常用量，可调整</small></view>
        <text>{{ form.actualUsageInputs.length }} 项</text>
      </view>
      <AppointmentUsageEditor
        v-model="form.actualUsageInputs"
        :inventory-items="inventoryItems"
        :disabled="submitting"
      />
    </view>

    <view
      v-if="form.entryMode === 'backfilled' && form.backfilledOutcome === 'cancelled'"
      class="form-card"
    >
      <text class="form-card__title">取消信息</text>
      <text class="form-card__hint">保存后成为已取消预约，不占用或扣减库存</text>
      <text class="field-label">取消原因 <text>*</text></text>
      <view class="reason-options">
        <button
          v-for="reason in cancellationCategories"
          :key="reason"
          :disabled="submitting"
          :class="{ 'reason-options__item--active': form.cancellationCategory === reason }"
          @click="form.cancellationCategory = reason"
        >
          <u-icon v-if="form.cancellationCategory === reason" name="checkmark-circle-fill" color="#4c35dc" size="17" />
          {{ reason }}
        </button>
      </view>
      <text class="field-label">补充说明（选填）</text>
      <textarea v-model="form.cancellationNote" :disabled="submitting" maxlength="200" placeholder="填写更具体的取消原因" />
    </view>

    <view class="form-card">
      <text class="field-label field-label--first">预约备注（选填）</text>
      <textarea
        v-model="form.note"
        :disabled="submitting"
        maxlength="300"
        placeholder="填写本次服务说明"
        @keyboardheightchange="handleKeyboardHeightChange"
      />
    </view>

    <view v-if="editingAppointment" class="appointment-form__edit-actions">
      <button :disabled="submitting" @click="emit('cancel-edit')">取消编辑</button>
      <button class="appointment-form__submit" :disabled="submitting" @click="submit">
        {{ submitting ? "正在保存" : "保存修改" }}
      </button>
    </view>
    <button v-else class="appointment-form__submit appointment-form__submit--full" :disabled="submitting" @click="submit">
      {{ submitting ? "正在保存" : "保存预约" }}
    </button>
    <view
      class="appointment-form__keyboard-spacer"
      :style="keyboardSpacerStyle"
      aria-hidden="true"
    />
    <AppointmentProjectMultiSelect
      :show="projectSelectorVisible"
      :projects="projects"
      :selected-project-ids="form.projectIds"
      :disabled="submitting"
      @confirm="confirmProjectSelection"
      @cancel="closeProjectSelector"
    />
  </view>
</template>

<style scoped>
.appointment-form { padding: 24rpx 28rpx calc(34rpx + env(safe-area-inset-bottom)); }
.form-card { margin-bottom: 20rpx; padding: 26rpx; border: 2rpx solid #f0edf3; border-radius: 20rpx; background: rgba(255, 255, 255, 0.96); box-shadow: 0 8rpx 24rpx rgba(42, 30, 62, 0.045); }
.form-card--mode { margin-top: 4rpx; }
.form-card__heading, .project-row, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; }
.form-card__title { color: #211d27; font-size: 30rpx; font-weight: 700; }
.form-card__hint, .outside-hint { display: block; color: #777181; font-size: 22rpx; line-height: 1.55; }
.form-card__hint { margin-top: 14rpx; }
.outside-hint { margin: -4rpx 4rpx 18rpx; }
.form-card__outline-button { display: flex; min-height: 58rpx; align-items: center; justify-content: center; box-sizing: border-box; padding: 0 18rpx; border: 2rpx solid #6548ed; border-radius: 10rpx; background: #fff; color: #4c34d8; font-size: 22rpx; line-height: 54rpx; }
.segmented-control { display: flex; overflow: hidden; margin-top: 18rpx; border: 2rpx solid #dfdbe6; border-radius: 12rpx; background: #fff; }
.segmented-control__item { display: flex; height: 72rpx; align-items: center; justify-content: center; gap: 8rpx; flex: 1; box-sizing: border-box; background: #fff; color: #706a7b; font-size: 25rpx; line-height: 1; }
.segmented-control__item + .segmented-control__item { border-left: 2rpx solid #dfdbe6; }
.segmented-control__item--active { background: #f2eeff; color: #4731d1; font-weight: 600; }
.segmented-control__item--pressed { opacity: 0.82; }
.segmented-control__item--disabled { opacity: 0.58; }
.field-label { display: block; margin-top: 24rpx; color: #2e2934; font-size: 24rpx; font-weight: 550; }
.field-label--first { margin-top: 0; }
.field-label text { color: #ff243a; }
.field-control { width: 100%; min-height: 76rpx; box-sizing: border-box; margin-top: 12rpx; padding: 0 18rpx; border: 2rpx solid #e1dde6; border-radius: 11rpx; background: #fff; color: #28232f; font-size: 24rpx; }
.field-control--picker, .field-control--datetime, .field-control--money { display: flex; align-items: center; }
.field-control--picker { justify-content: space-between; }
.field-control--picker text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.field-control--datetime { gap: 10rpx; }
.field-control--datetime picker { min-width: 0; padding: 22rpx 4rpx; flex: 1; }
.field-control--money input { min-width: 0; height: 72rpx; flex: 1; font-size: 24rpx; }
.field-control--secondary { margin-top: 10rpx; background: #fbfafc; }
.project-row { align-items: flex-start; margin-top: 12rpx; }
.project-row__tags { min-width: 0; flex: 1; }
.project-tag { display: inline-flex; align-items: center; gap: 6rpx; margin: 0 10rpx 10rpx 0; padding: 10rpx 12rpx; border-radius: 10rpx; background: #f1edff; color: #4430cf; font-size: 22rpx; }
.project-tag button { width: 32rpx; height: 32rpx; padding: 0; background: transparent; color: #4430cf; font-size: 28rpx; line-height: 28rpx; }
.project-summary { display: flex; margin-top: 20rpx; padding: 20rpx 0; border: 2rpx solid #ebe8f0; border-radius: 13rpx; background: #fdfcff; }
.project-summary view { display: flex; flex: 1; align-items: center; flex-direction: column; }
.project-summary view + view { border-left: 2rpx solid #e8e4ed; }
.project-summary text, .project-summary strong { display: block; }
.project-summary text { color: #817a8a; font-size: 21rpx; }
.project-summary strong { margin-top: 8rpx; color: #211d27; font-size: 27rpx; font-weight: 500; }
.section-heading { margin: 26rpx 0 14rpx; }
.section-heading view { display: flex; flex-direction: column; }
.section-heading > text { color: #696371; font-size: 22rpx; }
.section-heading view > text { color: #2d2833; font-size: 25rpx; font-weight: 650; }
.section-heading small { margin-top: 4rpx; color: #817a89; font-size: 19rpx; }
.reason-options { display: flex; gap: 10rpx; margin-top: 12rpx; flex-wrap: wrap; }
.reason-options button { display: flex; min-height: 62rpx; align-items: center; justify-content: center; gap: 6rpx; padding: 0 16rpx; border: 2rpx solid #e2dee8; border-radius: 10rpx; background: #fff; color: #615b6b; font-size: 21rpx; line-height: 58rpx; }
.reason-options .reason-options__item--active { border-color: #6547ed; background: #f8f5ff; color: #4731d3; }
.form-card textarea { width: 100%; min-height: 132rpx; box-sizing: border-box; margin-top: 12rpx; padding: 18rpx; border: 2rpx solid #e1dde6; border-radius: 11rpx; color: #2e2934; font-size: 23rpx; }
.appointment-form__edit-actions { display: flex; gap: 18rpx; }
.appointment-form__edit-actions button { height: 84rpx; flex: 1; border: 2rpx solid #5d41e7; border-radius: 14rpx; background: #fff; color: #4b34d3; font-size: 26rpx; line-height: 80rpx; }
.appointment-form__submit { border: 0 !important; background: linear-gradient(135deg, #5a3ce0, #4022d5) !important; color: #fff !important; line-height: 84rpx !important; }
.appointment-form__submit--full { width: 100%; height: 86rpx; border-radius: 14rpx; font-size: 28rpx; font-weight: 600; }
.appointment-form__keyboard-spacer { width: 100%; pointer-events: none; }
</style>
