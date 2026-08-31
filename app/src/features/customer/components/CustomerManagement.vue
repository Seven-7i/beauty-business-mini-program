<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  type DeepReadonly,
} from "vue";
import type { CustomerV1 } from "@/domain/data-schema";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import type {
  CreateCustomerInput,
  CustomerManagementService,
} from "@/services/customer-management-service";
import { deriveCustomerAppointmentHistory } from "../customer-appointment-history";
import {
  getCustomerFormErrorField,
  getCustomerScreenAfterFormExit,
  requestCustomerFormExit,
  type CustomerScreen,
} from "../customer-form-state";
import { useCustomerManagement } from "../composables/useCustomerManagement";
import CustomerDetail from "./CustomerDetail.vue";
import CustomerForm from "./CustomerForm.vue";
import CustomerList from "./CustomerList.vue";

/** 当前页面用到的微信原生返回询问最小接口。 */
interface WechatBeforeUnloadApi {
  /** 开启原生导航返回询问。 */
  enableAlertBeforeUnload(options: { message: string }): void;
  /** 关闭原生导航返回询问。 */
  disableAlertBeforeUnload(): void;
}

declare const wx: WechatBeforeUnloadApi | undefined;

/** 顾客管理容器的业务用例依赖。 */
interface CustomerManagementProps {
  /** 页面可调用的顾客管理窄用例。 */
  service: CustomerManagementService;
}

const props = defineProps<CustomerManagementProps>();
const {
  appointments,
  customersByName,
  businessSummaries,
  loading,
  submitting,
  errorMessage,
  errorKind,
  errorCode,
  clearError,
  refresh,
  createCustomer,
  updateCustomer,
  setCustomerStatus,
  deleteCustomer,
} = useCustomerManagement(props.service);
const screen = shallowRef<CustomerScreen>("list");
const formDirty = shallowRef(false);
const selectedCustomer = shallowRef<DeepReadonly<CustomerV1>>();
const detailCustomerId = shallowRef("");
const customerForm = ref<InstanceType<typeof CustomerForm> | null>(null);
const detailCustomer = computed(() =>
  customersByName.value.find(
    (customer) => customer.id === detailCustomerId.value,
  ),
);
const detailAppointments = computed(() =>
  detailCustomer.value
    ? deriveCustomerAppointmentHistory(
        detailCustomer.value.id,
        appointments.value,
      )
    : [],
);
const detailBusinessSummary = computed(() =>
  detailCustomer.value
    ? (businessSummaries.value[detailCustomer.value.id] ?? {
        completedCount: 0,
        transactionAmountCents: 0,
      })
    : { completedCount: 0, transactionAmountCents: 0 },
);
const formErrorField = computed(() =>
  screen.value === "form"
    ? getCustomerFormErrorField(errorCode.value)
    : undefined,
);

/** 把视口带到页面级错误说明，确保详情底部操作失败也能立即看见原因。 */
async function scrollToErrorNotice(): Promise<void> {
  await nextTick();
  uni.pageScrollTo({
    selector: ".customer-management__notice",
    duration: 180,
  });
}

/** 跟随草稿状态启停微信原生返回询问，覆盖导航栏返回和 Android 返回键。 */
function syncNativeBackProtection(dirty: boolean): void {
  if (typeof wx === "undefined") {
    return;
  }
  if (dirty) {
    wx.enableAlertBeforeUnload({ message: "放弃本次编辑？" });
    return;
  }
  wx.disableAlertBeforeUnload();
}

/** 保存新增或编辑资料，并回到发起操作前的列表或详情。 */
async function handleSubmit(input: CreateCustomerInput): Promise<void> {
  const editingCustomerId = selectedCustomer.value?.id;
  const saved = editingCustomerId
    ? await updateCustomer({ customerId: editingCustomerId, ...input })
    : await createCustomer(input);
  if (!saved) {
    if (!formErrorField.value) {
      await scrollToErrorNotice();
    }
    return;
  }
  formDirty.value = false;
  syncNativeBackProtection(false);
  selectedCustomer.value = undefined;
  customerForm.value?.reset();
  screen.value = getCustomerScreenAfterFormExit(editingCustomerId);
  uni.showToast({ title: "顾客资料已保存", icon: "success" });
}

/** 从列表进入空白新增表单。 */
function openCreateCustomer(): void {
  clearError();
  formDirty.value = false;
  selectedCustomer.value = undefined;
  detailCustomerId.value = "";
  customerForm.value?.reset();
  screen.value = "form";
  uni.pageScrollTo({ scrollTop: 0, duration: 180 });
}

/** 从详情进入当前顾客编辑表单。 */
function editCustomer(customer: DeepReadonly<CustomerV1>): void {
  clearError();
  formDirty.value = false;
  detailCustomerId.value = customer.id;
  selectedCustomer.value = customer;
  screen.value = "form";
  uni.pageScrollTo({ scrollTop: 0, duration: 180 });
}

/** 从列表打开指定顾客详情。 */
function openCustomerDetail(customer: DeepReadonly<CustomerV1>): void {
  clearError();
  detailCustomerId.value = customer.id;
  selectedCustomer.value = undefined;
  screen.value = "detail";
  uni.pageScrollTo({ scrollTop: 0, duration: 180 });
}

/** 从详情回到顾客列表。 */
function closeCustomerDetail(): void {
  clearError();
  detailCustomerId.value = "";
  selectedCustomer.value = undefined;
  screen.value = "list";
}

/** 完成已获准的表单退出；编辑返回详情，新增返回列表。 */
function completeFormCancel(): void {
  const editingCustomerId = selectedCustomer.value?.id;
  clearError();
  formDirty.value = false;
  syncNativeBackProtection(false);
  selectedCustomer.value = undefined;
  customerForm.value?.reset();
  screen.value = getCustomerScreenAfterFormExit(editingCustomerId);
}

/** 无改动直接退出，有未保存改动时先确认是否放弃。 */
function cancelForm(): void {
  requestCustomerFormExit({
    dirty: formDirty.value,
    exit: completeFormCancel,
    confirmDiscard(discard) {
      uni.showModal({
        title: "放弃本次编辑？",
        content: "尚未保存的顾客资料将丢失。",
        confirmText: "放弃",
        confirmColor: "#A94442",
        success(result) {
          if (result.confirm) {
            discard();
          }
        },
        fail() {
          uni.showToast({ title: "确认框打开失败", icon: "none" });
        },
      });
    },
  });
}

/** 记录表单草稿是否偏离初始值，作为退出保护依据。 */
function updateFormDirty(dirty: boolean): void {
  formDirty.value = dirty;
  syncNativeBackProtection(dirty);
}

/** 经明确确认后切换顾客启用状态。 */
async function toggleStatus(
  customer: DeepReadonly<CustomerV1>,
): Promise<void> {
  if (customer.status === "inactive") {
    const saved = await setCustomerStatus(customer.id, "active");
    if (saved) {
      uni.showToast({ title: "顾客已重新启用", icon: "success" });
    } else {
      await scrollToErrorNotice();
    }
    return;
  }
  uni.showModal({
    title: `停用“${customer.nickname}”？`,
    content: "停用后历史预约仍会保留，但创建新预约时不再提供这位顾客。",
    confirmText: "确认停用",
    confirmColor: "#A94442",
    success(result) {
      if (result.confirm) {
        void setCustomerStatus(customer.id, "inactive").then((saved) => {
          if (saved) {
            uni.showToast({ title: "顾客已停用", icon: "none" });
          } else {
            void scrollToErrorNotice();
          }
        });
      }
    },
    fail() {
      uni.showToast({ title: "确认框打开失败", icon: "none" });
    },
  });
}

/** 经二次确认后尝试彻底删除从未关联预约的顾客。 */
function confirmDelete(customer: DeepReadonly<CustomerV1>): void {
  uni.showModal({
    title: `彻底删除“${customer.nickname}”？`,
    content: "只有从未关联预约的顾客可以删除；删除后无法恢复。",
    confirmText: "彻底删除",
    confirmColor: "#A94442",
    success(result) {
      if (result.confirm) {
        void deleteCustomer(customer.id).then((deleted) => {
          if (deleted) {
            closeCustomerDetail();
            uni.showToast({ title: "顾客已删除", icon: "none" });
          } else {
            void scrollToErrorNotice();
          }
        });
      }
    },
    fail() {
      uni.showToast({ title: "确认框打开失败", icon: "none" });
    },
  });
}

onMounted(refresh);
onBeforeUnmount(() => syncNativeBackProtection(false));
</script>

<template>
  <main class="customer-management">
    <view
      class="customer-management__glow customer-management__glow--rose"
      aria-hidden="true"
    />
    <view
      class="customer-management__glow customer-management__glow--lavender"
      aria-hidden="true"
    />

    <RecoverableErrorNotice
      v-if="errorMessage && !formErrorField"
      class="customer-management__notice"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="refresh"
    />

    <view v-if="loading" class="customer-management__loading" role="status">
      正在读取本机顾客资料
    </view>
    <CustomerForm
      v-else-if="screen === 'form'"
      ref="customerForm"
      :submitting="submitting"
      :editing-customer="selectedCustomer"
      :error-code="errorCode"
      :error-message="errorMessage"
      @submit="handleSubmit"
      @cancel="cancelForm"
      @dirty-change="updateFormDirty"
      @draft-change="clearError"
    />
    <CustomerDetail
      v-else-if="screen === 'detail' && detailCustomer"
      :customer="detailCustomer"
      :appointments="detailAppointments"
      :business-summary="detailBusinessSummary"
      :disabled="submitting"
      @close="closeCustomerDetail"
      @edit="editCustomer"
      @toggle-status="toggleStatus"
      @delete="confirmDelete"
    />
    <CustomerList
      v-else
      :customers="customersByName"
      :business-summaries="businessSummaries"
      :disabled="submitting"
      @add="openCreateCustomer"
      @view="openCustomerDetail"
    />
  </main>
</template>

<style scoped>
.customer-management {
  position: relative;
  min-height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  padding: 34rpx 30rpx calc(56rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, #fff8fa 0%, #fbf4f7 52%, #f8f4f7 100%);
}

.customer-management__glow {
  position: absolute;
  z-index: 0;
  border-radius: 999rpx;
  pointer-events: none;
}

.customer-management__glow--rose {
  top: -120rpx;
  right: -170rpx;
  width: 500rpx;
  height: 500rpx;
  background: radial-gradient(circle, rgba(244, 205, 220, 0.5) 0%, rgba(244, 205, 220, 0) 70%);
}

.customer-management__glow--lavender {
  top: 30rpx;
  right: -130rpx;
  width: 420rpx;
  height: 320rpx;
  background: radial-gradient(circle, rgba(219, 198, 237, 0.4) 0%, rgba(219, 198, 237, 0) 72%);
}

.customer-management__notice,
.customer-management__loading {
  position: relative;
  z-index: 2;
}

.customer-management__loading {
  padding: 28rpx 24rpx;
  border: 2rpx solid rgba(137, 106, 128, 0.08);
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.9);
  color: #766e74;
  font-size: 23rpx;
  text-align: center;
}

@media (max-width: 360px) {
  .customer-management {
    padding-right: 24rpx;
    padding-left: 24rpx;
  }
}
</style>
