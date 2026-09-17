<script setup lang="ts">
import type { InventoryItemDetailTab } from "../composables/useInventoryManagement";

/** 物品详情双 Tab 的只读输入。 */
interface InventoryItemDetailTabsProps {
  /** 当前选中的详情内容区。 */
  activeTab: InventoryItemDetailTab;
  /** 当前物品的库存动态数量。 */
  movementCount: number;
}

/** 物品详情双 Tab 向组合层暴露的选择动作。 */
interface InventoryItemDetailTabsEmits {
  /** 请求切换到指定详情内容区。 */
  select: [tab: InventoryItemDetailTab];
}

defineProps<InventoryItemDetailTabsProps>();
const emit = defineEmits<InventoryItemDetailTabsEmits>();
</script>

<template>
  <view class="inventory-tabs" role="tablist" aria-label="物品详情内容">
    <button
      class="inventory-tabs__item"
      :class="{ 'inventory-tabs__item--active': activeTab === 'profile' }"
      role="tab"
      :aria-selected="activeTab === 'profile'"
      aria-controls="inventory-profile-panel"
      @click="emit('select', 'profile')"
    >
      物品资料
      <view
        v-if="activeTab === 'profile'"
        class="inventory-tabs__indicator"
        aria-hidden="true"
      />
    </button>
    <button
      class="inventory-tabs__item"
      :class="{ 'inventory-tabs__item--active': activeTab === 'activity' }"
      role="tab"
      :aria-selected="activeTab === 'activity'"
      aria-controls="inventory-activity-panel"
      @click="emit('select', 'activity')"
    >
      库存动态 {{ movementCount }}
      <view
        v-if="activeTab === 'activity'"
        class="inventory-tabs__indicator"
        aria-hidden="true"
      />
    </button>
  </view>
</template>

<style scoped>
.inventory-tabs { position: relative; z-index: 1; display: flex; margin-top: 24rpx; border-bottom: 2rpx solid rgba(137, 123, 132, 0.16); }
.inventory-tabs__item { position: relative; min-width: 0; min-height: 80rpx; flex: 1; margin: 0; padding: 12rpx 10rpx 18rpx; border: 0; border-radius: 0; background: transparent; color: #6f686d; font-size: 25rpx; font-weight: 500; line-height: 1.35; }
.inventory-tabs__item--active { color: #6337ae; font-weight: 700; }
.inventory-tabs__indicator { position: absolute; right: 0; bottom: -2rpx; left: 0; height: 4rpx; border-radius: 999rpx; background: #6a3cb3; pointer-events: none; }
</style>
