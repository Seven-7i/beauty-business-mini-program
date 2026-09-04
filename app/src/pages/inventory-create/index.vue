<script setup lang="ts">
import { shallowRef } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { APP_VERSION } from "@/config/app";
import {
  completeInventoryCreateNavigation,
  resolveInventoryCreateQuickAddMode,
} from "@/features/beauty-project/quick-add-inventory-handoff";
import InventoryItemCreatePage from "@/features/inventory/components/InventoryItemCreatePage.vue";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { createInventoryManagementService } from "@/services/inventory-management-service";

const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const repository = createApplicationDataRepository({
  storage,
  rollbackFiles: createDefaultWechatBackupFileAdapter(),
  appVersion: APP_VERSION,
});
const service = createInventoryManagementService({ repository });
const quickAddMode = shallowRef(false);

/** 页面参数只决定保存后的回传方式，不进入库存业务数据。 */
onLoad((query) => {
  quickAddMode.value = resolveInventoryCreateQuickAddMode(
    query,
    getCurrentPages().length,
  );
});

/** 保存成功后反馈结果；快速新增同时把新物品交还项目草稿。 */
function completeCreate(inventoryItemId: string): void {
  completeInventoryCreateNavigation(inventoryItemId, quickAddMode.value, {
    getPageCount: () => getCurrentPages().length,
    showSavedToast: () =>
      uni.showToast({ title: "库存物品已保存", icon: "success" }),
    navigateBack: () => uni.navigateBack(),
    relaunchInventory: () =>
      uni.reLaunch({ url: "/pages/inventory/index" }),
  });
}
</script>

<template>
  <view class="inventory-create-route">
    <InventoryItemCreatePage :service="service" @saved="completeCreate" />
  </view>
</template>

<style scoped>
.inventory-create-route { min-height: 100vh; background: #fff8fa; }
</style>
