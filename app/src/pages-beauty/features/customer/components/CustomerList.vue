<script setup lang="ts">
import { computed, shallowRef, type DeepReadonly } from "vue";
import type { CustomerV1 } from "@/domain/data-schema";
import AppIcon from "@/features/shared/components/AppIcon.vue";
import type { CustomerBusinessSummary } from "@/services/statistics-service";
import { filterCustomers } from "../customer-filter";
import CustomerCard from "./CustomerCard.vue";

/** 顾客列表的只读展示输入。 */
interface CustomerListProps {
  /** 已按页面规则排序的全部顾客。 */
  customers: readonly DeepReadonly<CustomerV1>[];
  /** 从仍存在的已完成预约派生，不保存到顾客记录。 */
  businessSummaries: Readonly<Record<string, CustomerBusinessSummary>>;
  /** 页面正在提交业务操作时禁止重复进入。 */
  disabled: boolean;
}

/** 顾客列表向页面编排层暴露的操作。 */
interface CustomerListEmits {
  /** 请求进入独立新增顾客页面。 */
  add: [];
  /** 请求查看指定顾客详情。 */
  view: [customer: DeepReadonly<CustomerV1>];
}

const props = defineProps<CustomerListProps>();
const emit = defineEmits<CustomerListEmits>();
const keyword = shallowRef("");
const inactiveOnly = shallowRef(false);
const visibleCustomers = computed(() =>
  filterCustomers(props.customers, keyword.value, inactiveOnly.value),
);
const emptyMessage = computed(() => {
  if (keyword.value.trim()) {
    return inactiveOnly.value
      ? "没有符合搜索条件的停用顾客"
      : "没有符合搜索条件的启用顾客";
  }
  return inactiveOnly.value
    ? "暂无停用顾客"
    : "还没有启用顾客，点击“新增”添加第一位顾客";
});

/** 在互斥的启用顾客与停用顾客范围之间切换。 */
function toggleInactiveOnly(): void {
  inactiveOnly.value = !inactiveOnly.value;
}
</script>

<template>
  <section class="customer-list" aria-label="顾客资料列表">
    <view class="customer-list__toolbar">
      <label class="customer-list__search">
        <AppIcon name="search" :size="24" color="#777078" />
        <input
          v-model="keyword"
          class="customer-list__search-input"
          maxlength="30"
          placeholder="搜索昵称或手机号"
          placeholder-style="color:#938c92"
          confirm-type="search"
        />
      </label>
      <button
        class="customer-list__add"
        :disabled="disabled"
        aria-label="新增顾客"
        hover-class="customer-list__add--pressed"
        :hover-start-time="20"
        :hover-stay-time="80"
        @click="emit('add')"
      >
        <AppIcon name="add" :size="22" />
        <text>新增</text>
      </button>
    </view>

    <view class="customer-list__scope">
      <text class="customer-list__count">{{ visibleCustomers.length }} 位</text>
      <button
        class="customer-list__inactive-toggle"
        role="checkbox"
        :aria-checked="inactiveOnly"
        :disabled="disabled"
        @click="toggleInactiveOnly"
      >
        <view
          class="customer-list__checkbox"
          :class="{ 'customer-list__checkbox--checked': inactiveOnly }"
          aria-hidden="true"
        >
          <text v-if="inactiveOnly" class="customer-list__checkmark">✓</text>
        </view>
        <text>仅看停用</text>
      </button>
    </view>

    <view v-if="!visibleCustomers.length" class="customer-list__empty" role="status">
      {{ emptyMessage }}
    </view>

    <view v-else class="customer-list__cards">
      <CustomerCard
        v-for="customer in visibleCustomers"
        :key="customer.id"
        :customer="customer"
        :business-summary="businessSummaries[customer.id] ?? { completedCount: 0, transactionAmountCents: 0 }"
        :disabled="disabled"
        @view="emit('view', $event)"
      />
    </view>
  </section>
</template>

<style scoped>
.customer-list {
  position: relative;
  z-index: 1;
}

.customer-list__toolbar,
.customer-list__search,
.customer-list__add,
.customer-list__scope,
.customer-list__inactive-toggle {
  display: flex;
  align-items: center;
}

.customer-list__toolbar {
  gap: 18rpx;
}

.customer-list__search {
  min-width: 0;
  height: 88rpx;
  box-sizing: border-box;
  flex: 1;
  gap: 16rpx;
  padding: 0 24rpx;
  border: 2rpx solid rgba(137, 106, 128, 0.08);
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12rpx 34rpx rgba(111, 75, 101, 0.06);
}

.customer-list__search-input {
  min-width: 0;
  height: 84rpx;
  flex: 1;
  color: #332f33;
  font-size: 25rpx;
}

.customer-list__add {
  width: 164rpx;
  min-height: 88rpx;
  flex: none;
  justify-content: center;
  gap: 8rpx;
  margin: 0;
  padding: 0 18rpx;
  border: 0;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #7853b9 0%, #6437aa 100%);
  box-shadow: 0 14rpx 30rpx rgba(102, 59, 161, 0.22);
  color: #ffffff;
  font-size: 25rpx;
  font-weight: 600;
  line-height: 1;
  transition: opacity 120ms ease, transform 120ms ease;
}

.customer-list__add--pressed {
  opacity: 0.88;
  transform: scale(0.98);
}

.customer-list__scope {
  min-height: 76rpx;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 28rpx;
  padding: 0 2rpx;
}

.customer-list__count {
  color: #6f45b5;
  font-size: 25rpx;
  font-weight: 600;
}

.customer-list__inactive-toggle {
  min-height: 68rpx;
  flex: none;
  gap: 12rpx;
  margin: 0;
  padding: 8rpx 0 8rpx 16rpx;
  border: 0;
  background: transparent;
  color: #413b40;
  font-size: 24rpx;
  line-height: 1.2;
}

.customer-list__checkbox {
  display: flex;
  width: 34rpx;
  height: 34rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #827b80;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.76);
}

.customer-list__checkbox--checked {
  border-color: #6c43b1;
  background: #6c43b1;
}

.customer-list__checkmark {
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 1;
}

.customer-list__empty {
  margin-top: 20rpx;
  padding: 52rpx 28rpx;
  border: 2rpx dashed #ded3dc;
  border-radius: 22rpx;
  background: rgba(255, 253, 253, 0.72);
  color: #837a81;
  font-size: 23rpx;
  line-height: 1.55;
  text-align: center;
}

@media (max-width: 360px) {
  .customer-list__toolbar {
    gap: 12rpx;
  }

  .customer-list__search {
    padding-right: 18rpx;
    padding-left: 18rpx;
  }

  .customer-list__add {
    width: 152rpx;
    padding-right: 14rpx;
    padding-left: 14rpx;
  }

}
</style>
