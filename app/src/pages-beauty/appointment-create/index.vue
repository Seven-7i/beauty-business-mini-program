<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { ref, shallowRef } from "vue";
import { APP_VERSION } from "@/config/app";
import AppointmentCreatePage from "@/pages-beauty/features/appointment/components/AppointmentCreatePage.vue";
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
const page = ref<InstanceType<typeof AppointmentCreatePage> | null>(null);

/** 编辑入口通过预约标识复用新增页的正常预约表单。 */
onLoad((query) => {
  appointmentId.value = query?.appointmentId?.trim() ?? "";
  uni.setNavigationBarTitle({
    title: appointmentId.value ? "编辑预约" : "新增预约",
  });
});
onShow(() => {
  void page.value?.refresh();
});
</script>

<template>
  <AppointmentCreatePage
    ref="page"
    :service="service"
    :appointment-id="appointmentId"
  />
</template>
