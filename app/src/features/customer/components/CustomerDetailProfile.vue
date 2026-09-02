<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type { CustomerV1 } from "@/domain/data-schema";
import type { CustomerBusinessSummary } from "@/services/statistics-service";
import { formatCustomerCurrency } from "../customer-currency";

/** 顾客详情顶部常驻资料卡的只读输入。 */
interface CustomerDetailProfileProps {
  /** 当前顾客资料。 */
  customer: DeepReadonly<CustomerV1>;
  /** 从已完成预约派生的累计经营数据。 */
  businessSummary: Readonly<CustomerBusinessSummary>;
  /** 写操作期间禁止重复进入编辑。 */
  disabled: boolean;
}

/** 顾客资料卡向详情组合层暴露的资料操作。 */
interface CustomerDetailProfileEmits {
  /** 请求编辑当前顾客资料。 */
  edit: [];
  /** 请求拨打当前顾客手机号。 */
  call: [phoneNumber: string];
}

defineProps<CustomerDetailProfileProps>();
const emit = defineEmits<CustomerDetailProfileEmits>();
</script>

<template>
  <section class="customer-profile" aria-label="顾客当前资料">
    <view class="customer-profile__heading">
      <view class="customer-profile__identity">
        <view class="customer-profile__name-row">
          <text class="customer-profile__name">{{ customer.nickname }}</text>
          <text
            class="customer-profile__status"
            :class="{
              'customer-profile__status--inactive': customer.status === 'inactive',
            }"
          >
            {{ customer.status === "active" ? "启用" : "停用" }}
          </text>
        </view>
        <button
          class="customer-profile__phone"
          :aria-label="`拨打 ${customer.phone}`"
          hover-class="customer-profile__phone--pressed"
          @click="emit('call', customer.phone)"
        >
          <u-icon
            class="customer-profile__phone-icon"
            name="phone"
            color="#6940ae"
            :size="14"
          />
          <text class="customer-profile__phone-number">
            {{ customer.phone }}
          </text>
          <text class="customer-profile__phone-action">拨打</text>
        </button>
      </view>
      <button
        class="customer-profile__edit"
        :disabled="disabled"
        hover-class="customer-profile__edit--pressed"
        @click="emit('edit')"
      >
        编辑资料
      </button>
    </view>

    <view class="customer-profile__metrics">
      <view class="customer-profile__metric">
        <text class="customer-profile__metric-label">累计完成</text>
        <text class="customer-profile__metric-value">
          {{ businessSummary.completedCount }}
        </text>
        <text class="customer-profile__metric-unit">次</text>
      </view>
      <view class="customer-profile__metric-divider" aria-hidden="true" />
      <view class="customer-profile__metric customer-profile__metric--amount">
        <text class="customer-profile__metric-label">累计成交</text>
        <text class="customer-profile__metric-value">
          {{ formatCustomerCurrency(businessSummary.transactionAmountCents) }}
        </text>
      </view>
    </view>
  </section>
</template>

<style scoped>
.customer-profile {
  padding: 30rpx 32rpx 28rpx;
  border: 2rpx solid rgba(136, 103, 126, 0.1);
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14rpx 36rpx rgba(111, 76, 99, 0.07);
}

.customer-profile__heading,
.customer-profile__name-row,
.customer-profile__metrics,
.customer-profile__metric {
  display: flex;
  align-items: center;
}

.customer-profile__heading {
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.customer-profile__identity {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 12rpx;
}

.customer-profile__name-row {
  min-width: 0;
  gap: 14rpx;
  flex-wrap: wrap;
}

.customer-profile__name {
  min-width: 0;
  color: #272227;
  font-size: 34rpx;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.customer-profile__status {
  flex: none;
  padding: 5rpx 12rpx;
  border-radius: 9rpx;
  background: #e9f5ed;
  color: #3d8756;
  font-size: 19rpx;
  font-weight: 600;
}

.customer-profile__status--inactive {
  background: #eceaed;
  color: #777075;
}

.customer-profile__phone {
  display: flex;
  min-height: 58rpx;
  max-width: 100%;
  align-self: flex-start;
  align-items: center;
  justify-content: flex-start;
  gap: 10rpx;
  margin: 0;
  padding: 0 14rpx;
  border-radius: 12rpx;
  background: #f2edfa;
  color: #6940ae;
  font-size: 25rpx;
  line-height: 1;
  text-align: left;
  transition: background-color 120ms ease, opacity 120ms ease, transform 120ms ease;
}

.customer-profile__phone-number {
  min-width: 0;
  font-variant-numeric: tabular-nums;
  letter-spacing: 1rpx;
  overflow-wrap: anywhere;
}

.customer-profile__phone-icon {
  flex: none;
}

.customer-profile__phone-action {
  flex: none;
  color: #744bb4;
  font-size: 20rpx;
  font-weight: 600;
}

.customer-profile__phone--pressed {
  background: #e8def7;
  opacity: 0.8;
  transform: scale(0.98);
}

.customer-profile__edit {
  display: flex;
  height: 68rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 20rpx;
  border: 2rpx solid #7147b4;
  border-radius: 12rpx;
  background: #ffffff;
  color: #6940ae;
  font-size: 22rpx;
  line-height: 1;
  transition: opacity 120ms ease, transform 120ms ease;
}

.customer-profile__edit--pressed {
  opacity: 0.78;
  transform: scale(0.98);
}

.customer-profile__metrics {
  margin-top: 28rpx;
  padding-top: 26rpx;
  border-top: 2rpx solid rgba(137, 123, 132, 0.16);
}

.customer-profile__metric {
  min-width: 0;
  flex: 1;
  gap: 8rpx;
  color: #393238;
  font-size: 23rpx;
  flex-wrap: wrap;
}

.customer-profile__metric--amount {
  justify-content: flex-end;
  text-align: right;
}

.customer-profile__metric-label,
.customer-profile__metric-unit {
  color: #4a4348;
}

.customer-profile__metric-value {
  color: #6439ad;
  font-size: 30rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.customer-profile__metric-divider {
  width: 2rpx;
  height: 40rpx;
  flex: none;
  margin: 0 26rpx;
  background: rgba(137, 123, 132, 0.22);
}

@media (max-width: 360px) {
  .customer-profile { padding-right: 26rpx; padding-left: 26rpx; }
  .customer-profile__metrics { align-items: flex-start; flex-direction: column; gap: 12rpx; }
  .customer-profile__metric--amount { justify-content: flex-start; text-align: left; }
  .customer-profile__metric-divider { width: 100%; height: 2rpx; margin: 0; }
}
</style>
