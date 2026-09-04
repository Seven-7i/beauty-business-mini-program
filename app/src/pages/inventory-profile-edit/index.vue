<script setup lang="ts">
import { shallowRef } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { APP_VERSION } from "@/config/app";
import InventoryItemProfileEditPage from "@/features/inventory/components/InventoryItemProfileEditPage.vue";
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
const inventoryItemId = shallowRef("");
const profileEditPage =
  shallowRef<InstanceType<typeof InventoryItemProfileEditPage>>();

/** 页面 query 只定位待编辑物品，不参与资料持久化。 */
onLoad((query) => {
  inventoryItemId.value = query?.inventoryItemId?.trim() ?? "";
});

/** 返回来源页；深链进入且没有上一页时回到当前物品详情。 */
function returnToSource(): void {
  if (getCurrentPages().length > 1) {
    uni.navigateBack();
    return;
  }
  if (inventoryItemId.value) {
    uni.reLaunch({
      url: `/pages/inventory-detail/index?inventoryItemId=${encodeURIComponent(
        inventoryItemId.value,
      )}`,
    });
    return;
  }
  uni.reLaunch({ url: "/pages/inventory/index" });
}

/** 物品已不存在时返回来源栈；深链根页面直接重建到库存列表。 */
function returnFromMissingItem(): void {
  if (getCurrentPages().length > 1) {
    uni.navigateBack();
    return;
  }
  uni.reLaunch({ url: "/pages/inventory/index" });
}

/** 资料保存成功后显示反馈并返回物品详情。 */
function completeProfileUpdate(): void {
  uni.showToast({ title: "物品资料已更新", icon: "success" });
  returnToSource();
}

/** 从其他页面返回时重新读取物品资料与引用状态。 */
function refreshProfile(): void {
  void profileEditPage.value?.refresh();
}

onShow(refreshProfile);
</script>

<template>
  <view class="inventory-profile-edit-route">
    <InventoryItemProfileEditPage
      v-if="inventoryItemId"
      ref="profileEditPage"
      :inventory-item-id="inventoryItemId"
      :service="service"
      @back="returnToSource"
      @missing="returnFromMissingItem"
      @saved="completeProfileUpdate"
    />
    <view v-else class="inventory-profile-edit-route__invalid" role="alert">
      <text>缺少物品标识，请返回库存列表后重试。</text>
      <button @click="returnToSource">返回库存列表</button>
    </view>
  </view>
</template>

<style scoped>
.inventory-profile-edit-route { min-height: 100vh; background: #fff8fa; }
.inventory-profile-edit-route__invalid { display: flex; flex-direction: column; align-items: center; gap: 22rpx; margin: 30rpx; padding: 36rpx 24rpx; border: 2rpx solid #ead6d8; border-radius: 20rpx; background: #fff8f8; color: #934c54; font-size: 23rpx; line-height: 1.55; text-align: center; }
.inventory-profile-edit-route__invalid button { min-width: 240rpx; min-height: 76rpx; margin: 0; padding: 16rpx 28rpx; border-radius: 999rpx; background: #6a3cb3; color: #fff; font-size: 25rpx; line-height: 1.35; }
</style>
