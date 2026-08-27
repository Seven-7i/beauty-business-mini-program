<script setup lang="ts">
import { onMounted, shallowRef } from "vue";
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
import { createPendingExportConfirmationService } from "@/services/pending-export-confirmation-service";

const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const files = createDefaultWechatBackupFileAdapter();
const repository = createApplicationDataRepository({
  storage,
  rollbackFiles: files,
  appVersion: APP_VERSION,
});
const exportConfirmations = createPendingExportConfirmationService({
  storage,
  repository,
});
const service = createBackupRestoreService({
  repository,
  files,
  appVersion: APP_VERSION,
  exportConfirmations,
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
const startupReady = shallowRef(false);
const startupError = shallowRef("");

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

function requestExportConfirmation(scope: "system" | "beauty"): void {
  const isSystem = scope === "system";
  uni.showModal({
    title: isSystem ? "生成完整系统备份？" : "生成美容模块备份？",
    content: isSystem
      ? "将生成包含设置、模块授权和全部业务数据的未加密文件。文件可能包含顾客资料，请妥善保管。"
      : "将生成只包含美容模块业务数据的未加密文件，不包含个人设置和模块授权。请妥善保管。",
    confirmText: "生成备份",
    cancelText: "暂不生成",
    confirmColor: "#9A565D",
    success(result) {
      if (result.confirm) {
        selectExportScope(scope);
        void prepareExport();
      }
    },
    fail() {
      uni.showToast({ title: "确认框打开失败", icon: "none" });
    },
  });
}

function requestShareResultConfirmation(): void {
  uni.showModal({
    title: "备份文件是否已发送？",
    content: "只有明确选择“已发送”，系统才会更新最近导出时间。若现在不处理，下次进入程序时会再次提醒。",
    confirmText: "已发送",
    cancelText: "未发送",
    confirmColor: "#9A565D",
    success(result) {
      if (result.confirm) {
        void confirmExportSent();
      } else {
        void confirmExportCancelled();
      }
    },
    fail() {
      // 页面中的确认卡仍保留；待确认状态也会在下次启动时再次弹出。
      uni.showToast({ title: "确认框打开失败，下次启动会再次提醒", icon: "none" });
    },
  });
}

async function shareAndConfirmExport(): Promise<void> {
  await sharePreparedExport();
  if (exportState.status === "awaiting-confirmation") {
    requestShareResultConfirmation();
  }
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
      @request-export-scope="requestExportConfirmation"
      @share-export="shareAndConfirmExport"
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
  background: #f3f1ec;
}

.backup-page__startup {
  display: flex;
  min-height: 80vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  padding: 40rpx;
  background: #f3f1ec;
  color: #6f716c;
  font-size: 26rpx;
  text-align: center;
}

.backup-page__startup button {
  padding: 20rpx 34rpx;
  border-radius: 20rpx;
  background: #3d4a5d;
  color: #f8f6f1;
  font-size: 25rpx;
}
</style>
