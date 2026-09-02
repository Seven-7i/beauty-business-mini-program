<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { shallowRef } from "vue";
import { APP_VERSION } from "@/config/app";
import CustomerEditor from "@/features/customer/components/CustomerEditor.vue";
import { readCustomerEditorId } from "@/features/customer/customer-create-navigation";
import { returnToCustomerList } from "@/features/customer/customer-detail-navigation";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { createCustomerManagementService } from "@/services/customer-management-service";

// 独立路由只解析新增/编辑模式并组合微信基础设施，表单状态留在聚焦组件中。
const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const repository = createApplicationDataRepository({
  storage,
  rollbackFiles: createDefaultWechatBackupFileAdapter(),
  appVersion: APP_VERSION,
});
const service = createCustomerManagementService({ repository });
const customerId = shallowRef("");
const routeReady = shallowRef(false);

/** 页面参数只决定表单模式；稳定顾客标识不会进入可编辑草稿。 */
onLoad((query) => {
  customerId.value = readCustomerEditorId(query);
  uni.setNavigationBarTitle({
    title: customerId.value ? "编辑顾客" : "新增顾客",
  });
  routeReady.value = true;
});
</script>

<template>
  <view class="customer-editor-page">
    <CustomerEditor
      v-if="routeReady"
      :service="service"
      :customer-id="customerId"
      @missing="returnToCustomerList(1)"
    />
  </view>
</template>

<style scoped>
.customer-editor-page {
  min-height: 100vh;
  background: #fbf5f7;
}
</style>
