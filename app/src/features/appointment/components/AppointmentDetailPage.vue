<script setup lang="ts">
import { computed, onMounted, shallowRef, type DeepReadonly } from "vue";
import type {
  AppointmentV1,
  CompletedAppointmentV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";
import type {
  AppointmentManagementService,
  CancelAppointmentInput,
  CompleteAppointmentInput,
} from "@/services/appointment-management-service";
import { addDecimalQuantities } from "@/utils/decimal-quantity";
import { buildCompletionUsageDrafts } from "../appointment-form-state";
import { useAppointmentManagement } from "../composables/useAppointmentManagement";
import AppointmentCancellationForm from "./AppointmentCancellationForm.vue";
import AppointmentCompletionForm from "./AppointmentCompletionForm.vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";

interface AppointmentDetailPageProps {
  /** 页面可调用的预约管理窄用例。 */
  service: AppointmentManagementService;
  /** 路由指定的预约标识。 */
  appointmentId: string;
}

const props = defineProps<AppointmentDetailPageProps>();

const {
  customers,
  projects,
  inventoryItems,
  activeInventoryItems,
  appointmentsByStatus,
  loading,
  submitting,
  errorMessage,
  errorKind,
  clearError,
  refresh,
  cancelAppointment,
  restoreCancelledAppointment,
  completeAppointment,
  correctCompletedAppointment,
  revertCompletedAppointment,
  deleteAppointment,
} = useAppointmentManagement(props.service);

const completingAppointment = shallowRef<
  DeepReadonly<PendingAppointmentV1 | CompletedAppointmentV1> | undefined
>();
const cancellingAppointment = shallowRef<
  DeepReadonly<PendingAppointmentV1> | undefined
>();
const appointment = computed(() =>
  appointmentsByStatus.value.find(
    (candidate) => candidate.id === props.appointmentId,
  ),
);
const customer = computed(() =>
  customers.value.find(
    (candidate) => candidate.id === appointment.value?.customerId,
  ),
);
/** 为正常预约完成弹层提供预计用量快照，旧记录为空时回退项目正常用量。 */
const completionDefaultUsageInputs = computed(() => {
  const current = completingAppointment.value;
  return buildCompletionUsageDrafts(
    current?.actualUsages ?? [],
    current?.projectSnapshots.map((project) => project.projectId) ?? [],
    projects.value,
    addDecimalQuantities,
  );
});

const completionInventoryItems = computed(() => {
  const referencedIds = new Set(
    completionDefaultUsageInputs.value.map(
      (usage) => usage.inventoryItemId,
    ) ?? [],
  );
  return [
    ...activeInventoryItems.value,
    ...inventoryItems.value.filter(
      (item) =>
        referencedIds.has(item.id) &&
        !activeInventoryItems.value.some(
          (candidate) => candidate.id === item.id,
        ),
    ),
  ];
});

/** 格式化详情页的完整本地日期时间。 */
function formatDateTime(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** 根据当前时间派生逾期展示，不新增持久化状态。 */
function isOverdue(value: DeepReadonly<AppointmentV1>): boolean {
  return (
    value.status === "pending" &&
    new Date(value.scheduledAt).getTime() < Date.now()
  );
}

/** 返回详情页状态文案。 */
function statusLabel(value: DeepReadonly<AppointmentV1>): string {
  if (isOverdue(value)) {
    return "已逾期";
  }
  if (value.recordOrigin === "backfilled" && value.status === "cancelled") {
    return "未完成";
  }
  return value.status === "pending"
    ? "待执行"
    : value.status === "completed"
      ? "已完成"
      : "已取消";
}

/** 进入正常待执行预约编辑页。 */
function openEdit(): void {
  if (!appointment.value || appointment.value.status !== "pending") {
    return;
  }
  uni.navigateTo({
    url: `/pages/appointment-create/index?appointmentId=${encodeURIComponent(appointment.value.id)}`,
  });
}

/** 打开完成或更正弹层，并丢弃上一次操作错误。 */
function openCompletion(
  current: DeepReadonly<PendingAppointmentV1 | CompletedAppointmentV1>,
): void {
  clearError();
  completingAppointment.value = current;
}

/** 打开取消弹层，并丢弃上一次操作错误。 */
function openCancellation(current: DeepReadonly<PendingAppointmentV1>): void {
  clearError();
  cancellingAppointment.value = current;
}

/** 提交完成或完成信息更正。 */
async function submitCompletion(
  input: CompleteAppointmentInput,
): Promise<void> {
  const correcting = completingAppointment.value?.status === "completed";
  const saved = correcting
    ? await correctCompletedAppointment(input)
    : await completeAppointment(input);
  if (saved) {
    completingAppointment.value = undefined;
    uni.showToast({
      title: correcting ? "完成信息已更正" : "预约已完成",
      icon: "success",
    });
  }
}

/** 提交取消原因并释放正常预约预计占用。 */
async function submitCancellation(
  input: CancelAppointmentInput,
): Promise<void> {
  if (await cancelAppointment(input)) {
    cancellingAppointment.value = undefined;
    uni.showToast({ title: "预约已取消", icon: "success" });
  }
}

/** 恢复正常取消记录；后补取消记录不会展示此入口。 */
function confirmRestore(): void {
  const current = appointment.value;
  if (!current || current.status !== "cancelled") {
    return;
  }
  uni.showModal({
    title: "恢复取消",
    content: "恢复后将重新成为待执行预约并占用预计库存。",
    confirmText: "确认恢复",
    success(result) {
      if (result.confirm) {
        void restoreCancelledAppointment(current.id).then((saved) => {
          if (saved) {
            uni.showToast({ title: "已恢复待执行", icon: "success" });
          }
        });
      }
    },
  });
}

/** 撤销正常完成记录；后补完成记录不会展示此入口。 */
function confirmRevertCompletion(): void {
  const current = appointment.value;
  if (!current || current.status !== "completed") {
    return;
  }
  uni.showModal({
    title: "撤销完成",
    content: "将补回实际消耗并恢复为待执行预约。",
    confirmText: "确认撤销",
    success(result) {
      if (result.confirm) {
        void revertCompletedAppointment(current.id).then((saved) => {
          if (saved) {
            uni.showToast({ title: "已恢复待执行", icon: "success" });
          }
        });
      }
    },
  });
}

/** 按预约状态提示影响后彻底删除误建记录。 */
function confirmDelete(): void {
  const current = appointment.value;
  if (!current) {
    return;
  }
  const content =
    current.status === "completed"
      ? "删除后不会补回已消耗库存，库存动态会保留并标记来源已删除。"
      : current.status === "pending"
        ? "删除后立即释放预计库存占用，仅用于彻底删除误建预约。"
        : "删除后取消原因和预约记录将无法恢复。";
  uni.showModal({
    title: "彻底删除预约",
    content,
    confirmText: "彻底删除",
    confirmColor: "#ef3043",
    success(result) {
      if (!result.confirm) {
        return;
      }
      void deleteAppointment(current.id).then((deleted) => {
        if (deleted) {
          uni.showToast({ title: "预约已删除", icon: "success" });
          setTimeout(() => uni.navigateBack(), 300);
        }
      });
    },
  });
}

onMounted(refresh);
defineExpose({ refresh });
</script>

<template>
  <view class="appointment-detail">
    <RecoverableErrorNotice
      v-if="errorMessage"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="refresh"
    />
    <view v-if="loading" class="appointment-detail__state">正在读取预约详情</view>
    <view v-else-if="!appointment" class="appointment-detail__state">
      预约不存在或已被删除
    </view>
    <template v-else>
      <view class="detail-hero">
        <view class="detail-hero__heading">
          <view>
            <text class="detail-hero__customer">{{ customer?.nickname ?? "顾客资料不可用" }}</text>
            <text class="detail-hero__phone">{{ customer?.phone ?? "" }}</text>
          </view>
          <view class="detail-hero__badges">
            <text v-if="appointment.recordOrigin === 'backfilled'" class="detail-hero__origin">后补</text>
            <text
              class="detail-hero__status"
              :class="{ 'detail-hero__status--danger': isOverdue(appointment) || appointment.status === 'cancelled' }"
            >
              {{ statusLabel(appointment) }}
            </text>
          </view>
        </view>
        <view class="detail-hero__schedule" :class="{ 'detail-hero__schedule--danger': isOverdue(appointment) }">
          <u-icon name="calendar" :color="isOverdue(appointment) ? '#f22638' : '#4b32da'" size="24" />
          <text>{{ formatDateTime(appointment.scheduledAt) }}</text>
        </view>
        <view class="detail-hero__summary">
          <view><text>预计总时长</text><strong>{{ appointment.estimatedDurationMinutes }} 分钟</strong></view>
          <view><text>标准金额</text><strong>¥{{ (appointment.standardAmountCents / 100).toFixed(2) }}</strong></view>
        </view>
        <view v-if="appointment.status === 'pending'" class="detail-hero__actions">
          <button @click="openEdit">编辑预约</button>
          <button class="detail-hero__primary" @click="openCompletion(appointment)">完成预约</button>
        </view>
      </view>

      <view class="detail-card">
        <text class="detail-card__title">预约信息</text>
        <view class="detail-row">
          <view class="detail-row__label">
            <u-icon name="list" color="#4d33df" size="22" />
            <text>项目组合</text>
          </view>
          <text class="detail-row__value">{{ appointment.projectSnapshots.map((project) => project.name).join("、") }}</text>
        </view>
        <view class="detail-row">
          <view class="detail-row__label">
            <u-icon name="map" color="#4d33df" size="22" />
            <text>服务地址</text>
          </view>
          <text class="detail-row__value">{{ appointment.serviceAddressSnapshot.addressText }}</text>
        </view>
        <view class="detail-row">
          <view class="detail-row__label">
            <u-icon name="file-text" color="#4d33df" size="22" />
            <text>预约备注</text>
          </view>
          <text class="detail-row__value">{{ appointment.note || "无" }}</text>
        </view>
        <view v-if="appointment.status === 'completed'" class="detail-row">
          <view class="detail-row__label">
            <u-icon name="rmb-circle" color="#4d33df" size="22" />
            <text>成交金额</text>
          </view>
          <text class="detail-row__value">¥{{ (appointment.transactionAmountCents / 100).toFixed(2) }}</text>
        </view>
        <view v-if="appointment.status === 'completed'" class="detail-row">
          <view class="detail-row__label">
            <u-icon name="clock" color="#4d33df" size="22" />
            <text>完成时间</text>
          </view>
          <text class="detail-row__value">{{ formatDateTime(appointment.completedAt) }}</text>
        </view>
        <view v-if="appointment.status === 'cancelled'" class="detail-row detail-row--danger">
          <view class="detail-row__label">
            <u-icon name="close-circle" color="#ef3043" size="22" />
            <text>取消原因</text>
          </view>
          <text class="detail-row__value">{{ appointment.cancelReason || "历史记录未填写" }}</text>
        </view>
      </view>

      <view class="detail-card">
        <view class="detail-card__heading">
          <view>
            <text class="detail-card__title">
              {{ appointment.status === "completed" ? "本次实际用量" : "预计占用" }}
            </text>
            <text class="detail-card__hint">
              {{ appointment.status === "completed" ? "已按以下用量扣减库存" : appointment.status === "pending" ? "按项目默认用量计算，完成时确认实际用量" : "取消后已释放库存占用" }}
            </text>
          </view>
          <text>{{ appointment.actualUsages.length }} 项</text>
        </view>
        <view v-if="!appointment.actualUsages.length" class="detail-card__empty">无库存用量</view>
        <view v-for="usage in appointment.actualUsages" :key="usage.inventoryItemId" class="usage-row">
          <text>{{ usage.itemNameSnapshot }}</text>
          <strong>{{ usage.quantity }} {{ usage.unitSnapshot }}</strong>
        </view>
      </view>

      <view class="detail-card detail-card--operations">
        <text class="detail-card__title">预约操作</text>
        <template v-if="appointment.status === 'pending'">
          <button @click="openEdit"><u-icon name="calendar" color="#4d33df" size="22" /><text>改期或编辑</text><u-icon name="arrow-right" color="#6f6976" size="18" /></button>
          <button class="operation-danger" @click="openCancellation(appointment)"><u-icon name="close-circle" color="#ef3043" size="22" /><text>取消预约</text><u-icon name="arrow-right" color="#6f6976" size="18" /></button>
        </template>
        <template v-else-if="appointment.status === 'completed'">
          <button @click="openCompletion(appointment)"><u-icon name="edit-pen" color="#4d33df" size="22" /><text>更正完成信息</text><u-icon name="arrow-right" color="#6f6976" size="18" /></button>
          <button v-if="appointment.recordOrigin !== 'backfilled'" @click="confirmRevertCompletion"><u-icon name="reload" color="#4d33df" size="22" /><text>撤销完成</text><u-icon name="arrow-right" color="#6f6976" size="18" /></button>
        </template>
        <button v-else-if="appointment.recordOrigin !== 'backfilled'" @click="confirmRestore"><u-icon name="reload" color="#4d33df" size="22" /><text>恢复为待执行</text><u-icon name="arrow-right" color="#6f6976" size="18" /></button>
        <button class="operation-danger" @click="confirmDelete"><u-icon name="trash" color="#ef3043" size="22" /><text>彻底删除误建预约</text><u-icon name="arrow-right" color="#6f6976" size="18" /></button>
      </view>
    </template>

    <AppointmentCompletionForm
      v-if="completingAppointment"
      :appointment="completingAppointment"
      :inventory-items="completionInventoryItems"
      :default-usage-inputs="completionDefaultUsageInputs"
      :submitting="submitting"
      :error-message="errorMessage"
      @submit="submitCompletion"
      @change="clearError"
      @cancel="completingAppointment = undefined"
    />
    <AppointmentCancellationForm
      v-if="cancellingAppointment"
      :appointment="cancellingAppointment"
      :submitting="submitting"
      :error-message="errorMessage"
      @submit="submitCancellation"
      @change="clearError"
      @cancel="cancellingAppointment = undefined"
    />
  </view>
</template>

<style scoped>
.appointment-detail { min-height: 100vh; box-sizing: border-box; padding: 24rpx 28rpx calc(38rpx + env(safe-area-inset-bottom)); background: #fbf8fb; }
.appointment-detail__state { padding: 80rpx 30rpx; color: #827b88; font-size: 24rpx; text-align: center; }
.detail-hero, .detail-card { margin-bottom: 20rpx; padding: 30rpx; border: 2rpx solid #f0ecf2; border-radius: 22rpx; background: #fff; box-shadow: 0 10rpx 28rpx rgba(43, 30, 59, 0.05); }
.detail-hero__heading, .detail-hero__badges, .detail-hero__schedule, .detail-hero__summary, .detail-hero__actions, .detail-card__heading, .detail-row, .usage-row { display: flex; align-items: center; }
.detail-hero__heading, .detail-card__heading, .usage-row { justify-content: space-between; gap: 18rpx; }
.detail-hero__heading > view:first-child { display: flex; min-width: 0; flex-direction: column; }
.detail-hero__customer { color: #16131a; font-size: 38rpx; font-weight: 700; }
.detail-hero__phone { margin-top: 6rpx; color: #635d69; font-size: 24rpx; }
.detail-hero__badges { gap: 10rpx; }
.detail-hero__origin, .detail-hero__status { padding: 10rpx 14rpx; border-radius: 10rpx; font-size: 22rpx; }
.detail-hero__origin { background: #eee8ff; color: #4d32da; }
.detail-hero__status { background: #e9f5ef; color: #188b5e; }
.detail-hero__status--danger { background: #ffe8ea; color: #ef2638; }
.detail-hero__schedule { gap: 14rpx; margin-top: 28rpx; color: #4930d8; font-size: 29rpx; }
.detail-hero__schedule--danger { color: #ef2638; }
.detail-hero__summary { margin-top: 28rpx; padding-top: 26rpx; border-top: 2rpx solid #ebe7ed; }
.detail-hero__summary view { display: flex; flex: 1; align-items: center; flex-direction: column; }
.detail-hero__summary view + view { border-left: 2rpx solid #e6e2e9; }
.detail-hero__summary text { color: #79727f; font-size: 22rpx; }
.detail-hero__summary strong { margin-top: 8rpx; color: #4930d8; font-size: 33rpx; font-weight: 500; }
.detail-hero__actions { gap: 22rpx; margin-top: 28rpx; }
.detail-hero__actions button { height: 82rpx; flex: 1; border: 2rpx solid #5336e2; border-radius: 13rpx; background: #fff; color: #4a31d4; font-size: 26rpx; line-height: 78rpx; }
.detail-hero__actions .detail-hero__primary { border: 0; background: linear-gradient(135deg, #5a38e2, #4020d5); color: #fff; line-height: 82rpx; }
.detail-card__title { color: #211c27; font-size: 29rpx; font-weight: 700; }
.detail-card__heading > view { display: flex; flex-direction: column; }
.detail-card__heading > text { color: #615b68; font-size: 22rpx; }
.detail-card__hint { margin-top: 7rpx; color: #807986; font-size: 20rpx; }
.detail-row { min-height: 72rpx; align-items: flex-start; justify-content: space-between; gap: 18rpx; padding: 12rpx 0; border-bottom: 2rpx solid #efebf1; color: #5f5966; font-size: 23rpx; }
.detail-row:last-child { border-bottom: 0; }
.detail-row__label { display: flex; width: 152rpx; flex: none; align-items: center; gap: 14rpx; padding-top: 3rpx; }
.detail-row__value { min-width: 0; flex: 1; color: #39333f; font-size: 27rpx; line-height: 1.45; text-align: right; overflow-wrap: anywhere; }
.detail-row--danger .detail-row__value { color: #d83b49; }
.usage-row { min-height: 72rpx; border-bottom: 2rpx solid #efebf1; color: #39333f; font-size: 23rpx; }
.usage-row:last-child { border-bottom: 0; }
.usage-row strong { font-weight: 500; }
.detail-card__empty { padding: 28rpx 0 4rpx; color: #8b8490; font-size: 22rpx; text-align: center; }
.detail-card--operations button { display: flex; width: 100%; height: 78rpx; align-items: center; gap: 14rpx; padding: 0; border-bottom: 2rpx solid #efebf1; background: transparent; color: #4d33df; font-size: 24rpx; line-height: 78rpx; text-align: left; }
.detail-card--operations button:last-child { border-bottom: 0; }
.detail-card--operations button text { flex: 1; }
.detail-card--operations .operation-danger { color: #ef3043; }
</style>
