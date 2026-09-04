<script setup lang="ts">
import { shallowRef } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { APP_VERSION } from "@/config/app";
import BeautyProjectManagement from "@/features/beauty-project/components/BeautyProjectManagement.vue";
import {
  acknowledgeQuickAddedInventoryItem,
  beginQuickAddInventoryRequest,
  cancelQuickAddInventoryRequest,
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
const management =
  shallowRef<InstanceType<typeof BeautyProjectManagement> | null>(null);

/** 打开独立库存新增页；保留当前项目表单实例与草稿。 */
function openInventory(): void {
  const requestId = beginQuickAddInventoryRequest();
  uni.navigateTo({
    url: `/pages/inventory-create/index?mode=project-quick-add&requestId=${encodeURIComponent(requestId)}`,
    fail: () => cancelQuickAddInventoryRequest(requestId),
  });
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
