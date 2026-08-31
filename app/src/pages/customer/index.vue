<script setup lang="ts">
import { APP_VERSION } from "@/config/app";
import CustomerManagement from "@/features/customer/components/CustomerManagement.vue";
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
</script>

<template>
  <view class="customer-page">
    <CustomerManagement :service="service" />
  </view>
</template>

<style scoped>
.customer-page {
  min-height: 100vh;
  background: #fbf5f7;
}
</style>
