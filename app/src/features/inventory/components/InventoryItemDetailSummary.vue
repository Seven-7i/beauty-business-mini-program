<script setup lang="ts">
import type { InventoryItemV1 } from "@/domain/data-schema";
import type { InventoryItemStockSummary } from "../composables/useInventoryManagement";

/** 物品详情顶部库存概览的只读输入。 */
interface InventoryItemDetailSummaryProps {
  /** 当前物品及实时派生的占用、可用库存。 */
  summary: InventoryItemStockSummary;
  /** 业务提交期间禁止重复调整。 */
  disabled: boolean;
  /** 是否展示详情页使用的补货与盘点快捷操作。 */
  showActions?: boolean;
}

/** 库存概览向详情容器暴露的快捷调整操作。 */
interface InventoryItemDetailSummaryEmits {
  /** 请求以指定方式调整当前物品库存。 */
  adjust: [item: InventoryItemV1, kind: "restock" | "stocktake"];
}

withDefaults(defineProps<InventoryItemDetailSummaryProps>(), {
  showActions: true,
});
const emit = defineEmits<InventoryItemDetailSummaryEmits>();
</script>

<template>
  <section
    class="detail-summary"
    :class="{ 'detail-summary--inactive': summary.item.status === 'inactive' }"
    aria-label="物品库存概览"
  >
    <view class="detail-summary__identity">
      <text class="detail-summary__name">{{ summary.item.name }}</text>
      <text class="detail-summary__unit">{{ summary.item.unit }}</text>
      <text
        class="detail-summary__status"
        :class="{
          'detail-summary__status--inactive':
            summary.item.status === 'inactive',
        }"
      >
        {{ summary.item.status === "active" ? "启用" : "停用" }}
      </text>
    </view>

    <view class="detail-summary__metrics">
      <view class="detail-summary__metric">
        <text class="detail-summary__metric-label">当前库存</text>
        <text class="detail-summary__metric-value">
          {{ summary.item.currentQuantity }}
        </text>
      </view>
      <view class="detail-summary__divider" aria-hidden="true" />
      <view class="detail-summary__metric">
        <text class="detail-summary__metric-label">占用</text>
        <text class="detail-summary__metric-value">
          {{ summary.occupiedQuantity }}
        </text>
      </view>
      <view class="detail-summary__divider" aria-hidden="true" />
      <view class="detail-summary__metric">
        <text class="detail-summary__metric-label">可用库存</text>
        <text class="detail-summary__metric-value detail-summary__metric-value--available">
          {{ summary.availableQuantity }}
        </text>
      </view>
    </view>

    <view
      v-if="showActions && summary.item.status === 'active'"
      class="detail-summary__actions"
    >
      <button
        :disabled="disabled"
        hover-class="detail-summary__action--pressed"
        @click="emit('adjust', summary.item, 'restock')"
      >
        <u-icon name="download" color="#6A43B0" size="20" />
        <text>补货</text>
      </button>
      <button
        :disabled="disabled"
        hover-class="detail-summary__action--pressed"
        @click="emit('adjust', summary.item, 'stocktake')"
      >
        <u-icon name="edit-pen" color="#6A43B0" size="20" />
        <text>盘点修正</text>
      </button>
    </view>
  </section>
</template>

<style scoped>
.detail-summary { position: relative; z-index: 1; overflow: hidden; border: 2rpx solid rgba(136, 103, 126, 0.08); border-radius: 24rpx; background: rgba(255, 255, 255, 0.96); box-shadow: 0 16rpx 40rpx rgba(111, 76, 99, 0.07); }
.detail-summary--inactive { background: rgba(246, 243, 245, 0.96); box-shadow: none; }
.detail-summary__identity, .detail-summary__metrics, .detail-summary__metric, .detail-summary__actions, .detail-summary__actions button { display: flex; align-items: center; }
.detail-summary__identity { gap: 14rpx; padding: 30rpx 32rpx 0; flex-wrap: wrap; }
.detail-summary__name { color: #252124; font-size: 32rpx; font-weight: 700; overflow-wrap: anywhere; }
.detail-summary__unit { color: #7650b7; font-size: 21rpx; }
.detail-summary__status { padding: 5rpx 12rpx; border-radius: 9rpx; background: #e6f4e9; color: #2e8b4d; font-size: 19rpx; }
.detail-summary__status--inactive { background: #ebe8ea; color: #746d72; }
.detail-summary__metrics { padding: 34rpx 20rpx 32rpx; }
.detail-summary__metric { min-width: 0; flex: 1; flex-direction: column; }
.detail-summary__metric-label { color: #766f74; font-size: 21rpx; }
.detail-summary__metric-value { max-width: 100%; margin-top: 12rpx; color: #625d61; font-size: 36rpx; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.detail-summary__metric-value--available { color: #4c9f71; }
.detail-summary__divider { width: 2rpx; height: 86rpx; flex: none; background: rgba(137, 123, 132, 0.18); }
.detail-summary__actions { min-height: 88rpx; border-top: 2rpx solid rgba(137, 123, 132, 0.16); }
.detail-summary__actions button { min-height: 88rpx; flex: 1; justify-content: center; gap: 10rpx; margin: 0; padding: 0 12rpx; border: 0; border-radius: 0; background: transparent; color: #6a43b0; font-size: 23rpx; line-height: 1; }
.detail-summary__actions button + button { border-left: 2rpx solid rgba(137, 123, 132, 0.14); }
.detail-summary__action--pressed { background: rgba(106, 67, 176, 0.07) !important; }

@media (max-width: 360px) {
  .detail-summary__identity { padding-right: 24rpx; padding-left: 24rpx; }
  .detail-summary__metric-label { font-size: 19rpx; }
  .detail-summary__metric-value { font-size: 31rpx; }
}
</style>
