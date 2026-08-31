<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { AppointmentV1, CustomerV1 } from "@/domain/data-schema";
import type { CustomerBusinessSummary } from "@/services/statistics-service";
import { formatCustomerCurrency } from "../customer-currency";
import CustomerAppointmentHistory from "./CustomerAppointmentHistory.vue";

/** 顾客详情的只读展示状态。 */
interface CustomerDetailProps {
  /** 当前顾客完整资料。 */
  customer: DeepReadonly<CustomerV1>;
  /** 当前顾客仍存在的预约历史。 */
  appointments: readonly DeepReadonly<AppointmentV1>[];
  /** 从已完成预约派生的累计经营数据。 */
  businessSummary: Readonly<CustomerBusinessSummary>;
  /** 业务操作提交期间禁止重复触发。 */
  disabled: boolean;
}

/** 顾客详情向管理容器暴露的低频操作。 */
interface CustomerDetailEmits {
  /** 返回顾客列表。 */
  close: [];
  /** 编辑当前顾客资料。 */
  edit: [customer: DeepReadonly<CustomerV1>];
  /** 切换当前顾客启用状态。 */
  "toggle-status": [customer: DeepReadonly<CustomerV1>];
  /** 尝试彻底删除当前顾客。 */
  delete: [customer: DeepReadonly<CustomerV1>];
}

defineProps<CustomerDetailProps>();
const emit = defineEmits<CustomerDetailEmits>();

</script>

<template>
  <view class="customer-detail">
    <view class="customer-detail__toolbar">
      <button class="customer-detail__back" @click="emit('close')">返回顾客列表</button>
      <button class="customer-detail__edit" :disabled="disabled" @click="emit('edit', customer)">编辑资料</button>
    </view>
    <view class="customer-detail__heading">
      <view class="customer-detail__identity">
        <text class="customer-detail__name">{{ customer.nickname }}</text>
        <text class="customer-detail__status" :class="{ 'customer-detail__status--inactive': customer.status === 'inactive' }">
          {{ customer.status === "active" ? "启用" : "停用" }}
        </text>
      </view>
      <text class="customer-detail__phone">{{ customer.phone }}</text>
    </view>
    <view class="customer-detail__metrics">
      <view class="customer-detail__metric">
        <text class="customer-detail__metric-label">累计完成</text>
        <text class="customer-detail__metric-value">{{ businessSummary.completedCount }} 次</text>
      </view>
      <view class="customer-detail__metric">
        <text class="customer-detail__metric-label">累计成交</text>
        <text class="customer-detail__metric-value">{{ formatCustomerCurrency(businessSummary.transactionAmountCents) }}</text>
      </view>
    </view>
    <view class="customer-detail__addresses">
      <text class="customer-detail__section-title">服务地址</text>
      <text v-if="!customer.addresses.length" class="customer-detail__empty-address">暂未保存服务地址</text>
      <template v-else>
        <view v-for="address in customer.addresses" :key="address.id" class="customer-detail__address">
          <text>{{ address.addressText }}</text>
          <text v-if="address.note" class="customer-detail__address-note">{{ address.note }}</text>
        </view>
      </template>
    </view>
    <view class="customer-detail__actions">
      <text class="customer-detail__section-title">资料操作</text>
      <text class="customer-detail__action-hint">
        停用后不再参与新预约，历史资料仍会保留；只有从未关联预约的顾客才能彻底删除。
      </text>
      <view class="customer-detail__action-buttons">
        <button
          class="customer-detail__status-action"
          :disabled="disabled"
          @click="emit('toggle-status', customer)"
        >
          {{ customer.status === "active" ? "停用顾客" : "重新启用" }}
        </button>
        <button
          class="customer-detail__delete"
          :disabled="disabled"
          @click="emit('delete', customer)"
        >
          彻底删除
        </button>
      </view>
    </view>
    <CustomerAppointmentHistory :appointments="appointments" />
  </view>
</template>

<style scoped>
.customer-detail { position: relative; z-index: 1; padding: 28rpx; border: 2rpx solid rgba(136, 103, 126, 0.1); border-radius: 24rpx; background: rgba(255, 255, 255, 0.96); box-shadow: 0 14rpx 36rpx rgba(111, 76, 99, 0.07); }
.customer-detail__toolbar, .customer-detail__heading, .customer-detail__identity, .customer-detail__metrics, .customer-detail__action-buttons { display: flex; align-items: center; }
.customer-detail__toolbar { justify-content: space-between; gap: 12rpx; flex-wrap: wrap; }
.customer-detail__toolbar button { min-height: 68rpx; margin: 0; padding: 12rpx 22rpx; border-radius: 10rpx; font-size: 21rpx; line-height: 1.35; }
.customer-detail__back { border: 2rpx solid #d7dee8; background: #fff; color: #53627a; }
.customer-detail__edit { background: #f1e9f5; color: #7048ac; }
.customer-detail__heading { margin-top: 24rpx; align-items: flex-start; justify-content: space-between; gap: 16rpx; flex-wrap: wrap; }
.customer-detail__identity { min-width: 0; flex: 1; gap: 12rpx; flex-wrap: wrap; }
.customer-detail__name { min-width: 0; color: #1f2c42; font-size: 34rpx; font-weight: 700; overflow-wrap: anywhere; }
.customer-detail__status { flex: none; padding: 5rpx 11rpx; border-radius: 9rpx; background: #e5f2ea; color: #34704d; font-size: 18rpx; }
.customer-detail__status--inactive { background: #eceef2; color: #737d8d; }
.customer-detail__phone { flex: none; color: #42516b; font-size: 24rpx; white-space: nowrap; }
.customer-detail__metrics { margin-top: 20rpx; gap: 12rpx; }
.customer-detail__metric { display: flex; min-width: 0; flex: 1; padding: 18rpx; border-radius: 12rpx; background: #f7f0f6; flex-direction: column; gap: 6rpx; }
.customer-detail__metric-label { color: #718096; font-size: 20rpx; }
.customer-detail__metric-value { color: #263b62; font-size: 28rpx; font-weight: 700; overflow-wrap: anywhere; }
.customer-detail__addresses { display: flex; margin-top: 24rpx; flex-direction: column; gap: 9rpx; }
.customer-detail__section-title { color: #42516b; font-size: 23rpx; font-weight: 700; }
.customer-detail__empty-address, .customer-detail__address { color: #6d788b; font-size: 21rpx; line-height: 1.55; }
.customer-detail__address { display: flex; padding: 14rpx 16rpx; border: 2rpx solid #e1e6ed; border-radius: 10rpx; background: #fff; flex-direction: column; gap: 5rpx; overflow-wrap: anywhere; }
.customer-detail__address-note { color: #8791a1; font-size: 19rpx; }
.customer-detail__actions { display: flex; margin-top: 26rpx; padding-top: 24rpx; border-top: 2rpx solid #eee5eb; flex-direction: column; }
.customer-detail__action-hint { margin-top: 8rpx; color: #7d747b; font-size: 20rpx; line-height: 1.55; }
.customer-detail__action-buttons { gap: 12rpx; margin-top: 16rpx; flex-wrap: wrap; }
.customer-detail__action-buttons button { min-width: 0; min-height: 68rpx; flex: 1; margin: 0; padding: 12rpx 20rpx; border-radius: 11rpx; font-size: 21rpx; line-height: 1.35; }
.customer-detail__status-action { background: #f1e9f5; color: #7048ac; }
.customer-detail__delete { border: 2rpx solid #efd7d5; background: #fff5f4; color: #9a4a47; }
@media (max-width: 360px) {
  .customer-detail__metrics { flex-direction: column; }
  .customer-detail__metric { width: 100%; box-sizing: border-box; }
}
</style>
