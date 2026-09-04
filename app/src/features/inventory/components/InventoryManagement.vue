<script setup lang="ts">
import { onMounted } from "vue";
import type { InventoryItemV1 } from "@/domain/data-schema";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import type {
  AdjustInventoryInput,
  InventoryManagementService,
} from "@/services/inventory-management-service";
import { useInventoryManagement } from "../composables/useInventoryManagement";
import InventoryItemList from "./InventoryItemList.vue";

/** 库存列表容器的业务用例输入。 */
interface InventoryManagementProps {
  /** 页面可调用的库存管理窄用例。 */
  service: InventoryManagementService;
}

/** 库存列表路由在重新显示时可调用的最小刷新契约。 */
interface InventoryManagementExpose {
  /** 重新读取库存、预约占用和流水快照。 */
  refresh(): Promise<void>;
}

const props = defineProps<InventoryManagementProps>();
const {
  itemSummaries,
  loading,
  submitting,
  errorMessage,
  errorKind,
  refresh,
} = useInventoryManagement({ service: props.service });

/** 从库存列表进入独立新增物品页面。 */
function openCreateItem(): void {
  uni.navigateTo({ url: "/pages/inventory-create/index" });
}

/** 从库存卡片进入该物品的独立详情页。 */
function openItemDetail(item: InventoryItemV1): void {
  uni.navigateTo({
    url: `/pages/inventory-detail/index?inventoryItemId=${encodeURIComponent(item.id)}`,
  });
}

/** 从库存卡片按指定方式进入独立补货或盘点修正页。 */
function adjustItem(
  item: InventoryItemV1,
  kind: AdjustInventoryInput["kind"],
): void {
  uni.navigateTo({
    url: `/pages/inventory-adjustment/index?inventoryItemId=${encodeURIComponent(
      item.id,
    )}&kind=${kind}`,
  });
}

onMounted(refresh);

const exposed: InventoryManagementExpose = { refresh };
defineExpose(exposed);
</script>

<template>
  <main class="inventory-management">
    <view
      class="inventory-management__glow inventory-management__glow--rose"
      aria-hidden="true"
    />
    <view
      class="inventory-management__glow inventory-management__glow--lavender"
      aria-hidden="true"
    />

    <RecoverableErrorNotice
      v-if="errorMessage"
      class="inventory-management__notice"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="refresh"
    />

    <view v-if="loading" class="inventory-management__loading" role="status">
      正在读取本机库存
    </view>
    <view
      v-show="!loading"
      class="inventory-management__list-view"
    >
      <InventoryItemList
        :summaries="itemSummaries"
        :disabled="submitting"
        @add="openCreateItem"
        @view="openItemDetail"
        @adjust="adjustItem"
      />
    </view>
  </main>
</template>

<style scoped>
.inventory-management { position: relative; min-height: 100vh; box-sizing: border-box; overflow: hidden; padding: 34rpx 30rpx calc(56rpx + env(safe-area-inset-bottom)); background: linear-gradient(180deg, #fff8fa 0%, #fbf4f7 52%, #f8f4f7 100%); }
.inventory-management__glow { position: absolute; z-index: 0; border-radius: 999rpx; pointer-events: none; }
.inventory-management__glow--rose { top: -120rpx; right: -170rpx; width: 500rpx; height: 500rpx; background: radial-gradient(circle, rgba(244, 205, 220, 0.5) 0%, rgba(244, 205, 220, 0) 70%); }
.inventory-management__glow--lavender { top: 30rpx; right: -130rpx; width: 420rpx; height: 320rpx; background: radial-gradient(circle, rgba(219, 198, 237, 0.4) 0%, rgba(219, 198, 237, 0) 72%); }
.inventory-management__notice, .inventory-management__loading, .inventory-management__list-view { position: relative; z-index: 2; }
.inventory-management__loading { padding: 28rpx 24rpx; border: 2rpx solid rgba(137, 106, 128, 0.08); border-radius: 20rpx; background: rgba(255, 255, 255, 0.9); color: #766e74; font-size: 23rpx; text-align: center; }

@media (max-width: 360px) {
  .inventory-management { padding-right: 24rpx; padding-left: 24rpx; }
}
</style>
