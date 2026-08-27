<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { APP_VERSION } from "@/config/app";
import DataProtectionErrorState from "@/features/launch/components/DataProtectionErrorState.vue";
import ModuleActivationForm from "@/features/module-activation/components/ModuleActivationForm.vue";
import ModuleUnlockSuccess from "@/features/module-activation/components/ModuleUnlockSuccess.vue";
import BeautyWorkbench from "@/features/workbench/components/BeautyWorkbench.vue";
import AppBottomNavigation from "@/features/app-shell/components/AppBottomNavigation.vue";
import type { AppShellTab } from "@/features/app-shell/types";
import ModuleManagement from "@/features/my-center/components/ModuleManagement.vue";
import MyCenter from "@/features/my-center/components/MyCenter.vue";
import { useMyCenter } from "@/features/my-center/composables/useMyCenter";
import { useBackupReminder } from "@/features/backup-reminder/composables/useBackupReminder";
import { useStorageCapacityReminder } from "@/features/storage-capacity/composables/useStorageCapacityReminder";
import { useLaunchFlow } from "@/features/launch/composables/useLaunchFlow";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { subscribeStorageCapacityChanged } from "@/infrastructure/storage/storage-capacity-events";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { createModuleAuthorizationRepository } from "@/repositories/module-authorization-repository";
import { createBackupReminderService } from "@/services/backup-reminder-service";
import { createMyCenterService } from "@/services/my-center-service";
import { createStorageCapacityService } from "@/services/storage-capacity-service";
import { waitForStartupExportConfirmation } from "@/services/startup-export-confirmation-gate";
import { formatLocalDateTime } from "@/utils/date-time-display";

const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const files = createDefaultWechatBackupFileAdapter();
const moduleAuthorization = createModuleAuthorizationRepository(storage);
const applicationData = createApplicationDataRepository({
  storage,
  rollbackFiles: files,
  appVersion: APP_VERSION,
});
const {
  pageState,
  moduleCode,
  errorMessage,
  submitting,
  initialize,
  unlock,
  enterWorkbench,
  openBackupRestore,
} = useLaunchFlow({ moduleAuthorization, applicationData });

const backupReminder = createBackupReminderService({
  repository: applicationData,
});
const { checkBackupReminder } = useBackupReminder({
  service: backupReminder,
  openBackupRestore,
});
const storageCapacityService = createStorageCapacityService({ storage });
const { checkStorageCapacity } = useStorageCapacityReminder({
  service: storageCapacityService,
  openBackupRestore,
  openHistoryCleanup: () => { void requestHistoryCleanup(); },
});
const unsubscribeStorageCapacity = subscribeStorageCapacityChanged(() => {
  void checkProtectionReminders();
});
const activeTab = shallowRef<AppShellTab>("workbench");
const managingModules = shallowRef(false);
const myCenterService = createMyCenterService({
  repository: applicationData,
  storage,
});
const {
  overview: myOverview,
  loading: myLoading,
  overviewError: myOverviewError,
  moduleCode: additionalModuleCode,
  moduleError,
  submittingModuleCode,
  refresh: refreshMyCenter,
  unlockAdditionalModule,
} = useMyCenter({ service: myCenterService, moduleAuthorization });

async function initializePage(): Promise<void> {
  await initialize();
  if (pageState.value === "workbench") {
    await checkProtectionReminders();
  }
}

/** 首次激活后的“继续”不会触发页面 onShow，因此在状态切换后显式读取工作台数据。 */
async function enterAuthorizedWorkbench(): Promise<void> {
  enterWorkbench();
  await checkProtectionReminders();
}

let protectionReminderCheck: Promise<void> | undefined;

function checkProtectionReminders(): Promise<void> {
  if (!protectionReminderCheck) {
    protectionReminderCheck = (async () => {
      const startupConfirmation = await waitForStartupExportConfirmation();
      if (startupConfirmation.handledPending) {
        return;
      }
      if (!(await checkStorageCapacity())) {
        await checkBackupReminder();
      }
    })().finally(() => {
      protectionReminderCheck = undefined;
    });
  }
  return protectionReminderCheck;
}

async function checkWorkbenchReminder(): Promise<void> {
  if (pageState.value === "workbench") {
    await checkProtectionReminders();
  }
  if (pageState.value === "workbench" && activeTab.value === "mine") {
    await refreshMyCenter();
  }
}

function selectTab(tab: AppShellTab): void {
  managingModules.value = false;
  activeTab.value = tab;
  const titles: Record<AppShellTab, string> = {
    workbench: "工作台",
    mine: "我的",
  };
  uni.setNavigationBarTitle({ title: titles[tab] });
  if (tab === "mine") {
    void refreshMyCenter();
  } else if (tab === "workbench") {
    void checkProtectionReminders();
  }
}

function openModuleManagement(): void {
  managingModules.value = true;
  uni.setNavigationBarTitle({ title: "模块管理" });
  void refreshMyCenter();
}

function closeModuleManagement(): void {
  managingModules.value = false;
  uni.setNavigationBarTitle({ title: "我的" });
}

function showUsageGuide(): void {
  uni.showModal({
    title: "本地数据说明",
    content: "无需登录，数据只保存在本机。请定期导出未加密 JSON 备份；删除小程序或清除缓存前务必先导出。",
    showCancel: false,
    confirmText: "我知道了",
  });
}

function openBeautyModule(): void {
  uni.navigateTo({ url: "/pages/beauty/index" });
}

async function requestHistoryCleanup(): Promise<void> {
  try {
    const data = await applicationData.readSnapshot();
    const lastExportedAt = data.backupMetadata.lastExportedAt;
    if (!lastExportedAt) {
      uni.showModal({
        title: "请先备份",
        content: "清理预约历史后无法恢复。请先导出一份完整备份，再回来清理。",
        confirmText: "先去备份",
        cancelText: "暂不清理",
        success(result) {
          if (result.confirm) {
            openBackupRestore();
          }
        },
      });
      return;
    }
    uni.showModal({
      title: "进入历史清理？",
      content: `最近完整备份：${formatLocalDateTime(lastExportedAt)}。历史记录需逐条确认删除，删除后无法撤销。`,
      confirmText: "继续清理",
      cancelText: "暂不清理",
      confirmColor: "#9A4A47",
      success(result) {
        if (result.confirm) {
          uni.navigateTo({ url: "/pages/history-cleanup/index" });
        }
      },
    });
  } catch {
    uni.showToast({ title: "本机数据读取失败，请稍后重试", icon: "none" });
  }
}

onMounted(initializePage);
onUnmounted(unsubscribeStorageCapacity);
onShow(checkWorkbenchReminder);
</script>

<template>
  <view class="index-page">
    <view v-if="pageState === 'loading'" class="index-page__loading">
      <view class="index-page__loading-dot" />
      <text>正在读取本机数据</text>
    </view>

    <ModuleActivationForm
      v-else-if="pageState === 'locked'"
      v-model="moduleCode"
      :submitting="submitting"
      :error-message="errorMessage"
      @submit="unlock"
      @restore="openBackupRestore"
    />

    <DataProtectionErrorState
      v-else-if="pageState === 'data-error'"
      :message="errorMessage"
      @retry="initialize"
    />

    <ModuleUnlockSuccess
      v-else-if="pageState === 'unlocked'"
      @continue="enterAuthorizedWorkbench"
    />

    <template v-else>
      <ModuleManagement
        v-if="managingModules"
        v-model="additionalModuleCode"
        :unlocked-modules="myOverview?.unlockedModules ?? []"
        :submitting="submittingModuleCode"
        :error-message="moduleError"
        @back="closeModuleManagement"
        @submit="unlockAdditionalModule"
      />

      <template v-else>
        <BeautyWorkbench
          v-if="activeTab === 'workbench'"
          @open-module="openBeautyModule"
        />
        <MyCenter
          v-else
          :overview="myOverview"
          :loading="myLoading"
          :error-message="myOverviewError"
          @backup-restore="openBackupRestore"
          @manage-modules="openModuleManagement"
          @usage-guide="showUsageGuide"
          @cleanup-history="requestHistoryCleanup"
          @retry="refreshMyCenter"
        />
        <AppBottomNavigation
          :active-tab="activeTab"
          @select="selectTab"
        />
      </template>
    </template>
  </view>
</template>

<style scoped>
.index-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 92% 4%, rgba(65, 102, 183, 0.08), transparent 32%),
    #f8f9fb;
}

.index-page__loading {
  display: flex;
  min-height: 80vh;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  color: #697284;
  font-size: 27rpx;
}

.index-page__loading-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: #3159b5;
  box-shadow: 0 0 0 12rpx rgba(49, 89, 181, 0.1);
}
</style>
