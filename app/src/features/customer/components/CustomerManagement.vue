<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, type DeepReadonly } from "vue";
import type { CustomerV1 } from "@/domain/data-schema";
import type {
  CreateCustomerInput,
  CustomerManagementService,
} from "@/services/customer-management-service";
import { useCustomerManagement } from "../composables/useCustomerManagement";
import { deriveCustomerAppointmentHistory } from "../customer-appointment-history";
import CustomerForm from "./CustomerForm.vue";
import CustomerList from "./CustomerList.vue";
import CustomerDetail from "./CustomerDetail.vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";

const props = defineProps<{ service: CustomerManagementService }>();
const {
  appointments,
  customersByName,
  businessSummaries,
  loading,
  submitting,
  errorMessage,
  errorKind,
  refresh,
  createCustomer,
  updateCustomer,
  setCustomerStatus,
  deleteCustomer,
} = useCustomerManagement(props.service);
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

async function handleSubmit(input: CreateCustomerInput): Promise<void> {
  const saved = selectedCustomer.value
    ? await updateCustomer({ customerId: selectedCustomer.value.id, ...input })
    : await createCustomer(input);
  if (saved) {
    selectedCustomer.value = undefined;
    customerForm.value?.reset();
    uni.showToast({ title: "顾客资料已保存", icon: "success" });
  }
}

function editCustomer(customer: DeepReadonly<CustomerV1>): void {
  detailCustomerId.value = "";
  selectedCustomer.value = customer;
  uni.pageScrollTo({ scrollTop: 0, duration: 250 });
}

function openCustomerDetail(customer: DeepReadonly<CustomerV1>): void {
  detailCustomerId.value = customer.id;
}

function closeCustomerDetail(): void {
  detailCustomerId.value = "";
}

function cancelEdit(): void {
  selectedCustomer.value = undefined;
  customerForm.value?.reset();
}

async function toggleStatus(customer: DeepReadonly<CustomerV1>): Promise<void> {
  if (customer.status === "inactive") {
    if (await setCustomerStatus(customer.id, "active")) {
      uni.showToast({ title: "顾客已重新启用", icon: "success" });
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
            cancelEdit();
            uni.showToast({ title: "顾客已停用", icon: "none" });
          }
        });
      }
    },
  });
}

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
            cancelEdit();
            uni.showToast({ title: "顾客已删除", icon: "none" });
          }
        });
      }
    },
  });
}

onMounted(refresh);
</script>

<template>
  <view class="customer-management">
    <view class="customer-management__intro">
      <text class="customer-management__eyebrow">美容 · 预约联系人</text>
      <text class="customer-management__title">顾客管理</text>
      <text class="customer-management__description">昵称和手机号在停用后仍保持唯一；服务地址不设置默认项。</text>
    </view>
    <CustomerForm ref="customerForm" :submitting="submitting" :editing-customer="selectedCustomer" @submit="handleSubmit" @cancel-edit="cancelEdit" />
    <RecoverableErrorNotice v-if="errorMessage" :message="errorMessage" :retryable="errorKind === 'read'" :retrying="loading" @retry="refresh" />
    <view v-if="loading" class="customer-management__loading">正在读取本机顾客资料</view>
    <CustomerDetail
      v-else-if="detailCustomer"
      :customer="detailCustomer"
      :appointments="detailAppointments"
      :business-summary="detailBusinessSummary"
      @close="closeCustomerDetail"
      @edit="editCustomer"
    />
    <CustomerList v-else :customers="customersByName" :business-summaries="businessSummaries" :disabled="submitting" @view="openCustomerDetail" @edit="editCustomer" @toggle-status="toggleStatus" @delete="confirmDelete" />
  </view>
</template>

<style scoped>
.customer-management { min-height: 100vh; box-sizing: border-box; padding: 36rpx 28rpx calc(50rpx + env(safe-area-inset-bottom)); }
.customer-management__intro { display: flex; padding: 0 6rpx 28rpx; flex-direction: column; }
.customer-management__eyebrow { color: #31549e; font-size: 22rpx; font-weight: 600; }
.customer-management__title { margin-top: 12rpx; color: #1a2538; font-size: 42rpx; font-weight: 700; }
.customer-management__description { margin-top: 12rpx; color: #707b8f; font-size: 23rpx; line-height: 1.6; }
.customer-management__loading { margin-top: 22rpx; padding: 18rpx 20rpx; border-radius: 12rpx; font-size: 23rpx; }
.customer-management__loading { background: #eef2f8; color: #68748a; text-align: center; }
</style>
