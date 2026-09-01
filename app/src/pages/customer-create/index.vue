<script setup lang="ts">
import { APP_VERSION } from "@/config/app";
import CustomerCreate from "@/features/customer/components/CustomerCreate.vue";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { createCustomerManagementService } from "@/services/customer-management-service";

// 独立路由只组合微信基础设施和新增用例，表单状态留在聚焦组件中。
const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const repository = createApplicationDataRepository({
  storage,
  rollbackFiles: createDefaultWechatBackupFileAdapter(),
  appVersion: APP_VERSION,
});
const service = createCustomerManagementService({ repository });
</script>

<template>
  <view class="customer-create-page">
    <CustomerCreate :service="service" />
  </view>
</template>

<style scoped>
.customer-create-page {
  min-height: 100vh;
  background: #fbf5f7;
}
</style>
