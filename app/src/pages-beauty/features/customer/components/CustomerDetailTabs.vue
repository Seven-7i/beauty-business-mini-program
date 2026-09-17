<script setup lang="ts">
import type { CustomerDetailTab } from "../composables/useCustomerManagement";

/** 顾客详情 Tab 的只读展示输入。 */
interface CustomerDetailTabsProps {
  /** 当前选中的内容区。 */
  activeTab: CustomerDetailTab;
  /** 历史预约 Tab 旁常驻的记录数量。 */
  appointmentCount: number;
}

/** 顾客详情 Tab 向组合层暴露的选择动作。 */
interface CustomerDetailTabsEmits {
  /** 请求切换到指定内容区。 */
  select: [tab: CustomerDetailTab];
}

defineProps<CustomerDetailTabsProps>();
const emit = defineEmits<CustomerDetailTabsEmits>();
</script>

<template>
  <view class="customer-tabs" role="tablist" aria-label="顾客详情内容">
    <button
      class="customer-tabs__item"
      :class="{ 'customer-tabs__item--active': activeTab === 'profile' }"
      role="tab"
      :aria-selected="activeTab === 'profile'"
      aria-controls="customer-profile-panel"
      @click="emit('select', 'profile')"
    >
      顾客资料
      <view
        v-if="activeTab === 'profile'"
        class="customer-tabs__indicator"
        aria-hidden="true"
      ></view>
    </button>
    <button
      class="customer-tabs__item"
      :class="{ 'customer-tabs__item--active': activeTab === 'history' }"
      role="tab"
      :aria-selected="activeTab === 'history'"
      aria-controls="customer-history-panel"
      @click="emit('select', 'history')"
    >
      历史预约 {{ appointmentCount }}
      <view
        v-if="activeTab === 'history'"
        class="customer-tabs__indicator"
        aria-hidden="true"
      ></view>
    </button>
  </view>
</template>

<style scoped>
.customer-tabs { display: flex; margin-top: 24rpx; border-bottom: 2rpx solid rgba(137, 123, 132, 0.16); }
.customer-tabs__item { position: relative; min-width: 0; min-height: 80rpx; flex: 1; margin: 0; padding: 12rpx 10rpx 18rpx; border: 0; border-radius: 0; background: transparent; color: #6f686d; font-size: 25rpx; font-weight: 500; line-height: 1.35; }
.customer-tabs__item--active { color: #6337ae; font-weight: 700; }
.customer-tabs__indicator { position: absolute; right: 0; bottom: -2rpx; left: 0; height: 4rpx; border-radius: 999rpx; background: #6a3cb3; pointer-events: none; }
</style>
