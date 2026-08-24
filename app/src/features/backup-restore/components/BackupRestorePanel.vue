<script setup lang="ts">
import { computed } from "vue";
import BackupExportSection from "./BackupExportSection.vue";
import BackupRestoreSection from "./BackupRestoreSection.vue";
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
  <view class="backup-panel">
    <view class="backup-panel__intro">
      <text class="backup-panel__eyebrow">
        {{ props.context === "beauty" ? "美容模块" : "系统级数据保护" }}
      </text>
      <text class="backup-panel__title">
        {{ props.context === "beauty" ? "美容数据" : "备份与恢复" }}
      </text>
      <text class="backup-panel__description">
        {{
          props.context === "beauty"
            ? "这里只导出或恢复美容模块；其他模块和系统设置不会被覆盖。"
            : "可以完整备份系统，也可以只选择需要保护的业务模块。"
        }}
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
      :show-last-system-export="props.context === 'system'"
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

</style>
