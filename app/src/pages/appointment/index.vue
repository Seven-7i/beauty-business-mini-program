<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";
import { shallowRef } from "vue";
import { APP_VERSION } from "@/config/app";
import AppointmentManagement from "@/features/appointment/components/AppointmentManagement.vue";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { createAppointmentManagementService } from "@/services/appointment-management-service";

// 页面作为组合根注入微信能力，预约组件只依赖管理用例。
const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const repository = createApplicationDataRepository({
  storage,
  rollbackFiles: createDefaultWechatBackupFileAdapter(),
  appVersion: APP_VERSION,
});
const service = createAppointmentManagementService({ repository });
const initialAppointmentId = shallowRef("");

/** 来源库存动态可以请求直接打开对应预约的完成信息。 */
onLoad((query) => {
  initialAppointmentId.value = query?.appointmentId?.trim() ?? "";
});
</script>

<template>
  <view class="appointment-page">
    <AppointmentManagement
      :service="service"
      :initial-appointment-id="initialAppointmentId"
    />
  </view>
</template>

<style scoped>
.appointment-page { min-height: 100vh; background: #f8f9fb; }
</style>
