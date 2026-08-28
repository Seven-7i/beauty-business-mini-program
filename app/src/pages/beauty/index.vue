<script setup lang="ts">
import { onMounted, shallowRef } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { APP_VERSION } from "@/config/app";
import BackupRestorePanel from "@/features/backup-restore/components/BackupRestorePanel.vue";
import { useBackupRestoreFlow } from "@/features/backup-restore/composables/useBackupRestoreFlow";
import AppointmentCalendar from "@/features/appointment/components/AppointmentCalendar.vue";
import { useAppointmentCalendar } from "@/features/appointment/composables/useAppointmentCalendar";
import BeautyModuleHome from "@/features/beauty-module/components/BeautyModuleHome.vue";
import BeautyModuleNavigation from "@/features/beauty-module/components/BeautyModuleNavigation.vue";
import { useBeautyHomeOverview } from "@/features/beauty-module/composables/useBeautyHomeOverview";
import type { BeautyModuleTab } from "@/features/beauty-module/types";
import BeautyReports from "@/features/statistics/components/BeautyReports.vue";
import {
  createUniStorageAdapter,
  type UniStorageRuntime,
} from "@/infrastructure/storage/uni-storage-adapter";
import { createDefaultWechatBackupFileAdapter } from "@/infrastructure/wechat/backup-file-adapter";
import { createApplicationDataRepository } from "@/repositories/application-data-repository";
import { createBackupRestoreService } from "@/services/backup-restore-service";
import { createPendingExportConfirmationService } from "@/services/pending-export-confirmation-service";

// 页面作为组合根注入本机数据能力，首页组件只接收派生展示状态。
const files = createDefaultWechatBackupFileAdapter();
const storage = createUniStorageAdapter(uni as unknown as UniStorageRuntime);
const repository = createApplicationDataRepository({
  storage,
  rollbackFiles: files,
  appVersion: APP_VERSION,
});
const exportConfirmations = createPendingExportConfirmationService({
  storage,
  repository,
});
const { overview, customers, loading, errorMessage, refresh } =
  useBeautyHomeOverview(repository);
const appointmentCalendar = useAppointmentCalendar(repository);
const activeTab = shallowRef<BeautyModuleTab>("home");
const backupService = createBackupRestoreService({
  repository,
  files,
  appVersion: APP_VERSION,
  moduleContext: "beauty",
  exportConfirmations,
});
const {
  exportState: backupExportState,
  restoreState: backupRestoreState,
  busy: backupBusy,
  initialize: initializeBackup,
  prepareExport: prepareBackupExport,
  sharePreparedExport,
  confirmExportSent,
  confirmExportCancelled,
  prepareCurrentDataBeforeRestore,
  selectRestoreFile,
  confirmRestore,
  resetRestore,
} = useBackupRestoreFlow({
  service: backupService,
  initialExportScope: { kind: "modules", moduleIds: ["beauty"] },
});

function openInventory(): void {
  uni.navigateTo({ url: "/pages/inventory/index" });
}

function openProjects(): void {
  uni.navigateTo({ url: "/pages/beauty-project/index" });
}

function openCustomers(): void {
  uni.navigateTo({ url: "/pages/customer/index" });
}

function openAppointments(): void {
  uni.navigateTo({ url: "/pages/appointment/index" });
}

function refreshActiveTab(): void {
  if (activeTab.value === "schedule") {
    void appointmentCalendar.refresh();
  } else if (activeTab.value === "home" || activeTab.value === "reports") {
    void refresh();
  }
}

function selectTab(tab: BeautyModuleTab): void {
  activeTab.value = tab;
  const titles: Record<BeautyModuleTab, string> = {
    home: "美容管理",
    schedule: "美容 · 日程",
    reports: "美容 · 报表",
    data: "美容 · 数据",
  };
  uni.setNavigationBarTitle({ title: titles[tab] });
  refreshActiveTab();
}

async function prepareCurrentBeautyExport(): Promise<void> {
  await prepareCurrentDataBeforeRestore();
  if (backupExportState.status === "ready") {
    uni.pageScrollTo({ selector: ".data-section", duration: 300 });
  }
}

function requestBeautyRestoreConfirmation(): void {
  const candidate = backupRestoreState.candidate;
  const isSystem = candidate?.scopeKind === "system";
  uni.showModal({
    title: isSystem ? "完整恢复系统数据？" : "恢复美容模块数据？",
    content: isSystem
      ? "所选文件是完整系统备份，将覆盖全部模块、授权状态和个人设置。"
      : "只替换美容模块数据，不合并记录；其他模块、授权状态和个人设置保持不变。",
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

function requestShareResultConfirmation(): void {
  uni.showModal({
    title: "备份文件是否已发送？",
    content: "请按微信聊天中的实际结果确认。若现在不处理，下次进入程序时会再次提醒。",
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
      uni.showToast({ title: "确认框打开失败，下次启动会再次提醒", icon: "none" });
    },
  });
}

async function shareAndConfirmExport(): Promise<void> {
  await sharePreparedExport();
  if (backupExportState.status === "awaiting-confirmation") {
    requestShareResultConfirmation();
  }
}

function returnBeautyHome(): void {
  if (
    backupRestoreState.status === "interrupted" ||
    backupRestoreState.candidate?.scopeKind === "system"
  ) {
    // 完整系统恢复或未决事务必须重建全局启动流程。
    uni.reLaunch({ url: "/pages/index/index" });
    return;
  }
  resetRestore();
  selectTab("home");
}

onMounted(initializeBackup);
onShow(refreshActiveTab);
</script>

<template>
  <view class="beauty-page">
    <BeautyModuleHome
      v-if="activeTab === 'home'"
      :overview="overview"
      :customers="customers"
      :loading="loading"
      :error-message="errorMessage"
      @open-inventory="openInventory"
      @open-projects="openProjects"
      @open-customers="openCustomers"
      @open-appointments="openAppointments"
      @retry="refresh"
    />
    <AppointmentCalendar
      v-else-if="activeTab === 'schedule'"
      :calendar="appointmentCalendar.calendar.value"
      :selected-date-key="appointmentCalendar.selectedDateKey.value"
      :selected-appointments="appointmentCalendar.selectedAppointments.value"
      :customers="appointmentCalendar.customers.value"
      :loading="appointmentCalendar.loading.value"
      :error-message="appointmentCalendar.errorMessage.value"
      @previous-month="appointmentCalendar.previousMonth"
      @next-month="appointmentCalendar.nextMonth"
      @select-date="appointmentCalendar.selectDate"
      @open-appointments="openAppointments"
      @retry="appointmentCalendar.refresh"
    />
    <BeautyReports
      v-else-if="activeTab === 'reports'"
      :overview="overview"
      :loading="loading"
      :error-message="errorMessage"
      @retry="refresh"
    />
    <BackupRestorePanel
      v-else
      :export-state="backupExportState"
      :restore-state="backupRestoreState"
      :busy="backupBusy"
      context="beauty"
      export-scope="beauty"
      :allow-scope-selection="false"
      @prepare-export="prepareBackupExport"
      @share-export="shareAndConfirmExport"
      @confirm-export-sent="confirmExportSent"
      @confirm-export-cancelled="confirmExportCancelled"
      @select-restore="selectRestoreFile"
      @prepare-current-export="prepareCurrentBeautyExport"
      @proceed="requestBeautyRestoreConfirmation"
      @return-home="returnBeautyHome"
    />
    <BeautyModuleNavigation :active-tab="activeTab" @select="selectTab" />
  </view>
</template>

<style scoped>
.beauty-page {
  min-height: 100vh;
  background: #fbf5f7;
}

/* 模块数据页要为固定的模块内导航预留滚动尾部，避免最后一个恢复按钮被遮挡。 */
.beauty-page :deep(.backup-panel) {
  /* 让最后一个危险操作能滚动到固定导航上方，避开真机底部手势区。 */
  padding-bottom: calc(320rpx + env(safe-area-inset-bottom));
}

</style>
