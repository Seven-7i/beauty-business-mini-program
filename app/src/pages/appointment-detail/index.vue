<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { ref, shallowRef } from "vue";
import { APP_VERSION } from "@/config/app";
import AppointmentDetailPage from "@/features/appointment/components/AppointmentDetailPage.vue";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { createAppointmentManagementService } from "@/services/appointment-management-service";

const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const repository = createApplicationDataRepository({
  storage,
  rollbackFiles: createDefaultWechatBackupFileAdapter(),
  appVersion: APP_VERSION,
});
const service = createAppointmentManagementService({ repository });
const appointmentId = shallowRef("");
const page = ref<InstanceType<typeof AppointmentDetailPage> | null>(null);

/** 详情页必须带预约标识；缺失时由页面展示不可用状态。 */
onLoad((query) => {
  appointmentId.value = query?.appointmentId?.trim() ?? "";
});
onShow(() => {
  void page.value?.refresh();
});
</script>

<template>
  <AppointmentDetailPage
    ref="page"
    :service="service"
    :appointment-id="appointmentId"
  />
</template>
