<script setup lang="ts">
import type { DeepReadonly } from "vue";
import type {
  BeautyProjectV1,
  InventoryItemV1,
  ProjectDefaultUsageV1,
} from "@/domain/data-schema";

/** 项目详情默认用量卡片的只读输入。 */
interface BeautyProjectUsageListProps {
  /** 当前项目，默认用量可以为空。 */
  project: DeepReadonly<BeautyProjectV1>;
  /** 用于解析物品名称和计量单位的库存资料。 */
  inventoryItems: readonly DeepReadonly<InventoryItemV1>[];
}

const props = defineProps<BeautyProjectUsageListProps>();

/** 将一项默认用量解析为可读的物品名称。 */
function itemName(usage: DeepReadonly<ProjectDefaultUsageV1>): string {
  return (
    props.inventoryItems.find(
      (item) => item.id === usage.inventoryItemId,
    )?.name ?? "库存物品不可用"
  );
}

/** 将一项默认用量解析为带单位的数量。 */
function quantityLabel(usage: DeepReadonly<ProjectDefaultUsageV1>): string {
  const unit = props.inventoryItems.find(
    (item) => item.id === usage.inventoryItemId,
  )?.unit;
  return unit ? `${usage.quantity} ${unit}` : usage.quantity;
}
</script>

<template>
  <section class="project-usages" aria-label="默认物品用量">
    <view class="project-usages__heading">
      <text class="project-usages__title">默认物品用量</text>
      <text class="project-usages__count">{{ project.defaultUsages.length }} 项</text>
    </view>
    <text class="project-usages__description">
      创建预约时自动带出，实际用量可调整
    </text>
    <view
      v-if="project.defaultUsages.length"
      class="project-usages__list"
    >
      <view
        v-for="usage in project.defaultUsages"
        :key="usage.inventoryItemId"
        class="project-usages__row"
      >
        <text class="project-usages__name">{{ itemName(usage) }}</text>
        <text class="project-usages__quantity">{{ quantityLabel(usage) }}</text>
      </view>
    </view>
    <view v-else class="project-usages__empty" role="status">
      未设置默认物品用量
    </view>
  </section>
</template>

<style scoped>
.project-usages { position: relative; z-index: 1; margin-top: 24rpx; padding: 32rpx; border: 2rpx solid rgba(136, 103, 126, 0.08); border-radius: 24rpx; background: rgba(255, 255, 255, 0.96); box-shadow: 0 16rpx 40rpx rgba(111, 76, 99, 0.07); }
.project-usages__heading, .project-usages__row { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; }
.project-usages__title { color: #2c272b; font-size: 28rpx; font-weight: 700; }
.project-usages__count { flex: none; color: #766f74; font-size: 22rpx; }
.project-usages__description { display: block; margin-top: 12rpx; color: #776f75; font-size: 21rpx; line-height: 1.45; }
.project-usages__list { margin-top: 26rpx; border-top: 2rpx solid rgba(137, 123, 132, 0.14); }
.project-usages__row { min-height: 84rpx; border-bottom: 2rpx solid rgba(137, 123, 132, 0.12); color: #383237; font-size: 24rpx; }
.project-usages__row:last-child { border-bottom: 0; }
.project-usages__name { min-width: 0; flex: 1; overflow-wrap: anywhere; }
.project-usages__quantity { flex: none; color: #686167; font-variant-numeric: tabular-nums; }
.project-usages__empty { margin-top: 24rpx; padding: 26rpx 20rpx; border-radius: 16rpx; background: #faf7f9; color: #857d83; font-size: 22rpx; text-align: center; }
</style>
