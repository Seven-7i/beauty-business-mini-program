<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { AppointmentV1, CustomerV1 } from "@/domain/data-schema";
import type { CustomerBusinessSummary } from "@/services/statistics-service";
import { useCustomerDetailTabs } from "../composables/useCustomerManagement";
import CustomerAppointmentHistory from "./CustomerAppointmentHistory.vue";
import CustomerDetailProfile from "./CustomerDetailProfile.vue";
import CustomerDetailTabs from "./CustomerDetailTabs.vue";
import CustomerProfileDetails from "./CustomerProfileDetails.vue";

/** 顾客详情展示层的只读输入。 */
interface CustomerDetailProps {
  /** 当前顾客完整资料。 */
  customer: DeepReadonly<CustomerV1>;
  /** 当前顾客仍存在且已按计划时间倒序排列的预约。 */
  appointments: readonly DeepReadonly<AppointmentV1>[];
  /** 从已完成预约派生的累计经营数据。 */
  businessSummary: Readonly<CustomerBusinessSummary>;
  /** 业务操作提交期间禁止重复触发。 */
  disabled: boolean;
}

/** 顾客详情向页面容器暴露的资料操作。 */
interface CustomerDetailEmits {
  /** 请求编辑当前顾客资料。 */
  edit: [];
  /** 请求切换当前顾客启用状态。 */
  "toggle-status": [];
  /** 请求彻底删除当前顾客。 */
  delete: [];
}

defineProps<CustomerDetailProps>();
const emit = defineEmits<CustomerDetailEmits>();
const { activeTab, selectTab } = useCustomerDetailTabs();

/** 由顾客主动点击手机号后唤起系统拨号界面，失败时给出可理解的弱提示。 */
function callCustomer(phoneNumber: string): void {
  uni.makePhoneCall({
    phoneNumber,
    fail: () => {
      uni.showToast({
        title: "未能打开拨号界面",
        icon: "none",
      });
    },
  });
}
</script>

<template>
  <view class="customer-detail">
    <CustomerDetailProfile
      :customer="customer"
      :business-summary="businessSummary"
      :disabled="disabled"
      @call="callCustomer"
      @edit="emit('edit')"
    />
    <CustomerDetailTabs
      :active-tab="activeTab"
      :appointment-count="appointments.length"
      @select="selectTab"
    />
    <CustomerProfileDetails
      v-if="activeTab === 'profile'"
      :customer="customer"
      :disabled="disabled"
      @toggle-status="emit('toggle-status')"
      @delete="emit('delete')"
    />
    <view
      v-else
      id="customer-history-panel"
      class="customer-detail__history"
      role="tabpanel"
      aria-label="历史预约"
    >
      <CustomerAppointmentHistory :appointments="appointments" />
    </view>
  </view>
</template>

<style scoped>
.customer-detail { position: relative; z-index: 1; }
.customer-detail__history { padding-top: 24rpx; }
</style>
