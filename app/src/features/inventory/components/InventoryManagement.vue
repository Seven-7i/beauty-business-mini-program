<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from "vue";
import type { InventoryItemV1, InventoryMovementV1 } from "@/domain/data-schema";
import type {
  AdjustInventoryInput,
  CreateInventoryItemInput,
  InventoryManagementService,
  RewriteManualInventoryMovementInput,
  UpdateInventoryItemProfileInput,
} from "@/services/inventory-management-service";
import InventoryAdjustmentForm from "./InventoryAdjustmentForm.vue";
import InventoryItemForm from "./InventoryItemForm.vue";
import InventoryItemList from "./InventoryItemList.vue";
import InventoryItemProfileForm from "./InventoryItemProfileForm.vue";
import InventoryMovementList from "./InventoryMovementList.vue";
import InventoryMovementEditForm from "./InventoryMovementEditForm.vue";
import { useInventoryManagement } from "../composables/useInventoryManagement";

const props = defineProps<{
  service: InventoryManagementService;
  /** 快速新增模式保存后直接返回来源表单，并回传新物品标识。 */
  quickAddMode?: boolean;
}>();

const emit = defineEmits<{
  (event: "open-projects"): void;
  (event: "quick-add-complete", inventoryItemId: string): void;
}>();

const {
  items,
  itemSummaries,
  movementsByRecency,
  loading,
  submitting,
  errorMessage,
  refresh,
  createItem,
  adjustInventory,
  updateItemProfile,
  setItemStatus,
  deleteItem,
  rewriteMovement,
} = useInventoryManagement({ service: props.service });
const selectedItem = shallowRef<InventoryItemV1>();
const selectedProfileItem = shallowRef<InventoryItemV1>();
const selectedMovement = shallowRef<InventoryMovementV1>();
const selectedMovementItem = computed(() =>
  selectedMovement.value
    ? items.value.find(
        (item) => item.id === selectedMovement.value?.inventoryItemId,
      )
    : undefined,
);
const itemForm = ref<InstanceType<typeof InventoryItemForm> | null>(null);

async function handleCreate(input: CreateInventoryItemInput): Promise<void> {
  const created = await createItem(input);
  if (created) {
    itemForm.value?.reset();
    if (props.quickAddMode) {
      emit("quick-add-complete", created.id);
      return;
    }
    uni.showToast({ title: "库存物品已保存", icon: "success" });
  }
}

async function handleAdjustment(input: AdjustInventoryInput): Promise<void> {
  if (await adjustInventory(input)) {
    selectedItem.value = undefined;
    uni.showToast({ title: "库存已更新", icon: "success" });
  }
}

async function handleProfileUpdate(
  input: UpdateInventoryItemProfileInput,
): Promise<void> {
  if (await updateItemProfile(input)) {
    selectedProfileItem.value = undefined;
    uni.showToast({ title: "物品资料已更新", icon: "success" });
  }
}

function editItem(item: InventoryItemV1): void {
  selectedItem.value = undefined;
  selectedMovement.value = undefined;
  selectedProfileItem.value = item;
}

function adjustItem(item: InventoryItemV1): void {
  selectedProfileItem.value = undefined;
  selectedMovement.value = undefined;
  selectedItem.value = item;
}

async function changeItemStatus(item: InventoryItemV1): Promise<void> {
  const targetStatus = item.status === "active" ? "inactive" : "active";
  if (targetStatus === "active") {
    if (await setItemStatus(item.id, targetStatus)) {
      uni.showToast({ title: "物品已重新启用", icon: "success" });
    }
    return;
  }
  uni.showModal({
    title: `停用“${item.name}”？`,
    content: "停用后历史记录仍会保留，但不能再用于新项目和新预约。",
    confirmText: "确认停用",
    confirmColor: "#A94442",
    success(result) {
      if (result.confirm) {
        void setItemStatus(item.id, "inactive").then((saved) => {
          if (saved) {
            selectedItem.value = undefined;
            selectedProfileItem.value = undefined;
            uni.showToast({ title: "物品已停用", icon: "none" });
          }
        });
      }
    },
  });
}

function confirmDeleteItem(item: InventoryItemV1): void {
  uni.showModal({
    title: `彻底删除“${item.name}”？`,
    content: "仅从未被项目或预约引用的物品可以删除；删除后相关手工变动也无法恢复。",
    confirmText: "彻底删除",
    confirmColor: "#A94442",
    success(result) {
      if (result.confirm) {
        void deleteItem(item.id).then((deleted) => {
          if (deleted) {
            selectedItem.value = undefined;
            selectedProfileItem.value = undefined;
            uni.showToast({ title: "物品已删除", icon: "none" });
          }
        });
      }
    },
  });
}

function editMovement(movement: InventoryMovementV1): void {
  selectedItem.value = undefined;
  selectedProfileItem.value = undefined;
  selectedMovement.value = movement;
}

async function handleMovementEdit(
  input: RewriteManualInventoryMovementInput,
): Promise<void> {
  if (await rewriteMovement(input)) {
    selectedMovement.value = undefined;
    uni.showToast({ title: "库存记录已更新", icon: "success" });
  }
}

function confirmDeleteMovement(movement: InventoryMovementV1): void {
  uni.showModal({
    title: "删除这条手工库存记录？",
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
            selectedMovement.value = undefined;
            uni.showToast({ title: "库存记录已删除", icon: "none" });
          }
        });
      }
    },
  });
}

onMounted(refresh);
</script>

<template>
  <view class="inventory-management">
    <view class="inventory-management__intro">
      <text class="inventory-management__eyebrow">美容 · 基础资料</text>
      <text class="inventory-management__title">物品库存</text>
      <text class="inventory-management__description">
        补货和盘点都会保留变动记录；预约占用的库存不能被盘点到更低。
      </text>
      <button v-if="!quickAddMode" class="inventory-management__project-link" @click="$emit('open-projects')">
        进入服务项目 →
      </button>
      <text v-else class="inventory-management__quick-add-note">
        保存后将返回服务项目，并自动选中这项库存物品。
      </text>
    </view>

    <InventoryItemForm
      ref="itemForm"
      :submitting="submitting"
      @submit="handleCreate"
    />
    <view v-if="errorMessage" class="inventory-management__error" role="alert">
      {{ errorMessage }}
    </view>
    <view v-if="loading" class="inventory-management__loading">正在读取本机库存</view>
    <template v-else>
      <InventoryAdjustmentForm
        v-if="selectedItem"
        :item="selectedItem"
        :submitting="submitting"
        @submit="handleAdjustment"
        @cancel="selectedItem = undefined"
      />
      <InventoryItemProfileForm
        v-else-if="selectedProfileItem"
        :item="selectedProfileItem"
        :submitting="submitting"
        @submit="handleProfileUpdate"
        @cancel="selectedProfileItem = undefined"
      />
      <InventoryMovementEditForm
        v-else-if="selectedMovement && selectedMovementItem"
        :movement="selectedMovement"
        :item="selectedMovementItem"
        :submitting="submitting"
        @submit="handleMovementEdit"
        @cancel="selectedMovement = undefined"
      />
      <InventoryItemList
        :summaries="itemSummaries"
        :disabled="submitting"
        @adjust="adjustItem"
        @edit="editItem"
        @toggle-status="changeItemStatus"
        @delete="confirmDeleteItem"
      />
      <InventoryMovementList
        :movements="movementsByRecency"
        :items="items"
        :disabled="submitting"
        @edit="editMovement"
        @delete="confirmDeleteMovement"
      />
    </template>
  </view>
</template>

<style scoped>
.inventory-management {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 36rpx 28rpx calc(50rpx + env(safe-area-inset-bottom));
}

.inventory-management__intro {
  display: flex;
  flex-direction: column;
  padding: 0 6rpx 28rpx;
}

.inventory-management__eyebrow {
  color: #31549e;
  font-size: 22rpx;
  font-weight: 600;
}

.inventory-management__title {
  margin-top: 12rpx;
  color: #1a2538;
  font-size: 42rpx;
  font-weight: 700;
}

.inventory-management__description {
  margin-top: 12rpx;
  color: #707b8f;
  font-size: 23rpx;
  line-height: 1.6;
}

.inventory-management__project-link {
  align-self: flex-start;
  margin-top: 18rpx;
  background: transparent;
  color: #31549e;
  font-size: 23rpx;
  font-weight: 600;
}

.inventory-management__quick-add-note {
  margin-top: 16rpx;
  color: #31549e;
  font-size: 22rpx;
}

.inventory-management__error,
.inventory-management__loading {
  margin-top: 22rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  font-size: 23rpx;
}

.inventory-management__error {
  border: 2rpx solid #e2b5b5;
  background: #fff5f4;
  color: #97423f;
}

.inventory-management__loading {
  background: #eef2f8;
  color: #68748a;
  text-align: center;
}
</style>
