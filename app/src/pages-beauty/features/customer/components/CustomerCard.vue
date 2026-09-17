<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { CustomerV1 } from "@/domain/data-schema";
import AppIcon from "@/features/shared/components/AppIcon.vue";
import type { CustomerBusinessSummary } from "@/services/statistics-service";
import { formatCustomerCurrency } from "../customer-currency";

/** 单张顾客列表卡片的只读展示输入。 */
interface CustomerCardProps {
  /** 卡片展示的顾客完整资料。 */
  customer: DeepReadonly<CustomerV1>;
  /** 从已完成预约派生的累计经营数据。 */
  businessSummary: Readonly<CustomerBusinessSummary>;
  /** 页面提交期间禁止重复进入详情。 */
  disabled: boolean;
}

/** 顾客卡片向列表层暴露的单一操作。 */
interface CustomerCardEmits {
  /** 请求查看当前顾客详情。 */
  view: [customer: DeepReadonly<CustomerV1>];
}

defineProps<CustomerCardProps>();
const emit = defineEmits<CustomerCardEmits>();

</script>

<template>
  <button
    class="customer-card"
    :class="{ 'customer-card--inactive': customer.status === 'inactive' }"
    :disabled="disabled"
    :aria-label="`查看${customer.nickname}的顾客详情`"
    hover-class="customer-card--pressed"
    :hover-start-time="20"
    :hover-stay-time="80"
    @click="emit('view', customer)"
  >
    <view class="customer-card__heading">
      <view class="customer-card__identity">
        <text
          class="customer-card__name"
          :class="{ 'customer-card__name--inactive': customer.status === 'inactive' }"
        >
          {{ customer.nickname }}
        </text>
        <text class="customer-card__phone">{{ customer.phone }}</text>
      </view>
      <AppIcon
        name="chevron-right"
        :size="18"
        :color="customer.status === 'inactive' ? '#989195' : '#837B82'"
      />
    </view>

    <view class="customer-card__addresses">
      <text v-if="!customer.addresses.length">暂未保存服务地址</text>
      <template v-else>
        <text v-for="address in customer.addresses" :key="address.id">
          {{ address.addressText }}{{ address.note ? ` · ${address.note}` : "" }}
        </text>
      </template>
    </view>

    <view class="customer-card__summary">
      <view class="customer-card__metric">
        <text>累计完成</text>
        <text class="customer-card__metric-value">
          {{ businessSummary.completedCount }}
        </text>
        <text>次</text>
      </view>
      <view class="customer-card__divider" aria-hidden="true" />
      <view class="customer-card__metric customer-card__metric--amount">
        <text>累计成交</text>
        <text class="customer-card__metric-value">
          {{ formatCustomerCurrency(businessSummary.transactionAmountCents) }}
        </text>
      </view>
    </view>
  </button>
</template>

<style scoped>
.customer-card { width: 100%; min-height: 68rpx; box-sizing: border-box; margin: 18rpx 0 0; padding: 32rpx 32rpx 26rpx; border: 2rpx solid rgba(136, 103, 126, 0.08); border-radius: 24rpx; background: rgba(255, 255, 255, 0.96); box-shadow: 0 14rpx 36rpx rgba(111, 76, 99, 0.07); color: #332e32; line-height: 1.35; text-align: left; transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease; }
.customer-card--pressed { border-color: rgba(112, 71, 171, 0.22); box-shadow: 0 8rpx 22rpx rgba(111, 76, 99, 0.08); transform: scale(0.99); }
.customer-card--inactive { border-color: rgba(126, 121, 124, 0.12); background: rgba(238, 235, 237, 0.94); box-shadow: none; color: #696367; }
.customer-card__heading, .customer-card__summary, .customer-card__metric { display: flex; align-items: center; }
.customer-card__heading { align-items: flex-start; justify-content: space-between; gap: 22rpx; }
.customer-card__identity { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 10rpx; }
.customer-card__name { color: #252124; font-size: 31rpx; font-weight: 700; overflow-wrap: anywhere; }
.customer-card__name--inactive { color: #777075; text-decoration: line-through; text-decoration-thickness: 2rpx; }
.customer-card__phone { color: #504a4e; font-size: 25rpx; font-variant-numeric: tabular-nums; letter-spacing: 1rpx; }
.customer-card__addresses { display: flex; margin-top: 24rpx; flex-direction: column; gap: 8rpx; color: #5f585d; font-size: 23rpx; line-height: 1.55; overflow-wrap: anywhere; }
.customer-card__summary { margin-top: 26rpx; padding-top: 24rpx; border-top: 2rpx solid rgba(137, 123, 132, 0.16); flex-wrap: wrap; }
.customer-card__metric { min-width: 0; flex: 1; gap: 8rpx; color: #4a4348; font-size: 22rpx; overflow-wrap: anywhere; }
.customer-card__metric--amount { justify-content: flex-end; text-align: right; }
.customer-card__metric-value { color: #6842ad; font-size: 27rpx; font-weight: 700; font-variant-numeric: tabular-nums; }
.customer-card__divider { width: 2rpx; height: 38rpx; flex: none; margin: 0 22rpx; background: rgba(137, 123, 132, 0.2); }
.customer-card--inactive .customer-card__metric-value { color: #777075; }
.customer-card--inactive .customer-card__divider { background: rgba(116, 110, 114, 0.18); }

@media (max-width: 360px) {
  .customer-card { padding-right: 26rpx; padding-left: 26rpx; }
  .customer-card__summary { align-items: flex-start; flex-direction: column; gap: 12rpx; }
  .customer-card__metric--amount { justify-content: flex-start; text-align: left; }
  .customer-card__divider { width: 100%; height: 2rpx; margin: 0; }
}
</style>
