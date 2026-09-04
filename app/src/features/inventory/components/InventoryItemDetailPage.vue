<script setup lang="ts">
import { computed, nextTick, onMounted, shallowRef } from "vue";
import type { InventoryMovementV1 } from "@/domain/data-schema";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import type {
  AdjustInventoryInput,
  InventoryManagementService,
  RewriteManualInventoryMovementInput,
} from "@/services/inventory-management-service";
import {
  filterInventoryMovementsForItem,
  type InventoryItemDetailTab,
  useInventoryManagement,
} from "../composables/useInventoryManagement";
import InventoryItemDetail from "./InventoryItemDetail.vue";
import InventoryMovementEditForm from "./InventoryMovementEditForm.vue";

/** 独立物品详情页的业务输入。 */
interface InventoryItemDetailPageProps {
  /** 路由参数提供的稳定库存物品标识。 */
  inventoryItemId: string;
  /** 页面可调用的库存管理窄用例。 */
  service: InventoryManagementService;
}

/** 独立物品详情页向路由组合层暴露的结果。 */
interface InventoryItemDetailPageEmits {
  /** 缺失物品时请求返回库存列表。 */
  back: [];
  /** 当前物品已被彻底删除，路由应返回列表。 */
  deleted: [];
}

/** 详情路由在重新显示时可调用的最小刷新契约。 */
interface InventoryItemDetailPageExpose {
  /** 重新读取当前物品、预约占用和库存动态。 */
  refresh(): Promise<void>;
}

const props = defineProps<InventoryItemDetailPageProps>();
const emit = defineEmits<InventoryItemDetailPageEmits>();
const {
  items,
  itemSummaries,
  movementsByRecency,
  loading,
  submitting,
  errorMessage,
  errorKind,
  refresh,
  setItemStatus,
  deleteItem,
  rewriteMovement,
} = useInventoryManagement({ service: props.service });
const activeTab = shallowRef<InventoryItemDetailTab>("activity");
const selectedMovement = shallowRef<InventoryMovementV1>();
const item = computed(() =>
  items.value.find((candidate) => candidate.id === props.inventoryItemId),
);
const summary = computed(() =>
  itemSummaries.value.find(
    ({ item: candidate }) => candidate.id === props.inventoryItemId,
  ),
);
const itemMovements = computed(() =>
  filterInventoryMovementsForItem(
    movementsByRecency.value,
    props.inventoryItemId,
  ),
);
const showingDetail = computed(() => !selectedMovement.value);

/** 非字段错误出现时把视口带到页面级说明。 */
async function scrollToErrorNotice(): Promise<void> {
  await nextTick();
  uni.pageScrollTo({
    selector: ".inventory-detail-page__notice",
    duration: 180,
  });
}

/** 从详情进入当前物品的独立补货或盘点修正页。 */
function openAdjustment(kind: AdjustInventoryInput["kind"]): void {
  uni.navigateTo({
    url: `/pages/inventory-adjustment/index?inventoryItemId=${encodeURIComponent(
      props.inventoryItemId,
    )}&kind=${kind}`,
  });
}

/** 从资料 Tab 进入当前物品的独立资料编辑页。 */
function openProfileEditor(): void {
  uni.navigateTo({
    url: `/pages/inventory-profile-edit/index?inventoryItemId=${encodeURIComponent(
      props.inventoryItemId,
    )}`,
  });
}

/** 按引用规则确认停用，或直接尝试重新启用当前物品。 */
async function toggleStatus(): Promise<void> {
  const current = item.value;
  if (!current) {
    return;
  }
  if (current.status === "inactive") {
    if (await setItemStatus(current.id, "active")) {
      uni.showToast({ title: "物品已重新启用", icon: "success" });
    } else {
      await scrollToErrorNotice();
    }
    return;
  }
  uni.showModal({
    title: `停用“${current.name}”？`,
    content: "停用后历史记录仍会保留，但不能再用于新项目和新预约。",
    confirmText: "确认停用",
    confirmColor: "#A94442",
    success(result) {
      if (result.confirm) {
        void setItemStatus(current.id, "inactive").then((saved) => {
          if (saved) {
            uni.showToast({ title: "物品已停用", icon: "none" });
          } else {
            void scrollToErrorNotice();
          }
        });
      }
    },
    fail() {
      uni.showToast({ title: "确认框打开失败", icon: "none" });
    },
  });
}

/** 二次确认后按引用规则尝试彻底删除当前物品。 */
function confirmDeleteItem(): void {
  const current = item.value;
  if (!current) {
    return;
  }
  uni.showModal({
    title: `彻底删除“${current.name}”？`,
    content: "仅从未被项目或预约引用的物品可以删除；删除后相关手工动态也无法恢复。",
    confirmText: "彻底删除",
    confirmColor: "#A94442",
    success(result) {
      if (result.confirm) {
        void deleteItem(current.id).then((deleted) => {
          if (deleted) {
            emit("deleted");
          } else {
            void scrollToErrorNotice();
          }
        });
      }
    },
    fail() {
      uni.showToast({ title: "确认框打开失败", icon: "none" });
    },
  });
}

/** 打开一条手工库存动态的更正表单。 */
function editMovement(movement: InventoryMovementV1): void {
  selectedMovement.value = movement;
}

/** 保存手工动态更正后返回当前物品的动态 Tab。 */
async function handleMovementEdit(
  input: RewriteManualInventoryMovementInput,
): Promise<void> {
  if (await rewriteMovement(input)) {
    selectedMovement.value = undefined;
    activeTab.value = "activity";
    uni.showToast({ title: "库存动态已更新", icon: "none" });
  } else {
    await scrollToErrorNotice();
  }
}

/** 二次确认后删除手工动态，并由服务重算后续库存结余。 */
function confirmDeleteMovement(movement: InventoryMovementV1): void {
  uni.showModal({
    title: "删除这条手工库存动态？",
    content: "删除后会重新计算后续库存结余；若低于预约占用，系统会阻止删除。",
    confirmText: "删除重算",
    confirmColor: "#A94442",
    success(result) {
      if (result.confirm) {
        void rewriteMovement({
          movementId: movement.id,
          operation: "delete",
        }).then((deleted) => {
          if (deleted) {
            activeTab.value = "activity";
            uni.showToast({ title: "库存动态已删除", icon: "none" });
          } else {
            void scrollToErrorNotice();
          }
        });
      }
    },
    fail() {
      uni.showToast({ title: "确认框打开失败", icon: "none" });
    },
  });
}

/** 从预约消耗动态进入来源预约的完成信息。 */
function openSourceAppointment(movement: InventoryMovementV1): void {
  if (!movement.appointmentId || movement.appointmentDeleted) {
    return;
  }
  uni.navigateTo({
    url: `/pages/appointment/index?appointmentId=${encodeURIComponent(
      movement.appointmentId,
    )}`,
  });
}

onMounted(refresh);

const exposed: InventoryItemDetailPageExpose = { refresh };
defineExpose(exposed);
</script>

<template>
  <main class="inventory-detail-page">
    <view
      class="inventory-detail-page__glow inventory-detail-page__glow--rose"
      aria-hidden="true"
    />
    <view
      class="inventory-detail-page__glow inventory-detail-page__glow--lavender"
      aria-hidden="true"
    />

    <RecoverableErrorNotice
      v-if="errorMessage"
      class="inventory-detail-page__notice"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="refresh"
    />

    <view
      v-if="loading && !summary"
      class="inventory-detail-page__loading"
      role="status"
    >
      正在读取物品详情
    </view>
    <view
      v-else-if="!summary && !errorMessage"
      class="inventory-detail-page__missing"
      role="alert"
    >
      <text>库存物品不存在，可能已被删除。</text>
      <button @click="emit('back')">返回库存列表</button>
    </view>
    <InventoryMovementEditForm
      v-else-if="summary && selectedMovement"
      class="inventory-detail-page__panel"
      :movement="selectedMovement"
      :item="summary.item"
      :submitting="submitting"
      @submit="handleMovementEdit"
      @cancel="selectedMovement = undefined"
    />
    <InventoryItemDetail
      v-else-if="summary && showingDetail"
      :summary="summary"
      :movements="itemMovements"
      :active-tab="activeTab"
      :disabled="submitting"
      @select-tab="activeTab = $event"
      @edit-profile="openProfileEditor"
      @toggle-status="toggleStatus"
      @delete-item="confirmDeleteItem"
      @adjust="openAdjustment"
      @edit-movement="editMovement"
      @delete-movement="confirmDeleteMovement"
      @open-appointment="openSourceAppointment"
    />
  </main>
</template>

<style scoped>
.inventory-detail-page { position: relative; min-height: 100vh; box-sizing: border-box; overflow: hidden; padding: 30rpx 30rpx calc(52rpx + env(safe-area-inset-bottom)); background: linear-gradient(180deg, #fff8fa 0%, #fbf4f7 54%, #f8f4f7 100%); }
.inventory-detail-page__glow { position: absolute; z-index: 0; border-radius: 999rpx; pointer-events: none; }
.inventory-detail-page__glow--rose { top: -130rpx; right: -180rpx; width: 500rpx; height: 500rpx; background: radial-gradient(circle, rgba(244, 205, 220, 0.48) 0%, rgba(244, 205, 220, 0) 70%); }
.inventory-detail-page__glow--lavender { top: 20rpx; right: -140rpx; width: 420rpx; height: 330rpx; background: radial-gradient(circle, rgba(219, 198, 237, 0.4) 0%, rgba(219, 198, 237, 0) 72%); }
.inventory-detail-page__notice, .inventory-detail-page__loading, .inventory-detail-page__missing, .inventory-detail-page__panel { position: relative; z-index: 2; }
.inventory-detail-page__notice { margin-bottom: 20rpx; }
.inventory-detail-page__loading { padding: 30rpx 24rpx; border: 2rpx solid rgba(137, 106, 128, 0.08); border-radius: 20rpx; background: rgba(255, 255, 255, 0.92); color: #766e74; font-size: 23rpx; text-align: center; }
.inventory-detail-page__missing { display: flex; flex-direction: column; align-items: center; gap: 22rpx; padding: 38rpx 28rpx; border: 2rpx solid #ead6d8; border-radius: 24rpx; background: rgba(255, 248, 248, 0.94); color: #934c54; font-size: 23rpx; line-height: 1.55; text-align: center; }
.inventory-detail-page__missing button { min-width: 240rpx; min-height: 76rpx; margin: 0; padding: 16rpx 28rpx; border-radius: 999rpx; background: #6a3cb3; color: #fff; font-size: 24rpx; line-height: 1.3; }
.inventory-detail-page__panel { margin-top: 0; }

@media (max-width: 360px) {
  .inventory-detail-page { padding-right: 24rpx; padding-left: 24rpx; }
}
</style>
