<script setup lang="ts">
import { computed, nextTick, onMounted } from "vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import type {
  InventoryManagementService,
  UpdateInventoryItemProfileInput,
} from "@/services/inventory-management-service";
import { useInventoryManagement } from "../composables/useInventoryManagement";
import { useInventoryFormLifecycle } from "../composables/useInventoryFormLifecycle";
import InventoryItemProfileForm from "./InventoryItemProfileForm.vue";

/** 独立物品资料编辑页的业务输入。 */
interface InventoryItemProfileEditPageProps {
  /** 路由参数提供的稳定库存物品标识。 */
  inventoryItemId: string;
  /** 页面可调用的库存管理窄用例。 */
  service: InventoryManagementService;
}

/** 独立物品资料编辑页向路由组合层暴露的结果。 */
interface InventoryItemProfileEditPageEmits {
  /** 缺失物品时请求返回详情或列表。 */
  back: [];
  /** 物品已不存在时请求直接回到库存列表。 */
  missing: [];
  /** 资料保存成功后交由路由返回来源页面。 */
  saved: [];
}

/** 资料编辑路由重新显示时可调用的最小刷新契约。 */
interface InventoryItemProfileEditPageExpose {
  /** 重新读取物品资料和引用状态。 */
  refresh(): Promise<void>;
}

const props = defineProps<InventoryItemProfileEditPageProps>();
const emit = defineEmits<InventoryItemProfileEditPageEmits>();
const {
  items,
  unitLockedItemIds,
  loading,
  submitting,
  errorMessage,
  errorKind,
  refresh,
  updateItemProfile,
} = useInventoryManagement({ service: props.service });
const {
  updateDirty,
  resetDirty,
  updateSaving,
  completionGuard,
} = useInventoryFormLifecycle();
const item = computed(() =>
  items.value.find((candidate) => candidate.id === props.inventoryItemId),
);
const unitLocked = computed(() =>
  unitLockedItemIds.value.has(props.inventoryItemId),
);

/** 保存失败时将页面级错误说明带入当前视口。 */
async function scrollToErrorNotice(): Promise<void> {
  await nextTick();
  uni.pageScrollTo({
    selector: ".inventory-profile-edit-page__notice",
    duration: 180,
  });
}

/** 保存名称、允许修改的单位和备注，成功后交由路由返回详情。 */
async function handleProfileUpdate(
  input: UpdateInventoryItemProfileInput,
): Promise<void> {
  if (submitting.value) {
    return;
  }
  updateSaving(true);
  const saved = await updateItemProfile(input);
  if (!completionGuard.isActive()) {
    return;
  }
  if (saved) {
    resetDirty();
    emit("saved");
    return;
  }
  updateSaving(false);
  await scrollToErrorNotice();
}

onMounted(refresh);

const exposed: InventoryItemProfileEditPageExpose = { refresh };
defineExpose(exposed);
</script>

<template>
  <main class="inventory-profile-edit-page">
    <view
      class="inventory-profile-edit-page__glow inventory-profile-edit-page__glow--rose"
      aria-hidden="true"
    />
    <view
      class="inventory-profile-edit-page__glow inventory-profile-edit-page__glow--lavender"
      aria-hidden="true"
    />

    <RecoverableErrorNotice
      v-if="errorMessage"
      class="inventory-profile-edit-page__notice"
      :message="errorMessage"
      :retryable="errorKind === 'read'"
      :retrying="loading"
      @retry="refresh"
    />
    <view
      v-if="loading && !item"
      class="inventory-profile-edit-page__state"
      role="status"
    >
      正在读取物品资料
    </view>
    <view
      v-else-if="!item && !errorMessage"
      class="inventory-profile-edit-page__state inventory-profile-edit-page__state--error"
      role="alert"
    >
      <text>库存物品不存在，可能已被删除。</text>
      <button @click="emit('missing')">返回库存列表</button>
    </view>
    <InventoryItemProfileForm
      v-else-if="item"
      :item="item"
      :submitting="submitting"
      :unit-locked="unitLocked"
      @dirty-change="updateDirty"
      @submit="handleProfileUpdate"
    />
  </main>
</template>

<style scoped>
.inventory-profile-edit-page { position: relative; min-height: 100vh; box-sizing: border-box; overflow: hidden; padding: 30rpx 30rpx calc(52rpx + env(safe-area-inset-bottom)); background: linear-gradient(180deg, #fff8fa 0%, #fbf4f7 54%, #f8f4f7 100%); }
.inventory-profile-edit-page__glow { position: absolute; z-index: 0; border-radius: 999rpx; pointer-events: none; }
.inventory-profile-edit-page__glow--rose { top: -130rpx; right: -180rpx; width: 500rpx; height: 500rpx; background: radial-gradient(circle, rgba(244, 205, 220, 0.48) 0%, rgba(244, 205, 220, 0) 70%); }
.inventory-profile-edit-page__glow--lavender { top: 20rpx; right: -140rpx; width: 420rpx; height: 330rpx; background: radial-gradient(circle, rgba(219, 198, 237, 0.4) 0%, rgba(219, 198, 237, 0) 72%); }
.inventory-profile-edit-page__notice, .inventory-profile-edit-page__state { position: relative; z-index: 2; }
.inventory-profile-edit-page__notice { margin-bottom: 20rpx; }
.inventory-profile-edit-page__state { padding: 30rpx 24rpx; border: 2rpx solid rgba(137, 106, 128, 0.08); border-radius: 20rpx; background: rgba(255, 255, 255, 0.92); color: #766e74; font-size: 23rpx; line-height: 1.55; text-align: center; }
.inventory-profile-edit-page__state--error { display: flex; flex-direction: column; align-items: center; gap: 22rpx; border-color: #ead6d8; background: rgba(255, 248, 248, 0.94); color: #934c54; }
.inventory-profile-edit-page__state button { min-width: 240rpx; min-height: 76rpx; margin: 0; padding: 16rpx 28rpx; border-radius: 999rpx; background: #6a3cb3; color: #fff; font-size: 24rpx; line-height: 1.3; }

@media (max-width: 360px) {
  .inventory-profile-edit-page { padding-right: 24rpx; padding-left: 24rpx; }
}
</style>
