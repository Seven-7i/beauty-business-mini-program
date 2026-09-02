<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { shallowRef } from "vue";
import { APP_VERSION } from "@/config/app";
import CustomerDetailPage from "@/features/customer/components/CustomerDetailPage.vue";
import {
  completeCustomerDetailDeletion,
  readCustomerDetailId,
  returnToCustomerList,
} from "@/features/customer/customer-detail-navigation";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { createCustomerManagementService } from "@/services/customer-management-service";

// 独立路由只解析顾客标识并注入微信基础设施，详情状态留在聚焦组件中。
const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const repository = createApplicationDataRepository({
  storage,
  rollbackFiles: createDefaultWechatBackupFileAdapter(),
  appVersion: APP_VERSION,
});
const service = createCustomerManagementService({ repository });
const customerId = shallowRef("");
const customerDetailPage = shallowRef<InstanceType<typeof CustomerDetailPage>>();

/** 页面 query 只用于定位顾客，不进入任何业务记录。 */
onLoad((query) => {
  customerId.value = readCustomerDetailId(query);
});

/** 页面重新显示时刷新详情，避免展示外部操作后的旧状态。 */
function refreshCustomerDetail(): void {
  void customerDetailPage.value?.refresh();
}

onShow(refreshCustomerDetail);
</script>

<template>
  <view class="customer-detail-route">
    <CustomerDetailPage
      v-if="customerId"
      ref="customerDetailPage"
      :customer-id="customerId"
      :service="service"
      @back="returnToCustomerList()"
      @deleted="completeCustomerDetailDeletion"
    />
    <view v-else class="customer-detail-route__invalid" role="alert">
      <text>缺少顾客标识，请返回顾客列表后重试。</text>
      <button class="customer-detail-route__back" @click="returnToCustomerList()">
        返回顾客列表
      </button>
    </view>
  </view>
</template>

<style scoped>
.customer-detail-route { min-height: 100vh; background: #fbf5f7; }
.customer-detail-route__invalid { display: flex; flex-direction: column; align-items: center; gap: 22rpx; margin: 30rpx; padding: 36rpx 24rpx; border: 2rpx solid #ead6d8; border-radius: 20rpx; background: #fff8f8; color: #934c54; font-size: 23rpx; line-height: 1.55; text-align: center; }
.customer-detail-route__back { min-width: 240rpx; min-height: 76rpx; margin: 0; padding: 16rpx 28rpx; border-radius: 999rpx; background: #6a3cb3; color: #fff; font-size: 25rpx; font-weight: 650; line-height: 1.35; }
</style>
