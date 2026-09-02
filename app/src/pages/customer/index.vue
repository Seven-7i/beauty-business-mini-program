<script setup lang="ts">
import { onShow, onUnload } from "@dcloudio/uni-app";
import { ref } from "vue";
import { APP_VERSION } from "@/config/app";
import CustomerManagement from "@/features/customer/components/CustomerManagement.vue";
import {
  refreshCustomerListOnShow,
  subscribeCustomerSaved,
} from "@/features/customer/customer-create-navigation";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { createCustomerManagementService } from "@/services/customer-management-service";

// 页面是组合根：微信依赖在此注入，顾客组件和用例不直接访问全局 API。
const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const repository = createApplicationDataRepository({
  storage,
  rollbackFiles: createDefaultWechatBackupFileAdapter(),
  appVersion: APP_VERSION,
});
const service = createCustomerManagementService({ repository });
const customerManagement = ref<InstanceType<typeof CustomerManagement> | null>(
  null,
);

/** 独立新增页返回后重新读取列表，让新顾客立即出现在当前页面。 */
function refreshCustomerManagement(): void {
  void refreshCustomerListOnShow(customerManagement.value ?? undefined);
}

const stopCustomerSavedSubscription = subscribeCustomerSaved(
  refreshCustomerManagement,
);
onShow(refreshCustomerManagement);
onUnload(stopCustomerSavedSubscription);
</script>

<template>
  <view class="customer-page">
    <CustomerManagement ref="customerManagement" :service="service" />
  </view>
</template>

<style scoped>
.customer-page {
  min-height: 100vh;
  background: #fbf5f7;
}
</style>
