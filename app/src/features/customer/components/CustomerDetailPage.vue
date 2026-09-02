<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef } from "vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import type {
  CreateCustomerInput,
  CustomerManagementService,
} from "@/services/customer-management-service";
import {
  refreshCustomerDetailForScreen,
  type CustomerDetailScreen,
  useCustomerDetail,
} from "../composables/useCustomerManagement";
import { getCustomerFormErrorField } from "../customer-form-state";
import { useCustomerDraftProtection } from "../composables/useCustomerDraftProtection";
import CustomerDetail from "./CustomerDetail.vue";
import CustomerForm from "./CustomerForm.vue";

/** 独立顾客详情页的业务输入。 */
interface CustomerDetailPageProps {
  /** 路由参数提供的稳定顾客标识。 */
  customerId: string;
  /** 页面可调用的顾客管理窄用例。 */
  service: CustomerManagementService;
}

/** 独立顾客详情页向路由组合层暴露的结果。 */
interface CustomerDetailPageEmits {
  /** 缺失顾客时请求返回顾客列表。 */
  back: [];
  /** 当前顾客已被彻底删除，路由应返回列表。 */
  deleted: [];
}

/** 路由在页面重新显示时可调用的最小刷新契约。 */
interface CustomerDetailPageExpose {
  /** 重新读取当前顾客与预约快照。 */
  refresh(): Promise<boolean>;
}

const props = defineProps<CustomerDetailPageProps>();
const emit = defineEmits<CustomerDetailPageEmits>();
const {
  customer,
  appointments,
  businessSummary,
  loading,
  submitting,
  errorMessage,
  errorKind,
  errorCode,
  clearError,
  refresh: refreshCustomer,
  updateCustomer,
  setCustomerStatus,
  deleteCustomer,
} = useCustomerDetail(props.service, props.customerId);
const { updateDirty, resetDirty, requestExit } = useCustomerDraftProtection();
const screen = shallowRef<CustomerDetailScreen>("detail");
const customerForm = shallowRef<InstanceType<typeof CustomerForm>>();
const formErrorField = computed(() => getCustomerFormErrorField(errorCode.value));

/**
 * 页面重新显示时只刷新只读详情；编辑中保留进入表单时的资料快照和草稿。
 */
async function refresh(): Promise<boolean> {
  return refreshCustomerDetailForScreen(screen.value, refreshCustomer);
}

/** 非字段错误出现时把视口带到页面级说明。 */
async function scrollToErrorNotice(): Promise<void> {
  await nextTick();
  uni.pageScrollTo({
    selector: ".customer-detail-page__notice",
    duration: 180,
  });
}

/** 保存顾客编辑草稿，成功后回到双 Tab 详情。 */
async function handleSubmit(input: CreateCustomerInput): Promise<void> {
  const saved = await updateCustomer(input);
  if (!saved) {
    if (!formErrorField.value) {
      await scrollToErrorNotice();
    }
    return;
  }
  resetDirty();
  customerForm.value?.reset();
  screen.value = "detail";
  uni.showToast({ title: "顾客资料已保存", icon: "success" });
}

/** 从详情进入当前顾客编辑表单。 */
function editCustomer(): void {
  clearError();
  resetDirty();
  screen.value = "form";
  uni.pageScrollTo({ scrollTop: 0, duration: 180 });
}

/** 完成已获准的表单退出并回到当前顾客详情。 */
function completeFormCancel(): void {
  clearError();
  resetDirty();
  customerForm.value?.reset();
  screen.value = "detail";
}

/** 无改动直接退出，有未保存改动时先确认是否放弃。 */
function cancelForm(): void {
  requestExit(completeFormCancel);
}

/** 经明确确认后切换当前顾客启用状态。 */
async function toggleStatus(): Promise<void> {
  const current = customer.value;
  if (!current) {
    return;
  }
  if (current.status === "inactive") {
    const saved = await setCustomerStatus("active");
    if (saved) {
      uni.showToast({ title: "顾客已重新启用", icon: "success" });
    } else {
      await scrollToErrorNotice();
    }
    return;
  }
  uni.showModal({
    title: `停用“${current.nickname}”？`,
    content: "停用后历史预约仍会保留，但创建新预约时不再提供这位顾客。",
    confirmText: "确认停用",
    confirmColor: "#A94442",
    success(result) {
      if (result.confirm) {
        void setCustomerStatus("inactive").then((saved) => {
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

/** 经二次确认后尝试彻底删除从未关联预约的当前顾客。 */
function confirmDelete(): void {
  const current = customer.value;
  if (!current) {
    return;
  }
  uni.showModal({
    title: `彻底删除“${current.nickname}”？`,
    content: "只有从未关联预约的顾客可以删除；删除后无法恢复。",
    confirmText: "彻底删除",
    confirmColor: "#A94442",
    success(result) {
      if (result.confirm) {
        void deleteCustomer().then((deleted) => {
          if (deleted) {
            emit("deleted");
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

const exposed: CustomerDetailPageExpose = { refresh };
defineExpose(exposed);
</script>

<template>
  <main class="customer-detail-page">
    <view class="customer-detail-page__glow customer-detail-page__glow--rose" aria-hidden="true" />
    <view class="customer-detail-page__glow customer-detail-page__glow--lavender" aria-hidden="true" />

    <RecoverableErrorNotice
      v-if="errorMessage && !formErrorField && errorKind !== 'missing'"
      class="customer-detail-page__notice"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="refresh"
    />

    <view v-if="loading && !customer" class="customer-detail-page__loading" role="status">
      正在读取顾客详情
    </view>
    <view
      v-else-if="errorKind === 'missing' && !customer"
      class="customer-detail-page__missing"
      role="alert"
    >
      <text class="customer-detail-page__missing-copy">{{ errorMessage }}</text>
      <button class="customer-detail-page__back" @click="emit('back')">
        返回顾客列表
      </button>
    </view>
    <CustomerForm
      v-else-if="screen === 'form' && customer"
      ref="customerForm"
      :submitting="submitting"
      :editing-customer="customer"
      :error-code="errorCode"
      :error-message="errorMessage"
      @submit="handleSubmit"
      @cancel="cancelForm"
      @dirty-change="updateDirty"
      @draft-change="clearError"
    />
    <CustomerDetail
      v-else-if="customer"
      :customer="customer"
      :appointments="appointments"
      :business-summary="businessSummary"
      :disabled="submitting"
      @edit="editCustomer"
      @toggle-status="toggleStatus"
      @delete="confirmDelete"
    />
  </main>
</template>

<style scoped>
.customer-detail-page { position: relative; min-height: 100vh; box-sizing: border-box; overflow: hidden; padding: 30rpx 30rpx calc(52rpx + env(safe-area-inset-bottom)); background: linear-gradient(180deg, #fff8fa 0%, #fbf4f7 54%, #f8f4f7 100%); }
.customer-detail-page__glow { position: absolute; z-index: 0; border-radius: 999rpx; pointer-events: none; }
.customer-detail-page__glow--rose { top: -130rpx; right: -180rpx; width: 500rpx; height: 500rpx; background: radial-gradient(circle, rgba(244, 205, 220, 0.48) 0%, rgba(244, 205, 220, 0) 70%); }
.customer-detail-page__glow--lavender { top: 20rpx; right: -140rpx; width: 420rpx; height: 330rpx; background: radial-gradient(circle, rgba(219, 198, 237, 0.4) 0%, rgba(219, 198, 237, 0) 72%); }
.customer-detail-page__notice, .customer-detail-page__loading { position: relative; z-index: 2; }
.customer-detail-page__notice { margin-bottom: 20rpx; }
.customer-detail-page__loading { padding: 30rpx 24rpx; border: 2rpx solid rgba(137, 106, 128, 0.08); border-radius: 20rpx; background: rgba(255, 255, 255, 0.92); color: #766e74; font-size: 23rpx; text-align: center; }
.customer-detail-page__missing { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 22rpx; padding: 36rpx 28rpx; border: 2rpx solid #ead6d8; border-radius: 24rpx; background: rgba(255, 248, 248, 0.94); text-align: center; }
.customer-detail-page__missing-copy { color: #934c54; font-size: 24rpx; line-height: 1.55; }
.customer-detail-page__back { min-width: 240rpx; min-height: 76rpx; margin: 0; padding: 16rpx 28rpx; border-radius: 999rpx; background: #6a3cb3; color: #fff; font-size: 25rpx; font-weight: 650; line-height: 1.35; }
@media (max-width: 360px) { .customer-detail-page { padding-right: 24rpx; padding-left: 24rpx; } }
</style>
