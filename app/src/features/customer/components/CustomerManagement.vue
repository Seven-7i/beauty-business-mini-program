<script setup lang="ts">
import { onMounted, type DeepReadonly } from "vue";
import type { CustomerV1 } from "@/domain/data-schema";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import type { CustomerManagementService } from "@/services/customer-management-service";
import { openCustomerEditor } from "../customer-create-navigation";
import { openCustomerDetail } from "../customer-detail-navigation";
import { useCustomerManagement } from "../composables/useCustomerManagement";
import CustomerList from "./CustomerList.vue";

/** 顾客列表容器的业务用例依赖。 */
interface CustomerManagementProps {
  /** 页面可调用的顾客管理窄用例。 */
  service: CustomerManagementService;
}

/** 顾客列表路由在子页面返回后可调用的刷新契约。 */
interface CustomerManagementExpose {
  /** 重新读取顾客与预约快照，让子页面结果立即进入列表。 */
  refresh(): Promise<void>;
}

const props = defineProps<CustomerManagementProps>();
const {
  customersByName,
  businessSummaries,
  loading,
  submitting,
  errorMessage,
  errorKind,
  refresh,
} = useCustomerManagement(props.service);

/** 从顾客列表进入独立新增顾客页面。 */
function openCreateCustomer(): void {
  openCustomerEditor();
}

/** 从列表进入指定顾客的独立详情页。 */
function openCustomerDetailPage(customer: DeepReadonly<CustomerV1>): void {
  openCustomerDetail(customer.id);
}

onMounted(refresh);

const exposed: CustomerManagementExpose = { refresh };
defineExpose(exposed);
</script>

<template>
  <main class="customer-management">
    <view class="customer-management__glow customer-management__glow--rose" aria-hidden="true" />
    <view class="customer-management__glow customer-management__glow--lavender" aria-hidden="true" />

    <RecoverableErrorNotice
      v-if="errorMessage"
      class="customer-management__notice"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="refresh"
    />

    <view v-if="loading" class="customer-management__loading" role="status">
      正在读取本机顾客资料
    </view>
    <CustomerList
      v-else
      :customers="customersByName"
      :business-summaries="businessSummaries"
      :disabled="submitting"
      @add="openCreateCustomer"
      @view="openCustomerDetailPage"
    />
  </main>
</template>

<style scoped>
.customer-management { position: relative; min-height: 100vh; box-sizing: border-box; overflow: hidden; padding: 34rpx 30rpx calc(56rpx + env(safe-area-inset-bottom)); background: linear-gradient(180deg, #fff8fa 0%, #fbf4f7 52%, #f8f4f7 100%); }
.customer-management__glow { position: absolute; z-index: 0; border-radius: 999rpx; pointer-events: none; }
.customer-management__glow--rose { top: -120rpx; right: -170rpx; width: 500rpx; height: 500rpx; background: radial-gradient(circle, rgba(244, 205, 220, 0.5) 0%, rgba(244, 205, 220, 0) 70%); }
.customer-management__glow--lavender { top: 30rpx; right: -130rpx; width: 420rpx; height: 320rpx; background: radial-gradient(circle, rgba(219, 198, 237, 0.4) 0%, rgba(219, 198, 237, 0) 72%); }
.customer-management__notice, .customer-management__loading { position: relative; z-index: 2; }
.customer-management__loading { padding: 28rpx 24rpx; border: 2rpx solid rgba(137, 106, 128, 0.08); border-radius: 20rpx; background: rgba(255, 255, 255, 0.9); color: #766e74; font-size: 23rpx; text-align: center; }
@media (max-width: 360px) { .customer-management { padding-right: 24rpx; padding-left: 24rpx; } }
</style>
