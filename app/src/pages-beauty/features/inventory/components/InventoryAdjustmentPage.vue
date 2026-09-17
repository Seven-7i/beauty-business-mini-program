<script setup lang="ts">
import { computed, nextTick, onMounted } from "vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import type {
  AdjustInventoryInput,
  InventoryManagementService,
} from "@/services/inventory-management-service";
import { useInventoryManagement } from "../composables/useInventoryManagement";
import { useInventoryFormLifecycle } from "../composables/useInventoryFormLifecycle";
import InventoryAdjustmentForm from "./InventoryAdjustmentForm.vue";
import InventoryItemDetailSummary from "./InventoryItemDetailSummary.vue";

/** 独立补货/盘点页的业务输入。 */
interface InventoryAdjustmentPageProps {
  /** 路由参数提供的稳定库存物品标识。 */
  inventoryItemId: string;
  /** 入口决定的初始调整方式。 */
  initialKind: AdjustInventoryInput["kind"];
  /** 页面可调用的库存管理窄用例。 */
  service: InventoryManagementService;
}

/** 独立补货/盘点页向路由组合层暴露的结果。 */
interface InventoryAdjustmentPageEmits {
  /** 缺失或停用物品时请求返回详情或列表。 */
  back: [];
  /** 物品已不存在时请求直接回到库存列表。 */
  missing: [];
  /** 调整成功后交由路由返回来源页面。 */
  saved: [kind: AdjustInventoryInput["kind"]];
  /** 切换调整方式后同步原生导航栏标题。 */
  kindChange: [kind: AdjustInventoryInput["kind"]];
}

/** 调整路由重新显示时可调用的最小刷新契约。 */
interface InventoryAdjustmentPageExpose {
  /** 重新读取当前物品及预约占用，避免使用过期库存。 */
  refresh(): Promise<void>;
}

const props = defineProps<InventoryAdjustmentPageProps>();
const emit = defineEmits<InventoryAdjustmentPageEmits>();
const {
  itemSummaries,
  loading,
  submitting,
  errorMessage,
  errorKind,
  refresh,
  adjustInventory,
} = useInventoryManagement({ service: props.service });
const {
  updateDirty,
  resetDirty,
  updateSaving,
  completionGuard,
} = useInventoryFormLifecycle();
const summary = computed(() =>
  itemSummaries.value.find(
    ({ item }) => item.id === props.inventoryItemId,
  ),
);

/** 保存失败时将页面级错误说明带入当前视口。 */
async function scrollToErrorNotice(): Promise<void> {
  await nextTick();
  uni.pageScrollTo({
    selector: ".inventory-adjustment-page__notice",
    duration: 180,
  });
}

/** 原子提交补货或盘点修正，成功后把实际提交方式交回路由。 */
async function handleAdjustment(input: AdjustInventoryInput): Promise<void> {
  if (submitting.value) {
    return;
  }
  updateSaving(true);
  const saved = await adjustInventory(input);
  if (!completionGuard.isActive()) {
    return;
  }
  if (saved) {
    resetDirty();
    emit("saved", input.kind);
    return;
  }
  updateSaving(false);
  await scrollToErrorNotice();
}

onMounted(refresh);

const exposed: InventoryAdjustmentPageExpose = { refresh };
defineExpose(exposed);
</script>

<template>
  <main class="inventory-adjustment-page">
    <view
      class="inventory-adjustment-page__glow inventory-adjustment-page__glow--rose"
      aria-hidden="true"
    />
    <view
      class="inventory-adjustment-page__glow inventory-adjustment-page__glow--lavender"
      aria-hidden="true"
    />

    <RecoverableErrorNotice
      v-if="errorMessage"
      class="inventory-adjustment-page__notice"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="refresh"
    />
    <view
      v-if="loading && !summary"
      class="inventory-adjustment-page__state"
      role="status"
    >
      正在读取库存
    </view>
    <view
      v-else-if="!summary && !errorMessage"
      class="inventory-adjustment-page__state inventory-adjustment-page__state--error"
      role="alert"
    >
      <text>库存物品不存在，可能已被删除。</text>
      <button @click="emit('missing')">返回库存列表</button>
    </view>
    <view
      v-else-if="summary && summary.item.status !== 'active'"
      class="inventory-adjustment-page__state inventory-adjustment-page__state--error"
      role="alert"
    >
      <text>停用物品不能补货或盘点修正。</text>
      <button @click="emit('back')">返回物品详情</button>
    </view>
    <template v-else-if="summary">
      <InventoryItemDetailSummary
        :summary="summary"
        :disabled="submitting"
        :show-actions="false"
      />
      <InventoryAdjustmentForm
        class="inventory-adjustment-page__form"
        :item="summary.item"
        :initial-kind="initialKind"
        :submitting="submitting"
        @dirty-change="updateDirty"
        @kind-change="emit('kindChange', $event)"
        @submit="handleAdjustment"
      />
    </template>
  </main>
</template>

<style scoped>
.inventory-adjustment-page { position: relative; min-height: 100vh; box-sizing: border-box; overflow: hidden; padding: 30rpx 30rpx calc(52rpx + env(safe-area-inset-bottom)); background: linear-gradient(180deg, #fff8fa 0%, #fbf4f7 54%, #f8f4f7 100%); }
.inventory-adjustment-page__glow { position: absolute; z-index: 0; border-radius: 999rpx; pointer-events: none; }
.inventory-adjustment-page__glow--rose { top: -130rpx; right: -180rpx; width: 500rpx; height: 500rpx; background: radial-gradient(circle, rgba(244, 205, 220, 0.48) 0%, rgba(244, 205, 220, 0) 70%); }
.inventory-adjustment-page__glow--lavender { top: 20rpx; right: -140rpx; width: 420rpx; height: 330rpx; background: radial-gradient(circle, rgba(219, 198, 237, 0.4) 0%, rgba(219, 198, 237, 0) 72%); }
.inventory-adjustment-page__notice, .inventory-adjustment-page__state, .inventory-adjustment-page__form { position: relative; z-index: 2; }
.inventory-adjustment-page__notice { margin-bottom: 20rpx; }
.inventory-adjustment-page__form { margin-top: 26rpx; }
.inventory-adjustment-page__state { padding: 30rpx 24rpx; border: 2rpx solid rgba(137, 106, 128, 0.08); border-radius: 20rpx; background: rgba(255, 255, 255, 0.92); color: #766e74; font-size: 23rpx; line-height: 1.55; text-align: center; }
.inventory-adjustment-page__state--error { display: flex; flex-direction: column; align-items: center; gap: 22rpx; border-color: #ead6d8; background: rgba(255, 248, 248, 0.94); color: #934c54; }
.inventory-adjustment-page__state button { min-width: 240rpx; min-height: 76rpx; margin: 0; padding: 16rpx 28rpx; border-radius: 999rpx; background: #6a3cb3; color: #fff; font-size: 24rpx; line-height: 1.3; }

@media (max-width: 360px) {
  .inventory-adjustment-page { padding-right: 24rpx; padding-left: 24rpx; }
}
</style>
