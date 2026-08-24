<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { APP_VERSION } from "@/config/app";
import InventoryManagement from "@/features/inventory/components/InventoryManagement.vue";
import { publishQuickAddedInventoryItem } from "@/features/beauty-project/quick-add-inventory-handoff";
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
const quickAddMode = ref(false);

/** 页面 query 只决定交互返回方式，不参与任何业务数据持久化。 */
onLoad((query) => {
  quickAddMode.value = query?.mode === "project-quick-add";
});

function openProjects(): void {
  uni.navigateTo({ url: "/pages/beauty-project/index" });
}

function completeQuickAdd(inventoryItemId: string): void {
  publishQuickAddedInventoryItem(inventoryItemId);
  uni.navigateBack();
}
</script>

<template>
  <view class="inventory-page">
    <InventoryManagement
      :service="service"
      :quick-add-mode="quickAddMode"
      @open-projects="openProjects"
      @quick-add-complete="completeQuickAdd"
    />
  </view>
</template>

<style scoped>
.inventory-page {
  min-height: 100vh;
  background: #f8f9fb;
}
</style>
