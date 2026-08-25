<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { AppointmentV1, CustomerV1 } from "@/domain/data-schema";
import type { CustomerBusinessSummary } from "@/services/statistics-service";
import CustomerAppointmentHistory from "./CustomerAppointmentHistory.vue";

defineProps<{
  customer: DeepReadonly<CustomerV1>;
  appointments: readonly DeepReadonly<AppointmentV1>[];
  businessSummary: Readonly<CustomerBusinessSummary>;
}>();

const emit = defineEmits<{
  (event: "close"): void;
  (event: "edit", customer: DeepReadonly<CustomerV1>): void;
}>();

function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}
</script>

<template>
  <view class="customer-detail">
    <view class="customer-detail__toolbar">
      <button class="customer-detail__back" @click="emit('close')">返回顾客列表</button>
      <button class="customer-detail__edit" @click="emit('edit', customer)">编辑资料</button>
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
        <text class="customer-detail__metric-value">{{ formatCurrency(businessSummary.transactionAmountCents) }}</text>
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
    <CustomerAppointmentHistory :appointments="appointments" />
  </view>
</template>

<style scoped>
.customer-detail { margin-top: 28rpx; padding: 24rpx; border: 2rpx solid #dce3ed; border-radius: 18rpx; background: #f9fbfd; }
.customer-detail__toolbar, .customer-detail__heading, .customer-detail__identity, .customer-detail__metrics { display: flex; align-items: center; }
.customer-detail__toolbar { justify-content: space-between; gap: 12rpx; flex-wrap: wrap; }
.customer-detail__toolbar button { min-height: 68rpx; margin: 0; padding: 12rpx 22rpx; border-radius: 10rpx; font-size: 21rpx; line-height: 1.35; }
.customer-detail__back { border: 2rpx solid #d7dee8; background: #fff; color: #53627a; }
.customer-detail__edit { background: #e8eefb; color: #31549e; }
.customer-detail__heading { margin-top: 24rpx; align-items: flex-start; justify-content: space-between; gap: 16rpx; flex-wrap: wrap; }
.customer-detail__identity { min-width: 0; flex: 1; gap: 12rpx; flex-wrap: wrap; }
.customer-detail__name { min-width: 0; color: #1f2c42; font-size: 34rpx; font-weight: 700; overflow-wrap: anywhere; }
.customer-detail__status { flex: none; padding: 5rpx 11rpx; border-radius: 9rpx; background: #e5f2ea; color: #34704d; font-size: 18rpx; }
.customer-detail__status--inactive { background: #eceef2; color: #737d8d; }
.customer-detail__phone { flex: none; color: #42516b; font-size: 24rpx; white-space: nowrap; }
.customer-detail__metrics { margin-top: 20rpx; gap: 12rpx; }
.customer-detail__metric { display: flex; min-width: 0; flex: 1; padding: 18rpx; border-radius: 12rpx; background: #eef3f9; flex-direction: column; gap: 6rpx; }
.customer-detail__metric-label { color: #718096; font-size: 20rpx; }
.customer-detail__metric-value { color: #263b62; font-size: 28rpx; font-weight: 700; overflow-wrap: anywhere; }
.customer-detail__addresses { display: flex; margin-top: 24rpx; flex-direction: column; gap: 9rpx; }
.customer-detail__section-title { color: #42516b; font-size: 23rpx; font-weight: 700; }
.customer-detail__empty-address, .customer-detail__address { color: #6d788b; font-size: 21rpx; line-height: 1.55; }
.customer-detail__address { display: flex; padding: 14rpx 16rpx; border: 2rpx solid #e1e6ed; border-radius: 10rpx; background: #fff; flex-direction: column; gap: 5rpx; overflow-wrap: anywhere; }
.customer-detail__address-note { color: #8791a1; font-size: 19rpx; }
@media (max-width: 360px) {
  .customer-detail__metrics { flex-direction: column; }
  .customer-detail__metric { width: 100%; box-sizing: border-box; }
}
</style>
