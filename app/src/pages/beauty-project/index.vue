<script setup lang="ts">
import { ref } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { APP_VERSION } from "@/config/app";
import BeautyProjectManagement from "@/features/beauty-project/components/BeautyProjectManagement.vue";
import {
  acknowledgeQuickAddedInventoryItem,
  peekQuickAddedInventoryItem,
} from "@/features/beauty-project/quick-add-inventory-handoff";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { createBeautyProjectManagementService } from "@/services/beauty-project-management-service";

const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const repository = createApplicationDataRepository({
  storage,
  rollbackFiles: createDefaultWechatBackupFileAdapter(),
  appVersion: APP_VERSION,
});
const service = createBeautyProjectManagementService({ repository });
const management = ref<InstanceType<typeof BeautyProjectManagement> | null>(null);

function openInventory(): void {
  // navigateTo 保留当前项目表单实例，新增物品后返回不会丢失项目草稿。
  uni.navigateTo({ url: "/pages/inventory/index?mode=project-quick-add" });
}

onShow(() => {
  const createdInventoryItemId = peekQuickAddedInventoryItem();
  if (createdInventoryItemId) {
    void management.value
      ?.refreshAndSelectInventoryItem(createdInventoryItemId)
      .then((selected) => {
        if (selected) {
          acknowledgeQuickAddedInventoryItem(createdInventoryItemId);
        }
      });
    return;
  }
  void management.value?.refresh();
});
</script>

<template>
  <view class="project-page">
    <BeautyProjectManagement
      ref="management"
      :service="service"
      @open-inventory="openInventory"
    />
  </view>
</template>

<style scoped>
.project-page {
  min-height: 100vh;
  background: #f8f9fb;
}
</style>
