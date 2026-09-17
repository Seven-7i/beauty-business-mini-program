<script setup lang="ts">
import { nextTick } from "vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import type {
  CreateInventoryItemInput,
  InventoryManagementService,
} from "@/services/inventory-management-service";
import { useInventoryFormLifecycle } from "../composables/useInventoryFormLifecycle";
import { useInventoryManagement } from "../composables/useInventoryManagement";
import InventoryItemForm from "./InventoryItemForm.vue";

/** 独立新增库存物品页的业务输入。 */
interface InventoryItemCreatePageProps {
  /** 页面可调用的库存管理窄用例。 */
  service: InventoryManagementService;
}

/** 独立新增库存物品页向路由组合层暴露的结果。 */
interface InventoryItemCreatePageEmits {
  /** 新物品保存成功，由路由决定普通返回或快速新增回传。 */
  saved: [inventoryItemId: string];
}

const props = defineProps<InventoryItemCreatePageProps>();
const emit = defineEmits<InventoryItemCreatePageEmits>();
const {
  submitting,
  errorMessage,
  createItem,
} = useInventoryManagement({ service: props.service });
const {
  updateDirty,
  resetDirty,
  updateSaving,
  completionGuard,
} = useInventoryFormLifecycle();

/** 保存失败时将页面级错误说明带入当前视口。 */
async function scrollToErrorNotice(): Promise<void> {
  await nextTick();
  uni.pageScrollTo({
    selector: ".inventory-create-page__notice",
    duration: 180,
  });
}

/** 创建物品及首次入库记录，成功后把稳定标识交给路由。 */
async function handleCreate(input: CreateInventoryItemInput): Promise<void> {
  if (submitting.value) {
    return;
  }
  updateSaving(true);
  const created = await createItem(input);
  if (!completionGuard.isActive()) {
    return;
  }
  if (created) {
    resetDirty();
    emit("saved", created.id);
    return;
  }
  updateSaving(false);
  await scrollToErrorNotice();
}
</script>

<template>
  <main class="inventory-create-page">
    <view
      class="inventory-create-page__glow inventory-create-page__glow--rose"
      aria-hidden="true"
    />
    <view
      class="inventory-create-page__glow inventory-create-page__glow--lavender"
      aria-hidden="true"
    />

    <RecoverableErrorNotice
      v-if="errorMessage"
      class="inventory-create-page__notice"
      :message="errorMessage"
      :retryable="false"
      :retrying="false"
    />
    <InventoryItemForm
      :submitting="submitting"
      @dirty-change="updateDirty"
      @submit="handleCreate"
    />
  </main>
</template>

<style scoped>
.inventory-create-page { position: relative; min-height: 100vh; box-sizing: border-box; overflow: hidden; padding: 30rpx 30rpx calc(52rpx + env(safe-area-inset-bottom)); background: linear-gradient(180deg, #fff8fa 0%, #fbf4f7 54%, #f8f4f7 100%); }
.inventory-create-page__glow { position: absolute; z-index: 0; border-radius: 999rpx; pointer-events: none; }
.inventory-create-page__glow--rose { top: -130rpx; right: -180rpx; width: 500rpx; height: 500rpx; background: radial-gradient(circle, rgba(244, 205, 220, 0.48) 0%, rgba(244, 205, 220, 0) 70%); }
.inventory-create-page__glow--lavender { top: 20rpx; right: -140rpx; width: 420rpx; height: 330rpx; background: radial-gradient(circle, rgba(219, 198, 237, 0.4) 0%, rgba(219, 198, 237, 0) 72%); }
.inventory-create-page__notice { position: relative; z-index: 2; margin-bottom: 20rpx; }

@media (max-width: 360px) {
  .inventory-create-page { padding-right: 24rpx; padding-left: 24rpx; }
}
</style>
