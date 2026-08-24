<script setup lang="ts">
import { onMounted, ref } from "vue";
import { APP_VERSION } from "@/config/app";
import BackupRestorePanel from "@/features/backup-restore/components/BackupRestorePanel.vue";
import { useBackupRestoreFlow } from "@/features/backup-restore/composables/useBackupRestoreFlow";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { createBackupRestoreService } from "@/services/backup-restore-service";
import { ensureApplicationDataRecovered } from "@/services/application-startup";

const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const files = createDefaultWechatBackupFileAdapter();
const repository = createApplicationDataRepository({
  storage,
  rollbackFiles: files,
  appVersion: APP_VERSION,
});
const service = createBackupRestoreService({
  repository,
  files,
  appVersion: APP_VERSION,
});
const {
  exportState,
  restoreState,
  lastExportedAt,
  lastExportFileName,
  busy,
  exportScope,
  setExportScope,
  initialize,
  prepareExport,
  sharePreparedExport,
  confirmExportSent,
  confirmExportCancelled,
  prepareCurrentDataBeforeRestore,
  selectRestoreFile,
  confirmRestore,
} = useBackupRestoreFlow({ service });
const startupReady = ref(false);
const startupError = ref("");

async function prepareCurrentExport(): Promise<void> {
  await prepareCurrentDataBeforeRestore();
  if (exportState.status === "ready") {
    // 导出区位于恢复区上方，生成后把用户带到下一步“转发到微信”。
    uni.pageScrollTo({ selector: ".data-section", duration: 300 });
  }
}

function requestRestoreConfirmation(): void {
  const candidate = restoreState.candidate;
  const isSystem = candidate?.scopeKind === "system";
  uni.showModal({
    title: isSystem ? "完整恢复系统数据？" : `恢复${candidate?.scopeLabel ?? "模块"}数据？`,
    content: isSystem
      ? "恢复不会合并数据，将覆盖全部业务数据、模块授权和个人设置。确认后立即开始恢复。"
      : "恢复不会合并模块数据，只替换文件声明的模块；其他模块、个人设置和授权状态保持不变。",
    confirmText: "确认恢复",
    confirmColor: "#A94442",
    cancelText: "再检查",
    success(result) {
      if (result.confirm) {
        void confirmRestore();
      }
    },
    fail() {
      uni.showToast({ title: "确认框打开失败", icon: "none" });
    },
  });
}

function selectExportScope(scope: "system" | "beauty"): void {
  setExportScope(
    scope === "system"
      ? { kind: "system" }
      : { kind: "modules", moduleIds: ["beauty"] },
  );
}

function returnHome(): void {
  // reLaunch 强制重建启动流程，使刚恢复的模块授权和设置立即生效。
  uni.reLaunch({ url: "/pages/index/index" });
}

async function initializePage(): Promise<void> {
  try {
    await ensureApplicationDataRecovered(repository);
    await initialize();
    startupReady.value = true;
  } catch {
    startupError.value = "无法安全处理上次数据写入状态，请返回首页重试。";
  }
}

onMounted(initializePage);
</script>

<template>
  <view class="backup-page">
    <BackupRestorePanel
      v-if="startupReady"
      :export-state="exportState"
      :restore-state="restoreState"
      :last-exported-at="lastExportedAt"
      :last-export-file-name="lastExportFileName"
      :busy="busy"
      context="system"
      :export-scope="exportScope.kind === 'system' ? 'system' : 'beauty'"
      :allow-scope-selection="true"
      @prepare-export="prepareExport"
      @share-export="sharePreparedExport"
      @confirm-export-sent="confirmExportSent"
      @confirm-export-cancelled="confirmExportCancelled"
      @select-restore="selectRestoreFile"
      @prepare-current-export="prepareCurrentExport"
      @proceed="requestRestoreConfirmation"
      @return-home="returnHome"
      @select-export-scope="selectExportScope"
    />
    <view v-else class="backup-page__startup">
      <text>{{ startupError || "正在检查本机数据保护状态" }}</text>
      <button v-if="startupError" @click="returnHome">返回首页重试</button>
    </view>
  </view>
</template>

<style scoped>
.backup-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 94% 2%, rgba(65, 102, 183, 0.08), transparent 30%),
    #f8f9fb;
}

.backup-page__startup {
  display: flex;
  min-height: 80vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  padding: 40rpx;
  color: #697284;
  font-size: 26rpx;
  text-align: center;
}

.backup-page__startup button {
  padding: 20rpx 34rpx;
  border-radius: 14rpx;
  background: #3159b5;
  color: #ffffff;
  font-size: 25rpx;
}
</style>
