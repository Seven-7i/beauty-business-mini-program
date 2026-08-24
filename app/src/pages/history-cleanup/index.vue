<script setup lang="ts">
import { APP_VERSION } from "@/config/app";
import HistoryCleanup from "@/features/history-cleanup/components/HistoryCleanup.vue";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { createAppointmentManagementService } from "@/services/appointment-management-service";
import { createHistoryCleanupService } from "@/services/history-cleanup-service";

const repository = createApplicationDataRepository({
  storage: createUniStorageAdapter(uni as unknown as UniStorageRuntime),
  rollbackFiles: createDefaultWechatBackupFileAdapter(),
  appVersion: APP_VERSION,
});
const appointmentService = createAppointmentManagementService({ repository });
const service = createHistoryCleanupService({ appointments: appointmentService });
</script>

<template>
  <HistoryCleanup :service="service" />
</template>
