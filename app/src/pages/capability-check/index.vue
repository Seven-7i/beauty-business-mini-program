<script setup lang="ts">
import { onMounted } from "vue";
import CapabilityCheckPanel from "@/features/capability-check/components/CapabilityCheckPanel.vue";
import { useCapabilityCheck } from "@/features/capability-check/composables/useCapabilityCheck";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";

const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const files = createDefaultWechatBackupFileAdapter();
const {
  checks,
  runningAutomatedChecks,
  runningManualCheck,
  runAutomatedChecks,
  checkCapacityRollback,
  checkShare,
  confirmShareSent,
  confirmShareCancelled,
  checkChoose,
} = useCapabilityCheck({ storage, files });

onMounted(runAutomatedChecks);
</script>

<template>
  <view class="capability-page">
    <CapabilityCheckPanel
      :checks="checks"
      :running-automated-checks="runningAutomatedChecks"
      :running-manual-check="runningManualCheck"
      @run-automated="runAutomatedChecks"
      @check-capacity-rollback="checkCapacityRollback"
      @check-share="checkShare"
      @confirm-share-sent="confirmShareSent"
      @confirm-share-cancelled="confirmShareCancelled"
      @check-choose="checkChoose"
    />
  </view>
</template>

<style scoped>
.capability-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 94% 2%, rgba(65, 102, 183, 0.08), transparent 30%),
    #f8f9fb;
}
</style>
