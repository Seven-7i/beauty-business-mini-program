<script setup lang="ts">
import { shallowRef } from "vue";
import { onShow, onUnload } from "@dcloudio/uni-app";
import { APP_VERSION } from "@/config/app";
import BeautyProjectManagement from "@/features/beauty-project/components/BeautyProjectManagement.vue";
import { subscribeBeautyProjectChanged } from "@/features/beauty-project/beauty-project-navigation";
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

/** 页面从新增或详情返回时读回最新项目资料。 */
function refreshProjectManagement(): void {
  void management.value?.refresh();
}

const stopProjectChangedSubscription = subscribeBeautyProjectChanged(
  refreshProjectManagement,
);
onShow(refreshProjectManagement);
onUnload(stopProjectChangedSubscription);
</script>

<template>
  <view class="project-list-route">
    <BeautyProjectManagement ref="management" :service="service" />
  </view>
</template>

<style scoped>
.project-list-route { min-height: 100vh; background: #fff8fa; }
</style>
