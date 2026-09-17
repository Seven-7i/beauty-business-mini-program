<script setup lang="ts">
import type { InventoryItemV1 } from "@/domain/data-schema";
import type { InventoryItemStockSummary } from "../composables/useInventoryManagement";

/** 单张库存物品卡片的只读展示输入。 */
interface InventoryItemCardProps {
  /** 物品资料及由待执行预约实时派生的库存摘要。 */
  summary: InventoryItemStockSummary;
  /** 页面提交期间禁止重复操作。 */
  disabled: boolean;
}

/** 库存物品卡片向列表层暴露的操作。 */
interface InventoryItemCardEmits {
  /** 请求进入当前物品详情。 */
  view: [item: InventoryItemV1];
  /** 请求以指定方式调整当前物品库存。 */
  adjust: [item: InventoryItemV1, kind: "restock" | "stocktake"];
}

defineProps<InventoryItemCardProps>();
const emit = defineEmits<InventoryItemCardEmits>();
</script>

<template>
  <article
    class="inventory-card"
    :class="{ 'inventory-card--inactive': summary.item.status === 'inactive' }"
  >
    <button
      class="inventory-card__main"
      :disabled="disabled"
      :aria-label="`查看${summary.item.name}的物品详情`"
      hover-class="inventory-card__main--pressed"
      :hover-start-time="20"
      :hover-stay-time="80"
      @click="emit('view', summary.item)"
    >
      <view class="inventory-card__heading">
        <view class="inventory-card__identity">
          <text
            class="inventory-card__name"
            :class="{ 'inventory-card__name--inactive': summary.item.status === 'inactive' }"
          >
            {{ summary.item.name }}
          </text>
          <text class="inventory-card__unit">{{ summary.item.unit }}</text>
        </view>
        <u-icon name="arrow-right" color="#837B82" size="18" />
      </view>

      <view class="inventory-card__metrics">
        <view class="inventory-card__metric">
          <text class="inventory-card__metric-label">当前库存</text>
          <text class="inventory-card__metric-value">
            {{ summary.item.currentQuantity }}
          </text>
        </view>
        <view class="inventory-card__divider" aria-hidden="true" />
        <view class="inventory-card__metric">
          <text class="inventory-card__metric-label">占用</text>
          <text class="inventory-card__metric-value">
            {{ summary.occupiedQuantity }}
          </text>
        </view>
        <view class="inventory-card__divider" aria-hidden="true" />
        <view class="inventory-card__metric">
          <text class="inventory-card__metric-label">可用库存</text>
          <text class="inventory-card__metric-value inventory-card__metric-value--available">
            {{ summary.availableQuantity }}
          </text>
        </view>
      </view>
    </button>

    <view v-if="summary.item.status === 'active'" class="inventory-card__actions">
      <button
        class="inventory-card__action"
        :disabled="disabled"
        :aria-label="`补货${summary.item.name}`"
        hover-class="inventory-card__action--pressed"
        @click="emit('adjust', summary.item, 'restock')"
      >
        <u-icon name="download" color="#6A43B0" size="19" />
        <text>补货</text>
      </button>
      <button
        class="inventory-card__action"
        :disabled="disabled"
        :aria-label="`盘点修正${summary.item.name}`"
        hover-class="inventory-card__action--pressed"
        @click="emit('adjust', summary.item, 'stocktake')"
      >
        <u-icon name="edit-pen" color="#6A43B0" size="19" />
        <text>盘点修正</text>
      </button>
    </view>
  </article>
</template>

<style scoped>
.inventory-card { margin-top: 20rpx; overflow: hidden; border: 2rpx solid rgba(136, 103, 126, 0.08); border-radius: 24rpx; background: rgba(255, 255, 255, 0.96); box-shadow: 0 14rpx 36rpx rgba(111, 76, 99, 0.07); }
.inventory-card--inactive { border-color: rgba(126, 121, 124, 0.12); background: rgba(238, 235, 237, 0.94); box-shadow: none; }
.inventory-card__main { width: 100%; box-sizing: border-box; margin: 0; padding: 30rpx 32rpx 26rpx; border: 0; border-radius: 0; background: transparent; color: #332e32; line-height: 1.3; text-align: left; transition: background-color 120ms ease, transform 120ms ease; }
.inventory-card__main--pressed { background: rgba(111, 69, 181, 0.035); transform: scale(0.995); }
.inventory-card__heading, .inventory-card__identity, .inventory-card__metrics, .inventory-card__metric, .inventory-card__actions, .inventory-card__action { display: flex; align-items: center; }
.inventory-card__heading { justify-content: space-between; gap: 18rpx; }
.inventory-card__identity { min-width: 0; flex: 1; align-items: baseline; gap: 14rpx; }
.inventory-card__name { min-width: 0; color: #252124; font-size: 31rpx; font-weight: 700; overflow-wrap: anywhere; }
.inventory-card__name--inactive { color: #777075; text-decoration: line-through; text-decoration-thickness: 2rpx; }
.inventory-card__unit { flex: none; color: #7650b7; font-size: 21rpx; }
.inventory-card__metrics { margin-top: 32rpx; }
.inventory-card__metric { min-width: 0; flex: 1; flex-direction: column; }
.inventory-card__metric-label { color: #766f74; font-size: 21rpx; }
.inventory-card__metric-value { max-width: 100%; margin-top: 12rpx; color: #625d61; font-size: 35rpx; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.inventory-card__metric-value--available { color: #4c9f71; }
.inventory-card__divider { width: 2rpx; height: 82rpx; flex: none; background: rgba(137, 123, 132, 0.18); }
.inventory-card__actions { min-height: 84rpx; border-top: 2rpx solid rgba(137, 123, 132, 0.16); }
.inventory-card__action { min-height: 84rpx; flex: 1; justify-content: center; gap: 10rpx; margin: 0; padding: 0 12rpx; border: 0; border-radius: 0; background: transparent; color: #6a43b0; font-size: 23rpx; font-weight: 500; line-height: 1; transition: background-color 120ms ease; }
.inventory-card__action + .inventory-card__action { border-left: 2rpx solid rgba(137, 123, 132, 0.14); }
.inventory-card__action--pressed { background: rgba(106, 67, 176, 0.07); }
.inventory-card--inactive .inventory-card__unit, .inventory-card--inactive .inventory-card__metric-value, .inventory-card--inactive .inventory-card__metric-value--available { color: #777075; }

@media (max-width: 360px) {
  .inventory-card__main { padding-right: 24rpx; padding-left: 24rpx; }
  .inventory-card__metric-label { font-size: 19rpx; }
  .inventory-card__metric-value { font-size: 31rpx; }
}
</style>
