<script setup lang="ts">
import { shallowRef } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { APP_VERSION } from "@/config/app";
import InventoryAdjustmentPage from "@/features/inventory/components/InventoryAdjustmentPage.vue";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import {
  createInventoryManagementService,
  type AdjustInventoryInput,
} from "@/services/inventory-management-service";

const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const repository = createApplicationDataRepository({
  storage,
  rollbackFiles: createDefaultWechatBackupFileAdapter(),
  appVersion: APP_VERSION,
});
const service = createInventoryManagementService({ repository });
const inventoryItemId = shallowRef("");
const initialKind = shallowRef<AdjustInventoryInput["kind"]>("restock");
const adjustmentPage = shallowRef<InstanceType<typeof InventoryAdjustmentPage>>();

/** 根据当前调整语义设置原生导航栏标题。 */
function setNavigationTitle(kind: AdjustInventoryInput["kind"]): void {
  uni.setNavigationBarTitle({
    title: kind === "restock" ? "补货" : "盘点修正",
  });
}

/** 页面 query 只定位物品和初始调整方式，不进入库存变动记录。 */
onLoad((query) => {
  inventoryItemId.value = query?.inventoryItemId?.trim() ?? "";
  initialKind.value = query?.kind === "stocktake" ? "stocktake" : "restock";
  setNavigationTitle(initialKind.value);
});

/** 子表单切换调整方式时同步原生导航栏标题。 */
function handleKindChange(kind: AdjustInventoryInput["kind"]): void {
  setNavigationTitle(kind);
}

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

/** 调整成功后显示对应反馈并返回来源页。 */
function completeAdjustment(kind: AdjustInventoryInput["kind"]): void {
  uni.showToast({
    title: kind === "restock" ? "补货已完成" : "盘点修正已完成",
    icon: "success",
  });
  returnToSource();
}

/** 从其他页面返回时读回当前库存，防止提交过期数量。 */
function refreshAdjustment(): void {
  void adjustmentPage.value?.refresh();
}

onShow(refreshAdjustment);
</script>

<template>
  <view class="inventory-adjustment-route">
    <InventoryAdjustmentPage
      v-if="inventoryItemId"
      ref="adjustmentPage"
      :inventory-item-id="inventoryItemId"
      :initial-kind="initialKind"
      :service="service"
      @back="returnToSource"
      @kind-change="handleKindChange"
      @missing="returnFromMissingItem"
      @saved="completeAdjustment"
    />
    <view v-else class="inventory-adjustment-route__invalid" role="alert">
      <text>缺少物品标识，请返回库存列表后重试。</text>
      <button @click="returnToSource">返回库存列表</button>
    </view>
  </view>
</template>

<style scoped>
.inventory-adjustment-route { min-height: 100vh; background: #fff8fa; }
.inventory-adjustment-route__invalid { display: flex; flex-direction: column; align-items: center; gap: 22rpx; margin: 30rpx; padding: 36rpx 24rpx; border: 2rpx solid #ead6d8; border-radius: 20rpx; background: #fff8f8; color: #934c54; font-size: 23rpx; line-height: 1.55; text-align: center; }
.inventory-adjustment-route__invalid button { min-width: 240rpx; min-height: 76rpx; margin: 0; padding: 16rpx 28rpx; border-radius: 999rpx; background: #6a3cb3; color: #fff; font-size: 25rpx; line-height: 1.35; }
</style>
