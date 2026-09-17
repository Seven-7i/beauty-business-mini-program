<script setup lang="ts">
import { computed, onMounted, type DeepReadonly } from "vue";
import type {
  BeautyProjectV1,
  CustomerV1,
  InventoryItemV1,
} from "@/domain/data-schema";
import type {
  AppointmentManagementService,
  SaveBackfilledAppointmentInput,
  SavePendingAppointmentInput,
} from "@/services/appointment-management-service";
import { useAppointmentManagement } from "../composables/useAppointmentManagement";
import AppointmentForm from "./AppointmentForm.vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";

interface AppointmentCreatePageProps {
  /** 页面可调用的预约管理窄用例。 */
  service: AppointmentManagementService;
  /** 省略表示新增；传入时加载对应待执行预约进行编辑。 */
  appointmentId?: string;
}

const props = defineProps<AppointmentCreatePageProps>();

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
  errorKind,
  refresh,
  savePendingAppointment,
  saveBackfilledAppointment,
} = useAppointmentManagement(props.service);

const editingAppointment = computed(() => {
  const appointment = appointmentsByStatus.value.find(
    (candidate) => candidate.id === props.appointmentId,
  );
  return appointment?.status === "pending" ? appointment : undefined;
});
const invalidEditingTarget = computed(
  () =>
    Boolean(props.appointmentId) &&
    !loading.value &&
    editingAppointment.value === undefined,
);
const missingActiveCustomer = computed(
  () => !editingAppointment.value && activeCustomers.value.length === 0,
);
const missingActiveProject = computed(
  () => !editingAppointment.value && activeProjects.value.length === 0,
);
const missingPrerequisites = computed(
  () => missingActiveCustomer.value || missingActiveProject.value,
);
const missingPrerequisiteHint = computed(() => {
  if (missingActiveCustomer.value && missingActiveProject.value) {
    return "新增预约前，请先新增一位顾客和一个服务项目。";
  }
  return missingActiveCustomer.value
    ? "新增预约前，请先新增一位顾客。"
    : "新增预约前，请先新增一个服务项目。";
});

/** 编辑时将历史停用顾客补回选择列表，新增仍只显示启用顾客。 */
const selectableCustomers = computed<
  readonly DeepReadonly<CustomerV1>[]
>(() => {
  const referenced = customers.value.find(
    (customer) => customer.id === editingAppointment.value?.customerId,
  );
  return referenced &&
    !activeCustomers.value.some((customer) => customer.id === referenced.id)
    ? [...activeCustomers.value, referenced]
    : activeCustomers.value;
});

/** 编辑时将预约快照引用的停用项目补回选择列表。 */
const selectableProjects = computed<
  readonly DeepReadonly<BeautyProjectV1>[]
>(() => {
  const referencedIds = new Set(
    editingAppointment.value?.projectSnapshots.map(
      (snapshot) => snapshot.projectId,
    ) ?? [],
  );
  return [
    ...activeProjects.value,
    ...projects.value.filter(
      (project) =>
        referencedIds.has(project.id) &&
        !activeProjects.value.some((candidate) => candidate.id === project.id),
    ),
  ];
});

/** 编辑时将预计占用引用的停用物品补回实际用量选择列表。 */
const selectableInventoryItems = computed<
  readonly DeepReadonly<InventoryItemV1>[]
>(() => {
  const referencedIds = new Set(
    editingAppointment.value?.actualUsages.map(
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

/** 保存成功后返回上一页；没有上一页时回到预约列表。 */
function leaveAfterSave(message: string): void {
  uni.showToast({ title: message, icon: "success" });
  setTimeout(() => {
    if (getCurrentPages().length > 1) {
      uni.navigateBack();
    } else {
      uni.redirectTo({ url: "/pages-beauty/appointment/index" });
    }
  }, 350);
}

/** 保存正常待执行预约，并处理时间冲突的二次确认。 */
async function submitScheduled(
  input: SavePendingAppointmentInput,
): Promise<void> {
  const result = await savePendingAppointment(input);
  if (result.kind === "saved") {
    leaveAfterSave(props.appointmentId ? "预约已更新" : "预约已保存");
    return;
  }
  if (result.kind !== "conflict") {
    uni.showToast({
      title: errorMessage.value || "预约保存失败，请稍后重试",
      icon: "none",
    });
    return;
  }
  uni.showModal({
    title: "预约时间有冲突",
    content: `与 ${result.count} 条待执行预约时间重叠，仍要继续保存吗？`,
    confirmText: "仍然保存",
    success(modalResult) {
      if (!modalResult.confirm) {
        return;
      }
      void savePendingAppointment({
        ...result.input,
        confirmTimeConflict: true,
      }).then((confirmed) => {
        if (confirmed.kind === "saved") {
          leaveAfterSave(props.appointmentId ? "预约已更新" : "预约已保存");
        } else if (confirmed.kind === "failed") {
          uni.showToast({
            title: errorMessage.value || "预约保存失败，请稍后重试",
            icon: "none",
          });
        }
      });
    },
  });
}

/** 保存后补记录；最终只会成为已完成或已取消。 */
async function submitBackfilled(
  input: SaveBackfilledAppointmentInput,
): Promise<void> {
  if (await saveBackfilledAppointment(input)) {
    leaveAfterSave(
      input.outcome === "completed" ? "后补完成已保存" : "后补取消已保存",
    );
  } else {
    uni.showToast({
      title: errorMessage.value || "后补预约保存失败，请稍后重试",
      icon: "none",
    });
  }
}

/** 取消编辑并返回详情。 */
function cancelEdit(): void {
  uni.navigateBack();
}

/** 从资料不足提示进入顾客新增页。 */
function openCustomerCreate(): void {
  uni.navigateTo({ url: "/pages-beauty/customer-create/index" });
}

/** 从资料不足提示进入服务项目新增页，返回后刷新可选项目。 */
function openProjectCreate(): void {
  uni.navigateTo({ url: "/pages-beauty/beauty-project-create/index" });
}

onMounted(refresh);
defineExpose({ refresh });
</script>

<template>
  <view class="appointment-create">
    <RecoverableErrorNotice
      v-if="errorMessage"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="refresh"
    />
    <view v-if="loading" class="appointment-create__state">正在读取预约资料</view>
    <view v-else-if="invalidEditingTarget" class="appointment-create__state">
      当前预约不存在或已不是待执行状态，不能从此入口编辑。
      <button @click="cancelEdit">返回预约详情</button>
    </view>
    <view
      v-else-if="missingPrerequisites"
      class="appointment-create__state"
    >
      <text>{{ missingPrerequisiteHint }}</text>
      <view class="appointment-create__actions">
        <button
          v-if="missingActiveCustomer"
          class="appointment-create__action appointment-create__action--primary"
          @click="openCustomerCreate"
        >
          新增顾客
        </button>
        <button
          v-if="missingActiveProject"
          class="appointment-create__action"
          @click="openProjectCreate"
        >
          新增服务项目
        </button>
      </view>
    </view>
    <AppointmentForm
      v-else
      :customers="selectableCustomers"
      :projects="selectableProjects"
      :inventory-items="selectableInventoryItems"
      :submitting="submitting"
      :editing-appointment="editingAppointment"
      @submit-scheduled="submitScheduled"
      @submit-backfilled="submitBackfilled"
      @cancel-edit="cancelEdit"
    />
  </view>
</template>

<style scoped>
.appointment-create { min-height: 100vh; background: #fbf8fb; }
.appointment-create__state { display: flex; margin: 28rpx; padding: 34rpx; border: 2rpx solid #ebe5ef; border-radius: 20rpx; background: #fff; color: #746d7a; font-size: 24rpx; line-height: 1.6; flex-direction: column; text-align: center; }
.appointment-create__actions { display: flex; gap: 16rpx; margin-top: 22rpx; flex-direction: column; }
.appointment-create__action { height: 76rpx; margin: 0; border: 2rpx solid #5033dd; border-radius: 12rpx; background: #fff; color: #5033dd; font-size: 24rpx; line-height: 72rpx; }
.appointment-create__action--primary { background: #5033dd; color: #fff; }
</style>
