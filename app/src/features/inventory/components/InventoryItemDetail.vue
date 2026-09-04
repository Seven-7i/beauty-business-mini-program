<script setup lang="ts">
import type { InventoryMovementV1 } from "@/domain/data-schema";
import type {
  InventoryItemDetailTab,
  InventoryItemStockSummary,
} from "../composables/useInventoryManagement";
import InventoryItemDetailSummary from "./InventoryItemDetailSummary.vue";
import InventoryItemDetailTabs from "./InventoryItemDetailTabs.vue";
import InventoryItemProfileDetails from "./InventoryItemProfileDetails.vue";
import InventoryMovementList from "./InventoryMovementList.vue";

/** 物品详情展示层的只读输入。 */
interface InventoryItemDetailProps {
  /** 当前物品及实时库存摘要。 */
  summary: InventoryItemStockSummary;
  /** 只属于当前物品的库存动态。 */
  movements: readonly InventoryMovementV1[];
  /** 当前选中的详情内容区。 */
  activeTab: InventoryItemDetailTab;
  /** 业务提交期间禁止重复触发。 */
  disabled: boolean;
}

/** 物品详情向页面容器暴露的用户意图。 */
interface InventoryItemDetailEmits {
  /** 请求切换资料或库存动态。 */
  selectTab: [tab: InventoryItemDetailTab];
  /** 请求编辑物品资料。 */
  editProfile: [];
  /** 请求切换物品启用状态。 */
  toggleStatus: [];
  /** 请求彻底删除物品。 */
  deleteItem: [];
  /** 请求以指定方式调整库存。 */
  adjust: [kind: "restock" | "stocktake"];
  /** 请求更正一条手工库存记录。 */
  editMovement: [movement: InventoryMovementV1];
  /** 请求删除一条手工库存记录。 */
  deleteMovement: [movement: InventoryMovementV1];
  /** 请求查看预约消耗的来源预约。 */
  openAppointment: [movement: InventoryMovementV1];
}

defineProps<InventoryItemDetailProps>();
const emit = defineEmits<InventoryItemDetailEmits>();
</script>

<template>
  <view class="inventory-detail">
    <InventoryItemDetailSummary
      :summary="summary"
      :disabled="disabled"
      @adjust="(_item, kind) => emit('adjust', kind)"
    />
    <InventoryItemDetailTabs
      :active-tab="activeTab"
      :movement-count="movements.length"
      @select="emit('selectTab', $event)"
    />
    <InventoryItemProfileDetails
      v-if="activeTab === 'profile'"
      :item="summary.item"
      :disabled="disabled"
      @edit="emit('editProfile')"
      @toggle-status="emit('toggleStatus')"
      @delete="emit('deleteItem')"
    />
    <view
      v-else
      id="inventory-activity-panel"
      class="inventory-detail__activity"
      role="tabpanel"
      aria-label="库存动态"
    >
      <InventoryMovementList
        :item="summary.item"
        :movements="movements"
        :disabled="disabled"
        @edit="emit('editMovement', $event)"
        @delete="emit('deleteMovement', $event)"
        @open-appointment="emit('openAppointment', $event)"
      />
    </view>
  </view>
</template>

<style scoped>
.inventory-detail { position: relative; z-index: 1; }
.inventory-detail__activity { position: relative; z-index: 1; }
</style>
