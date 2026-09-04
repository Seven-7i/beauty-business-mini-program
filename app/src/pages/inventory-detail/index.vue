<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { shallowRef } from "vue";
import { APP_VERSION } from "@/config/app";
import InventoryItemDetailPage from "@/features/inventory/components/InventoryItemDetailPage.vue";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { createInventoryManagementService } from "@/services/inventory-management-service";

// 独立路由只解析物品标识并注入微信基础设施，详情状态留在聚焦组件中。
const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const repository = createApplicationDataRepository({
  storage,
  rollbackFiles: createDefaultWechatBackupFileAdapter(),
  appVersion: APP_VERSION,
});
const service = createInventoryManagementService({ repository });
const inventoryItemId = shallowRef("");
const detailPage =
  shallowRef<InstanceType<typeof InventoryItemDetailPage>>();

/** 页面 query 只用于定位库存物品，不进入任何业务记录。 */
onLoad((query) => {
  inventoryItemId.value = query?.inventoryItemId?.trim() ?? "";
});

/** 从来源预约返回详情时读回可能被更正的库存和动态。 */
function refreshDetail(): void {
  void detailPage.value?.refresh();
}

/** 返回库存列表；深链进入且没有上一页时重建到稳定列表路由。 */
function returnToInventoryList(): void {
  if (getCurrentPages().length > 1) {
    uni.navigateBack();
    return;
  }
  uni.reLaunch({ url: "/pages/inventory/index" });
}

/** 删除成功后给出结果反馈并返回库存列表。 */
function completeDeletion(): void {
  uni.showToast({ title: "物品已删除", icon: "none" });
  returnToInventoryList();
}

onShow(refreshDetail);
</script>

<template>
  <view class="inventory-detail-route">
    <InventoryItemDetailPage
      v-if="inventoryItemId"
      ref="detailPage"
      :inventory-item-id="inventoryItemId"
      :service="service"
      @back="returnToInventoryList"
      @deleted="completeDeletion"
    />
    <view v-else class="inventory-detail-route__invalid" role="alert">
      <text>缺少物品标识，请返回库存列表后重试。</text>
      <button @click="returnToInventoryList">返回库存列表</button>
    </view>
  </view>
</template>

<style scoped>
.inventory-detail-route { min-height: 100vh; background: #fff8fa; }
.inventory-detail-route__invalid { display: flex; flex-direction: column; align-items: center; gap: 22rpx; margin: 30rpx; padding: 36rpx 24rpx; border: 2rpx solid #ead6d8; border-radius: 20rpx; background: #fff8f8; color: #934c54; font-size: 23rpx; line-height: 1.55; text-align: center; }
.inventory-detail-route__invalid button { min-width: 240rpx; min-height: 76rpx; margin: 0; padding: 16rpx 28rpx; border-radius: 999rpx; background: #6a3cb3; color: #fff; font-size: 25rpx; line-height: 1.35; }
</style>
