<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "@/features/shared/components/AppIcon.vue";
import BackupExportSection from "./BackupExportSection.vue";
import BackupExportOverview from "./BackupExportOverview.vue";
import BackupRestoreSection from "./BackupRestoreSection.vue";
import SystemBackupExportSection from "./SystemBackupExportSection.vue";
import SystemBackupRestoreSection from "./SystemBackupRestoreSection.vue";
import type {
  BackupExportViewState,
  BackupRestoreViewState,
} from "../types";

const props = defineProps<{
  exportState: Readonly<BackupExportViewState>;
  restoreState: Readonly<BackupRestoreViewState>;
  lastExportedAt?: string;
  lastExportFileName?: string;
  busy: boolean;
  context: "system" | "beauty";
  exportScope: "system" | "beauty";
  allowScopeSelection: boolean;
}>();

const emit = defineEmits<{
  (event: "prepare-export"): void;
  (event: "request-export-scope", scope: "system" | "beauty"): void;
  (event: "share-export"): void;
  (event: "confirm-export-sent"): void;
  (event: "confirm-export-cancelled"): void;
  (event: "select-restore"): void;
  (event: "prepare-current-export"): void;
  (event: "proceed"): void;
  (event: "return-home"): void;
  (event: "select-export-scope", scope: "system" | "beauty"): void;
}>();

const scopeLabel = computed(() =>
  props.exportScope === "system" ? "完整系统" : "美容模块",
);

const canChangeScope = computed(() =>
  ["idle", "completed", "cancelled", "failed"].includes(
    props.exportState.status,
  ),
);

</script>

<template>
  <view v-if="props.context === 'system'" class="system-panel">
    <view class="system-panel__atmosphere system-panel__atmosphere--rose" aria-hidden="true" />
    <view class="system-panel__atmosphere system-panel__atmosphere--sand" aria-hidden="true" />
    <view class="system-panel__atmosphere system-panel__atmosphere--slate" aria-hidden="true" />

    <view class="system-panel__content">
      <view class="system-panel__intro">
        <text class="system-panel__title">守住本机数据</text>
        <text class="system-panel__description">定期导出，换机或误删时可以恢复</text>
      </view>

      <BackupExportOverview :last-exported-at="props.lastExportedAt" />

      <SystemBackupExportSection
        :state="props.exportState"
        :last-export-file-name="props.lastExportFileName"
        :busy="props.busy"
        :export-scope="props.exportScope"
        @request="emit('request-export-scope', $event)"
        @share="emit('share-export')"
        @confirm-sent="emit('confirm-export-sent')"
        @confirm-cancelled="emit('confirm-export-cancelled')"
      />

      <SystemBackupRestoreSection
        :state="props.restoreState"
        :busy="props.busy"
        @select="emit('select-restore')"
        @prepare-current-export="emit('prepare-current-export')"
        @proceed="emit('proceed')"
        @return-home="emit('return-home')"
      />

      <view class="system-panel__privacy">
        <view class="system-panel__privacy-icon">
          <AppIcon name="shield" :size="24" color="#6D685B" />
        </view>
        <text class="system-panel__privacy-copy">
          备份文件未加密，可能包含顾客资料，请妥善保管。不同设备不会自动同步。
        </text>
      </view>
    </view>
  </view>

  <view v-else class="backup-panel">
    <view class="backup-panel__intro">
      <text class="backup-panel__eyebrow">美容模块</text>
      <text class="backup-panel__title">美容数据</text>
      <text class="backup-panel__description">
        这里只导出或恢复美容模块；其他模块和系统设置不会被覆盖。
      </text>
    </view>

    <view v-if="props.allowScopeSelection" class="backup-scope">
      <text class="backup-scope__title">本次导出范围</text>
      <view class="backup-scope__options">
        <button
          class="backup-scope__option"
          :class="{ 'backup-scope__option--active': props.exportScope === 'system' }"
          :disabled="!canChangeScope"
          @click="emit('select-export-scope', 'system')"
        >
          <text>完整系统</text>
          <text>设置、授权和所有模块</text>
        </button>
        <button
          class="backup-scope__option"
          :class="{ 'backup-scope__option--active': props.exportScope === 'beauty' }"
          :disabled="!canChangeScope"
          @click="emit('select-export-scope', 'beauty')"
        >
          <text>选择模块</text>
          <text>美容模块</text>
        </button>
      </view>
    </view>

    <view class="backup-panel__privacy">
      <text class="backup-panel__privacy-title">未加密文件，请妥善保管</text>
      <text class="backup-panel__privacy-copy">
        备份包含顾客资料、预约和全部经营数据，请勿发送给无关人员。恢复会先完整校验文件。
      </text>
    </view>

    <BackupExportSection
      :state="props.exportState"
      :last-exported-at="props.lastExportedAt"
      :last-export-file-name="props.lastExportFileName"
      :busy="props.busy"
      :scope-label="scopeLabel"
      :show-last-system-export="false"
      @prepare="emit('prepare-export')"
      @share="emit('share-export')"
      @confirm-sent="emit('confirm-export-sent')"
      @confirm-cancelled="emit('confirm-export-cancelled')"
    />

    <BackupRestoreSection
      :state="props.restoreState"
      :busy="props.busy"
      @select="emit('select-restore')"
      @prepare-current-export="emit('prepare-current-export')"
      @proceed="emit('proceed')"
      @return-home="emit('return-home')"
    />
  </view>
</template>

<style scoped>
.system-panel {
  position: relative;
  min-height: calc(100vh - 88rpx);
  overflow: hidden;
  background: #f3f1ec;
  color: #242620;
}

.system-panel__atmosphere {
  position: absolute;
  border-radius: 50%;
  filter: blur(96rpx);
  pointer-events: none;
}

.system-panel__atmosphere--rose {
  top: 90rpx;
  left: -210rpx;
  width: 520rpx;
  height: 520rpx;
  background: rgba(183, 131, 140, 0.22);
}

.system-panel__atmosphere--sand {
  top: 760rpx;
  right: -220rpx;
  width: 560rpx;
  height: 560rpx;
  background: rgba(188, 158, 121, 0.25);
}

.system-panel__atmosphere--slate {
  bottom: 100rpx;
  left: 80rpx;
  width: 420rpx;
  height: 420rpx;
  background: rgba(61, 74, 93, 0.09);
}

.system-panel__content {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  padding: 54rpx 46rpx calc(60rpx + env(safe-area-inset-bottom));
}

.system-panel__intro {
  display: flex;
  flex-direction: column;
}

.system-panel__title {
  color: #242620;
  font-size: 50rpx;
  font-weight: 660;
  letter-spacing: -1rpx;
  line-height: 1.15;
}

.system-panel__description {
  margin-top: 20rpx;
  color: #6f716c;
  font-size: 24rpx;
  line-height: 1.55;
}

.system-panel__privacy {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  margin-top: 36rpx;
  padding: 24rpx 26rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.72);
  border-radius: 28rpx;
  background: rgba(251, 250, 247, 0.5);
  box-shadow:
    0 18rpx 42rpx rgba(75, 63, 51, 0.08),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.82);
  -webkit-backdrop-filter: blur(26rpx) saturate(1.1);
  backdrop-filter: blur(26rpx) saturate(1.1);
}

.system-panel__privacy-icon {
  display: flex;
  width: 52rpx;
  height: 52rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.system-panel__privacy-copy {
  flex: 1;
  color: #74736d;
  font-size: 21rpx;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.backup-panel {
  display: flex;
  min-height: calc(100vh - 88rpx);
  box-sizing: border-box;
  flex-direction: column;
  gap: 24rpx;
  padding: 42rpx 30rpx calc(48rpx + env(safe-area-inset-bottom));
}

.backup-panel__intro {
  display: flex;
  flex-direction: column;
  padding: 0 12rpx;
}

.backup-panel__eyebrow {
  color: #31549e;
  font-size: 23rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
}

.backup-panel__title {
  margin-top: 16rpx;
  color: #172033;
  font-size: 44rpx;
  font-weight: 700;
}

.backup-panel__description {
  margin-top: 14rpx;
  color: #687183;
  font-size: 25rpx;
  line-height: 1.65;
}

.backup-panel__privacy {
  margin: 8rpx 0;
  padding: 24rpx 28rpx;
  border-left: 6rpx solid #d39b30;
  border-radius: 12rpx;
  background: #fff8e9;
}

.backup-panel__privacy-title,
.backup-panel__privacy-copy {
  display: block;
}

.backup-panel__privacy-title {
  color: #76551e;
  font-size: 25rpx;
  font-weight: 600;
}

.backup-panel__privacy-copy {
  margin-top: 9rpx;
  color: #7c6841;
  font-size: 22rpx;
  line-height: 1.6;
}

.backup-scope {
  padding: 28rpx;
  border: 2rpx solid #dfe4ec;
  border-radius: 20rpx;
  background: #ffffff;
}

.backup-scope__title {
  display: block;
  color: #354157;
  font-size: 25rpx;
  font-weight: 700;
}

.backup-scope__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 18rpx;
}

.backup-scope__option {
  display: flex;
  min-width: 0;
  min-height: 112rpx;
  box-sizing: border-box;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 18rpx 20rpx;
  border: 2rpx solid #dce2eb;
  border-radius: 15rpx;
  background: #f8f9fb;
  color: #344158;
  font-size: 24rpx;
  text-align: left;
}

.backup-scope__option text:last-child {
  margin-top: 7rpx;
  color: #7a8494;
  font-size: 19rpx;
}

.backup-scope__option--active {
  border-color: #3159b5;
  background: #edf3ff;
  color: #294d96;
}

@media (max-width: 360px) {
  .system-panel__content {
    padding-right: 36rpx;
    padding-left: 36rpx;
  }

  .system-panel__title {
    font-size: 46rpx;
  }
}

</style>
