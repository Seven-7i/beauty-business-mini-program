<script setup lang="ts">
import { computed, ref, type DeepReadonly } from "vue";
import type { CustomerV1 } from "@/domain/data-schema";
import type { CustomerBusinessSummary } from "@/services/statistics-service";

const props = defineProps<{
  customers: readonly CustomerV1[];
  /** 从仍存在的已完成预约派生，不保存到顾客记录。 */
  businessSummaries: Readonly<Record<string, CustomerBusinessSummary>>;
  disabled: boolean;
}>();

const emit = defineEmits<{
  (event: "edit", customer: DeepReadonly<CustomerV1>): void;
  (event: "toggle-status", customer: DeepReadonly<CustomerV1>): void;
  (event: "delete", customer: DeepReadonly<CustomerV1>): void;
}>();

type CustomerFilter = "all" | CustomerV1["status"];
const keyword = ref("");
const filter = ref<CustomerFilter>("all");
const visibleCustomers = computed(() => {
  const query = keyword.value.trim();
  return props.customers.filter(
    (customer) =>
      (filter.value === "all" || customer.status === filter.value) &&
      (!query ||
        customer.nickname.includes(query) ||
        customer.phone.includes(query)),
  );
});

function formatCurrency(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}
</script>

<template>
  <view class="customer-list">
    <view class="customer-list__heading">
      <text class="customer-list__title">顾客资料</text>
      <text class="customer-list__count">{{ visibleCustomers.length }} 位</text>
    </view>
    <input v-model="keyword" class="customer-list__search" maxlength="30" placeholder="搜索昵称或手机号" />
    <view class="customer-list__filters">
      <button v-for="option in [{ value: 'all', label: '全部' }, { value: 'active', label: '启用' }, { value: 'inactive', label: '停用' }]" :key="option.value" :class="{ 'customer-list__filter--active': filter === option.value }" @click="filter = option.value as CustomerFilter">
        {{ option.label }}
      </button>
    </view>

    <view v-if="!visibleCustomers.length" class="customer-list__empty">
      {{ customers.length ? "没有符合条件的顾客" : "还没有顾客，先在上方添加第一位顾客。" }}
    </view>
    <view v-for="customer in visibleCustomers" :key="customer.id" class="customer-card">
      <view class="customer-card__heading">
        <view class="customer-card__identity">
          <text class="customer-card__name">{{ customer.nickname }}</text>
          <text class="customer-card__status" :class="{ 'customer-card__status--inactive': customer.status === 'inactive' }">
            {{ customer.status === "active" ? "启用" : "停用" }}
          </text>
        </view>
        <text class="customer-card__phone">{{ customer.phone }}</text>
      </view>
      <view class="customer-card__addresses">
        <text v-if="!customer.addresses.length">暂未保存服务地址</text>
        <text v-for="address in customer.addresses" v-else :key="address.id">
          {{ address.addressText }}{{ address.note ? ` · ${address.note}` : "" }}
        </text>
      </view>
      <view class="customer-card__summary">
        <text>累计完成 {{ businessSummaries[customer.id]?.completedCount ?? 0 }} 次</text>
        <text>累计成交 {{ formatCurrency(businessSummaries[customer.id]?.transactionAmountCents ?? 0) }}</text>
      </view>
      <view class="customer-card__actions">
        <button :disabled="disabled" @click="emit('edit', customer)">编辑</button>
        <button :disabled="disabled" @click="emit('toggle-status', customer)">{{ customer.status === "active" ? "停用" : "重新启用" }}</button>
        <button class="customer-card__delete" :disabled="disabled" @click="emit('delete', customer)">彻底删除</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.customer-list { margin-top: 28rpx; }
.customer-list__heading, .customer-card__heading, .customer-card__identity, .customer-card__actions, .customer-list__filters { display: flex; align-items: center; }
.customer-list__heading { justify-content: space-between; }
.customer-list__title { color: #263248; font-size: 29rpx; font-weight: 700; }
.customer-list__count { color: #7a8597; font-size: 21rpx; }
.customer-list__search { height: 72rpx; box-sizing: border-box; margin-top: 14rpx; padding: 0 20rpx; border: 2rpx solid #dce2ea; border-radius: 12rpx; background: #fff; font-size: 23rpx; }
.customer-list__filters { gap: 10rpx; margin-top: 12rpx; }
.customer-list__filters button { height: 68rpx; padding: 0 24rpx; border: 2rpx solid #d9dfe8; border-radius: 34rpx; background: #f7f8fa; color: #68748a; font-size: 20rpx; line-height: 66rpx; }
.customer-list__filters .customer-list__filter--active { border-color: #3159b5; background: #e8eefb; color: #3159b5; }
.customer-list__empty { margin-top: 18rpx; padding: 32rpx 20rpx; border: 2rpx dashed #d5dbe4; border-radius: 14rpx; color: #7c8798; font-size: 22rpx; text-align: center; }
.customer-card { margin-top: 16rpx; padding: 24rpx; border: 2rpx solid #e0e5ec; border-radius: 17rpx; background: #fff; }
.customer-card__heading { justify-content: space-between; gap: 16rpx; }
.customer-card__identity { gap: 12rpx; }
.customer-card__name { color: #243047; font-size: 27rpx; font-weight: 700; }
.customer-card__phone { color: #42516b; font-size: 24rpx; }
.customer-card__status { padding: 4rpx 10rpx; border-radius: 8rpx; background: #e5f2ea; color: #34704d; font-size: 18rpx; }
.customer-card__status--inactive { background: #eceef2; color: #737d8d; }
.customer-card__addresses { display: flex; margin-top: 15rpx; flex-direction: column; gap: 7rpx; color: #68748a; font-size: 21rpx; line-height: 1.5; }
.customer-card__summary { display: flex; gap: 12rpx; margin-top: 15rpx; flex-wrap: wrap; }
.customer-card__summary text { padding: 8rpx 12rpx; border-radius: 9rpx; background: #eef2f7; color: #526078; font-size: 19rpx; }
.customer-card__actions { justify-content: flex-end; gap: 8rpx; margin-top: 18rpx; }
.customer-card__actions button { height: 68rpx; padding: 0 20rpx; border-radius: 10rpx; background: #edf1f7; color: #445675; font-size: 20rpx; line-height: 68rpx; }
.customer-card__actions .customer-card__delete { background: #fff0ef; color: #9a4a47; }
</style>
