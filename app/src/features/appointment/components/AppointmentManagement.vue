<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, type DeepReadonly } from "vue";
import type {
  AppointmentV1,
  CancelledAppointmentV1,
  CompletedAppointmentV1,
  PendingAppointmentV1,
} from "@/domain/data-schema";
import type {
  AppointmentManagementService,
  CancelAppointmentInput,
  CompleteAppointmentInput,
  SavePendingAppointmentInput,
} from "@/services/appointment-management-service";
import { useAppointmentManagement } from "../composables/useAppointmentManagement";
import AppointmentCancellationForm from "./AppointmentCancellationForm.vue";
import AppointmentCompletionForm from "./AppointmentCompletionForm.vue";
import AppointmentForm from "./AppointmentForm.vue";
import AppointmentList from "./AppointmentList.vue";

const props = defineProps<{ service: AppointmentManagementService }>();
const {
  customers,
  projects,
  inventoryItems,
  activeCustomers,
  activeProjects,
  activeInventoryItems,
  appointmentsByStatus,
  loading,
  submitting,
  errorMessage,
  refresh,
  savePendingAppointment,
  cancelAppointment,
  restoreCancelledAppointment,
  completeAppointment,
  correctCompletedAppointment,
  revertCompletedAppointment,
  deleteAppointment,
} = useAppointmentManagement(props.service);
const appointmentForm = ref<InstanceType<typeof AppointmentForm> | null>(null);
const completingAppointment = shallowRef<
  DeepReadonly<PendingAppointmentV1 | CompletedAppointmentV1> | undefined
>();
const cancellingAppointment = shallowRef<
  DeepReadonly<PendingAppointmentV1> | undefined
>();
const editingAppointment = shallowRef<
  DeepReadonly<PendingAppointmentV1> | undefined
>();

/** 编辑旧预约时把其已停用引用补回显示集合；这些对象不会出现在新预约选择中。 */
const editingCustomers = computed(() => {
  const referenced = customers.value.find(
    (customer) => customer.id === editingAppointment.value?.customerId,
  );
  return referenced && !activeCustomers.value.some(({ id }) => id === referenced.id)
    ? [...activeCustomers.value, referenced]
    : activeCustomers.value;
});
const editingProjects = computed(() => {
  const ids = new Set(
    editingAppointment.value?.projectSnapshots.map(({ projectId }) => projectId) ?? [],
  );
  return [
    ...activeProjects.value,
    ...projects.value.filter(
      (project) =>
        ids.has(project.id) &&
        !activeProjects.value.some(({ id }) => id === project.id),
    ),
  ];
});
const editingInventoryItems = computed(() => {
  const ids = new Set(
    editingAppointment.value?.actualUsages.map(({ inventoryItemId }) =>
      inventoryItemId,
    ) ?? [],
  );
  return [
    ...activeInventoryItems.value,
    ...inventoryItems.value.filter(
      (item) =>
        ids.has(item.id) &&
        !activeInventoryItems.value.some(({ id }) => id === item.id),
    ),
  ];
});

async function submit(input: SavePendingAppointmentInput): Promise<void> {
  const result = await savePendingAppointment(input);
  if (result.kind === "saved") {
    editingAppointment.value = undefined;
    appointmentForm.value?.reset();
    uni.showToast({ title: "预约已保存", icon: "success" });
    return;
  }
  if (result.kind === "conflict") {
    uni.showModal({
      title: "预约时间有冲突",
      content: `与 ${result.count} 条待执行预约时间重叠，仍要继续保存吗？`,
      confirmText: "仍然保存",
      success(modalResult) {
        if (modalResult.confirm) {
          void savePendingAppointment({
            ...result.input,
            confirmTimeConflict: true,
          }).then((confirmed) => {
            if (confirmed.kind === "saved") {
              editingAppointment.value = undefined;
              appointmentForm.value?.reset();
              uni.showToast({ title: "预约已保存", icon: "success" });
            }
          });
        }
      },
    });
  }
}

function openCompletion(
  appointment: DeepReadonly<PendingAppointmentV1>,
): void {
  cancellingAppointment.value = undefined;
  editingAppointment.value = undefined;
  completingAppointment.value = appointment;
}

function openCancellation(
  appointment: DeepReadonly<PendingAppointmentV1>,
): void {
  completingAppointment.value = undefined;
  editingAppointment.value = undefined;
  cancellingAppointment.value = appointment;
}

function openEdit(appointment: DeepReadonly<PendingAppointmentV1>): void {
  completingAppointment.value = undefined;
  cancellingAppointment.value = undefined;
  editingAppointment.value = appointment;
}

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

async function submitCancellation(
  input: CancelAppointmentInput,
): Promise<void> {
  if (await cancelAppointment(input)) {
    cancellingAppointment.value = undefined;
    uni.showToast({ title: "预约已取消", icon: "success" });
  }
}

function confirmRestore(
  appointment: DeepReadonly<CancelledAppointmentV1>,
): void {
  uni.showModal({
    title: "恢复取消",
    content: "恢复后将重新占用库存；库存不足时不会改变当前取消状态。",
    confirmText: "确认恢复",
    success(modalResult) {
      if (!modalResult.confirm) {
        return;
      }
      void restoreCancelledAppointment(appointment.id).then((restored) => {
        if (restored) {
          uni.showToast({ title: "已恢复为待执行", icon: "success" });
        }
      });
    },
  });
}

function confirmRevertCompletion(
  appointment: DeepReadonly<CompletedAppointmentV1>,
): void {
  uni.showModal({
    title: "撤销完成",
    content: "将补回该预约消耗并恢复待执行占用；这与删除已完成预约不同。",
    confirmText: "确认撤销",
    success(modalResult) {
      if (!modalResult.confirm) {
        return;
      }
      void revertCompletedAppointment(appointment.id).then((reverted) => {
        if (reverted) {
          uni.showToast({ title: "已恢复为待执行", icon: "success" });
        }
      });
    },
  });
}

function openCorrection(
  appointment: DeepReadonly<CompletedAppointmentV1>,
): void {
  cancellingAppointment.value = undefined;
  editingAppointment.value = undefined;
  completingAppointment.value = appointment;
}

function confirmDelete(appointment: DeepReadonly<AppointmentV1>): void {
  const content =
    appointment.status === "completed"
      ? "删除后不补回已消耗库存，预约消耗记录会保留并标记来源已删除。"
      : appointment.status === "pending"
        ? "仅误建预约应彻底删除；删除后会立即释放库存占用。"
        : "删除后取消原因和该预约记录将无法恢复。";
  uni.showModal({
    title: "彻底删除预约",
    content,
    confirmText: "彻底删除",
    confirmColor: "#9a4a47",
    success(modalResult) {
      if (!modalResult.confirm) {
        return;
      }
      void deleteAppointment(appointment.id).then((deleted) => {
        if (!deleted) {
          return;
        }
        if (completingAppointment.value?.id === appointment.id) {
          completingAppointment.value = undefined;
        }
        if (cancellingAppointment.value?.id === appointment.id) {
          cancellingAppointment.value = undefined;
        }
        if (editingAppointment.value?.id === appointment.id) {
          editingAppointment.value = undefined;
        }
        uni.showToast({ title: "预约已删除", icon: "success" });
      });
    },
  });
}

onMounted(refresh);
</script>

<template>
  <view class="appointment-management">
    <view class="appointment-management__intro">
      <text class="appointment-management__eyebrow">美容 · 预约执行</text>
      <text class="appointment-management__title">预约</text>
      <text class="appointment-management__description">待执行预约占用库存但不扣减；时间重叠会警告并允许确认保存。</text>
    </view>
    <view v-if="(!activeCustomers.length || !activeProjects.length) && !editingAppointment" class="appointment-management__prerequisite">
      新增预约前，请先准备至少一位启用顾客和一个启用服务项目。
    </view>
    <AppointmentForm v-else ref="appointmentForm" :customers="editingCustomers" :projects="editingProjects" :inventory-items="editingInventoryItems" :submitting="submitting" :editing-appointment="editingAppointment" @submit="submit" @cancel-edit="editingAppointment = undefined" />
    <AppointmentCompletionForm v-if="completingAppointment" :appointment="completingAppointment" :inventory-items="activeInventoryItems" :submitting="submitting" @submit="submitCompletion" @cancel="completingAppointment = undefined" />
    <AppointmentCancellationForm v-if="cancellingAppointment" :appointment="cancellingAppointment" :submitting="submitting" @submit="submitCancellation" @cancel="cancellingAppointment = undefined" />
    <view v-if="errorMessage" class="appointment-management__error" role="alert">{{ errorMessage }}</view>
    <view v-if="loading" class="appointment-management__loading">正在读取本机预约</view>
    <AppointmentList v-else :appointments="appointmentsByStatus" :customers="customers" :disabled="submitting" @edit="openEdit" @complete="openCompletion" @cancel="openCancellation" @restore-cancelled="confirmRestore" @correct-completed="openCorrection" @revert-completed="confirmRevertCompletion" @delete="confirmDelete" />
  </view>
</template>

<style scoped>
.appointment-management { min-height: 100vh; box-sizing: border-box; padding: 36rpx 28rpx calc(50rpx + env(safe-area-inset-bottom)); }
.appointment-management__intro { display: flex; padding: 0 6rpx 28rpx; flex-direction: column; }
.appointment-management__eyebrow { color: #31549e; font-size: 22rpx; font-weight: 600; }
.appointment-management__title { margin-top: 12rpx; color: #1a2538; font-size: 42rpx; font-weight: 700; }
.appointment-management__description { margin-top: 12rpx; color: #707b8f; font-size: 23rpx; line-height: 1.6; }
.appointment-management__prerequisite, .appointment-management__error, .appointment-management__loading { padding: 20rpx; border-radius: 13rpx; font-size: 22rpx; }
.appointment-management__prerequisite, .appointment-management__loading { background: #eef2f8; color: #68748a; }
.appointment-management__error { margin-top: 18rpx; border: 2rpx solid #e2b5b5; background: #fff5f4; color: #97423f; }
.appointment-management__loading { margin-top: 18rpx; text-align: center; }
</style>
