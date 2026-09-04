<script setup lang="ts">
import { computed, shallowRef } from "vue";
import type { InventoryItemV1 } from "@/domain/data-schema";
import {
  filterInventoryItems,
  type InventoryItemStockSummary,
} from "../composables/useInventoryManagement";
import InventoryItemCard from "./InventoryItemCard.vue";

/** 库存物品列表的只读展示输入。 */
interface InventoryItemListProps {
  /** 已按状态和名称排序的全部库存摘要。 */
  summaries: readonly InventoryItemStockSummary[];
  /** 页面正在提交业务操作时禁止重复进入。 */
  disabled: boolean;
}

/** 库存物品列表向页面编排层暴露的操作。 */
interface InventoryItemListEmits {
  /** 请求打开新增库存物品表单。 */
  add: [];
  /** 请求进入指定库存物品详情。 */
  view: [item: InventoryItemV1];
  /** 请求以指定方式调整库存。 */
  adjust: [item: InventoryItemV1, kind: "restock" | "stocktake"];
}

const props = defineProps<InventoryItemListProps>();
const emit = defineEmits<InventoryItemListEmits>();
const keyword = shallowRef("");
const inactiveOnly = shallowRef(false);
const visibleSummaries = computed(() =>
  filterInventoryItems(props.summaries, keyword.value, inactiveOnly.value),
);
const emptyMessage = computed(() => {
  if (keyword.value.trim()) {
    return inactiveOnly.value
      ? "没有符合搜索条件的停用物品"
      : "没有符合搜索条件的启用物品";
  }
  return inactiveOnly.value
    ? "暂无停用库存物品"
    : "还没有启用库存物品，点击“新增”添加第一项物品";
});

/** 在互斥的启用物品与停用物品范围之间切换。 */
function toggleInactiveOnly(): void {
  inactiveOnly.value = !inactiveOnly.value;
}
</script>

<template>
  <section class="inventory-list" aria-label="库存物品列表">
    <view class="inventory-list__toolbar">
      <label class="inventory-list__search">
        <u-icon name="search" color="#777078" size="24" />
        <input
          v-model="keyword"
          class="inventory-list__search-input"
          maxlength="40"
          placeholder="搜索物品名称"
          placeholder-style="color:#938c92"
          confirm-type="search"
        />
      </label>
      <button
        class="inventory-list__add"
        :disabled="disabled"
        aria-label="新增库存物品"
        hover-class="inventory-list__add--pressed"
        :hover-start-time="20"
        :hover-stay-time="80"
        @click="emit('add')"
      >
        <u-icon name="plus" color="#FFFFFF" size="22" />
        <text>新增</text>
      </button>
    </view>

    <view class="inventory-list__scope">
      <text class="inventory-list__count">{{ visibleSummaries.length }} 种</text>
      <button
        class="inventory-list__inactive-toggle"
        role="checkbox"
        :aria-checked="inactiveOnly"
        :disabled="disabled"
        @click="toggleInactiveOnly"
      >
        <view
          class="inventory-list__checkbox"
          :class="{ 'inventory-list__checkbox--checked': inactiveOnly }"
          aria-hidden="true"
        >
          <text v-if="inactiveOnly" class="inventory-list__checkmark">✓</text>
        </view>
        <text>仅看停用</text>
      </button>
    </view>

    <view v-if="!visibleSummaries.length" class="inventory-list__empty" role="status">
      {{ emptyMessage }}
    </view>

    <view v-else class="inventory-list__cards">
      <InventoryItemCard
        v-for="summary in visibleSummaries"
        :key="summary.item.id"
        :summary="summary"
        :disabled="disabled"
        @view="emit('view', $event)"
        @adjust="(item, kind) => emit('adjust', item, kind)"
      />
    </view>
  </section>
</template>

<style scoped>
.inventory-list { position: relative; z-index: 1; }
.inventory-list__toolbar, .inventory-list__search, .inventory-list__add, .inventory-list__scope, .inventory-list__inactive-toggle { display: flex; align-items: center; }
.inventory-list__toolbar { gap: 18rpx; }
.inventory-list__search { min-width: 0; height: 88rpx; box-sizing: border-box; flex: 1; gap: 16rpx; padding: 0 24rpx; border: 2rpx solid rgba(137, 106, 128, 0.08); border-radius: 22rpx; background: rgba(255, 255, 255, 0.94); box-shadow: 0 12rpx 34rpx rgba(111, 75, 101, 0.06); }
.inventory-list__search-input { min-width: 0; height: 84rpx; flex: 1; color: #332f33; font-size: 25rpx; }
.inventory-list__add { width: 164rpx; min-height: 88rpx; flex: none; justify-content: center; gap: 8rpx; margin: 0; padding: 0 18rpx; border: 0; border-radius: 22rpx; background: linear-gradient(135deg, #7853b9 0%, #6437aa 100%); box-shadow: 0 14rpx 30rpx rgba(102, 59, 161, 0.22); color: #ffffff; font-size: 25rpx; font-weight: 600; line-height: 1; transition: opacity 120ms ease, transform 120ms ease; }
.inventory-list__add--pressed { opacity: 0.88; transform: scale(0.98); }
.inventory-list__scope { min-height: 76rpx; justify-content: space-between; gap: 18rpx; margin-top: 28rpx; padding: 0 2rpx; flex-wrap: wrap; }
.inventory-list__count { color: #6f45b5; font-size: 25rpx; font-weight: 600; }
.inventory-list__inactive-toggle { min-height: 68rpx; flex: none; gap: 12rpx; margin: 0; padding: 8rpx 0 8rpx 16rpx; border: 0; background: transparent; color: #413b40; font-size: 24rpx; line-height: 1.2; }
.inventory-list__checkbox { display: flex; width: 34rpx; height: 34rpx; box-sizing: border-box; align-items: center; justify-content: center; border: 2rpx solid #827b80; border-radius: 8rpx; background: rgba(255, 255, 255, 0.76); }
.inventory-list__checkbox--checked { border-color: #6c43b1; background: #6c43b1; }
.inventory-list__checkmark { color: #ffffff; font-size: 24rpx; font-weight: 700; line-height: 1; }
.inventory-list__empty { margin-top: 20rpx; padding: 52rpx 28rpx; border: 2rpx dashed #ded3dc; border-radius: 22rpx; background: rgba(255, 253, 253, 0.72); color: #837a81; font-size: 23rpx; line-height: 1.55; text-align: center; }
.inventory-list__cards { overflow-wrap: anywhere; }

@media (max-width: 360px) {
  .inventory-list__toolbar { gap: 12rpx; }
  .inventory-list__search { padding-right: 18rpx; padding-left: 18rpx; }
  .inventory-list__add { width: 152rpx; padding-right: 14rpx; padding-left: 14rpx; }
}
</style>
