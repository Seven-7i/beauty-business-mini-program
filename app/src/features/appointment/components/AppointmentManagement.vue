<script setup lang="ts">
import { computed, onMounted, shallowRef, type DeepReadonly } from "vue";
import type {
  AppointmentStatus,
  AppointmentV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";
import type {
  AppointmentManagementService,
  CompleteAppointmentInput,
} from "@/services/appointment-management-service";
import { addDecimalQuantities } from "@/utils/decimal-quantity";
import { buildCompletionUsageDrafts } from "../appointment-form-state";
import { useAppointmentManagement } from "../composables/useAppointmentManagement";
import AppointmentCompletionForm from "./AppointmentCompletionForm.vue";
import AppointmentList from "./AppointmentList.vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";

interface AppointmentManagementProps {
  /** 页面可调用的预约管理窄用例。 */
  service: AppointmentManagementService;
  /** 从库存动态进入时直接定位的来源预约。 */
  initialAppointmentId?: string;
}

const props = defineProps<AppointmentManagementProps>();
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
  completeAppointment,
} = useAppointmentManagement(props.service);

const query = shallowRef("");
const activeStatus = shallowRef<AppointmentStatus>("pending");
const completingAppointment = shallowRef<
  DeepReadonly<PendingAppointmentV1> | undefined
>();

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

const statusCounts = computed(() => ({
  pending: appointmentsByStatus.value.filter(
    (appointment) => appointment.status === "pending",
  ).length,
  completed: appointmentsByStatus.value.filter(
    (appointment) => appointment.status === "completed",
  ).length,
  cancelled: appointmentsByStatus.value.filter(
    (appointment) => appointment.status === "cancelled",
  ).length,
}));

const visibleAppointments = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  return appointmentsByStatus.value.filter((appointment) => {
    if (appointment.status !== activeStatus.value) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    const customer = customers.value.find(
      (candidate) => candidate.id === appointment.customerId,
    );
    return [
      customer?.nickname,
      customer?.phone,
      ...appointment.projectSnapshots.map((project) => project.name),
    ].some((value) => value?.toLowerCase().includes(keyword));
  });
});

/** 完成弹层保留预计用量引用的停用物品，同时只允许新增启用物品。 */
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

/** 打开统一新增预约页面。 */
function openCreate(): void {
  uni.navigateTo({ url: "/pages/appointment-create/index" });
}

/** 打开独立预约详情页。 */
function openDetail(appointment: DeepReadonly<AppointmentV1>): void {
  uni.navigateTo({
    url: `/pages/appointment-detail/index?appointmentId=${encodeURIComponent(appointment.id)}`,
  });
}

/** 打开正常预约完成弹层。 */
function openCompletion(
  appointment: DeepReadonly<PendingAppointmentV1>,
): void {
  clearError();
  completingAppointment.value = appointment;
}

/** 提交完成信息并关闭弹层。 */
async function submitCompletion(
  input: CompleteAppointmentInput,
): Promise<void> {
  if (await completeAppointment(input)) {
    completingAppointment.value = undefined;
    uni.showToast({ title: "预约已完成", icon: "success" });
  }
}

/** 首次读取并处理库存动态传入的预约定位。 */
async function initialize(): Promise<void> {
  await refresh();
  if (!props.initialAppointmentId) {
    return;
  }
  const source = appointmentsByStatus.value.find(
    (appointment) => appointment.id === props.initialAppointmentId,
  );
  if (source?.status === "completed") {
    openDetail(source);
  } else {
    uni.showToast({ title: "来源预约不可用", icon: "none" });
  }
}

onMounted(initialize);
defineExpose({ refresh });
</script>

<template>
  <view class="appointment-management">
    <view class="appointment-management__toolbar">
      <view class="appointment-management__search">
        <u-icon name="search" color="#66616d" size="24" />
        <input v-model="query" placeholder="搜索顾客或项目" confirm-type="search" />
      </view>
      <button class="appointment-management__create" @click="openCreate">
        <u-icon name="plus" color="#ffffff" size="14" />
        <text>新增</text>
      </button>
    </view>

    <view class="status-tabs">
      <button
        :class="{ 'status-tabs__item--active': activeStatus === 'pending' }"
        @click="activeStatus = 'pending'"
      >
        待执行 {{ statusCounts.pending }}
      </button>
      <button
        :class="{ 'status-tabs__item--active': activeStatus === 'completed' }"
        @click="activeStatus = 'completed'"
      >
        已完成 {{ statusCounts.completed }}
      </button>
      <button
        :class="{ 'status-tabs__item--active': activeStatus === 'cancelled' }"
        @click="activeStatus = 'cancelled'"
      >
        已取消 {{ statusCounts.cancelled }}
      </button>
    </view>

    <RecoverableErrorNotice
      v-if="errorMessage"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="refresh"
    />
    <view v-if="loading" class="appointment-management__loading">正在读取本机预约</view>
    <AppointmentList
      v-else
      :appointments="visibleAppointments"
      :customers="customers"
      :disabled="submitting"
      @open-detail="openDetail"
      @complete="openCompletion"
    />
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
  </view>
</template>

<style scoped>
.appointment-management { min-height: 100vh; box-sizing: border-box; padding: 26rpx 28rpx calc(40rpx + env(safe-area-inset-bottom)); background: #fbf8fb; }
.appointment-management__toolbar { display: flex; gap: 20rpx; }
.appointment-management__search { display: flex; height: 86rpx; min-width: 0; align-items: center; gap: 14rpx; padding: 0 22rpx; flex: 1; border: 2rpx solid #f0ebf2; border-radius: 18rpx; background: #fff; box-shadow: 0 8rpx 22rpx rgba(49, 35, 62, 0.04); }
.appointment-management__search input { min-width: 0; height: 80rpx; flex: 1; color: #29242e; font-size: 25rpx; }
.appointment-management__create { display: flex; width: 152rpx; height: 86rpx; align-items: center; justify-content: center; gap: 10rpx; border-radius: 18rpx; background: linear-gradient(135deg, #6041df, #4526d4); color: #fff; font-size: 25rpx; line-height: 86rpx; }
.status-tabs { display: flex; margin-top: 24rpx; padding: 8rpx; border: 2rpx solid #f0ebf2; border-radius: 18rpx; background: #fff; }
.status-tabs button { height: 70rpx; flex: 1; border-radius: 13rpx; background: transparent; color: #17141b; font-size: 24rpx; line-height: 70rpx; }
.status-tabs .status-tabs__item--active { background: #f1edfb; color: #432bd0; font-weight: 600; }
.appointment-management__loading { margin-top: 20rpx; padding: 34rpx; border-radius: 16rpx; background: #fff; color: #7e7785; font-size: 23rpx; text-align: center; }
</style>
