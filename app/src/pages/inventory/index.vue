<script setup lang="ts">
import { shallowRef } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { APP_VERSION } from "@/config/app";
import {
  cancelQuickAddInventoryRequest,
  prepareLegacyInventoryQuickAddRedirect,
} from "@/features/beauty-project/quick-add-inventory-handoff";
import InventoryManagement from "@/features/inventory/components/InventoryManagement.vue";
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
const inventoryManagement =
  shallowRef<InstanceType<typeof InventoryManagement> | null>(null);

/** 兼容旧快速新增链接，将其替换为新的独立新增页。 */
onLoad((query) => {
  if (query?.mode === "project-quick-add") {
    const redirect = prepareLegacyInventoryQuickAddRedirect(
      getCurrentPages().length,
    );
    uni.redirectTo({
      url: redirect.url,
      fail: () => {
        if (redirect.requestId) {
          cancelQuickAddInventoryRequest(redirect.requestId);
        }
      },
    });
  }
});

/** 从物品详情返回列表时读回最新库存，同时保留列表组件内的搜索和范围状态。 */
function refreshInventoryList(): void {
  void inventoryManagement.value?.refresh();
}

onShow(refreshInventoryList);
</script>

<template>
  <view class="inventory-page">
    <InventoryManagement
      ref="inventoryManagement"
      :service="service"
    />
  </view>
</template>

<style scoped>
.inventory-page {
  min-height: 100vh;
  background: #fff8fa;
}
</style>
