<script setup lang="ts">
import { computed } from "vue";
import type { BackupExportViewState } from "../types";
import { formatLocalDateTime } from "@/utils/date-time-display";

const props = defineProps<{
  state: Readonly<BackupExportViewState>;
  lastExportedAt?: string;
  lastExportFileName?: string;
  busy: boolean;
  scopeLabel: string;
  showLastSystemExport: boolean;
}>();

const emit = defineEmits<{
  (event: "prepare"): void;
  (event: "share"): void;
  (event: "confirm-sent"): void;
  (event: "confirm-cancelled"): void;
}>();

const canPrepare = computed(() =>
  ["idle", "completed", "cancelled", "failed"].includes(props.state.status),
);
</script>

<template>
  <view class="data-section">
    <view class="data-section__heading">
      <view>
        <text class="data-section__eyebrow">导出</text>
        <text class="data-section__title">备份{{ props.scopeLabel }}</text>
      </view>
      <view v-if="props.showLastSystemExport" class="data-section__status">
        <text class="data-section__status-label">最近完整系统导出</text>
        <text class="data-section__status-value">
          {{ formatLocalDateTime(props.lastExportedAt) }}
        </text>
      </view>
    </view>

    <text
      v-if="props.lastExportFileName"
      class="data-section__last-file"
    >
      {{ props.lastExportFileName }}
    </text>

    <view v-if="props.state.fileName" class="export-file">
      <view class="export-file__icon">JSON</view>
      <view class="export-file__copy">
        <text class="export-file__name">{{ props.state.fileName }}</text>
        <text class="export-file__meta">已生成完整性校验</text>
      </view>
    </view>

    <view
      class="data-section__message"
      :class="`data-section__message--${props.state.status}`"
    >
      <text>{{ props.state.detail }}</text>
    </view>

    <button
      v-if="canPrepare"
      class="data-section__button data-section__button--primary"
      :loading="props.state.status === 'preparing'"
      :disabled="props.busy"
      @click="emit('prepare')"
    >
      {{ props.state.status === "completed" ? "再次生成备份" : "生成备份文件" }}
    </button>

    <button
      v-else-if="props.state.status === 'ready'"
      class="data-section__button data-section__button--primary"
      :disabled="props.busy"
      @click="emit('share')"
    >
      打开微信转发
    </button>

    <view
      v-else-if="props.state.status === 'awaiting-confirmation'"
      class="export-confirmation"
    >
      <text class="export-confirmation__title">请核对聊天中的实际结果</text>
      <view class="export-confirmation__actions">
        <button
          class="data-section__button data-section__button--primary data-section__button--compact"
          :disabled="props.busy"
          @click="emit('confirm-sent')"
        >
          确认已发送
        </button>
        <button
          class="data-section__button data-section__button--compact"
          :disabled="props.busy"
          @click="emit('confirm-cancelled')"
        >
          确认已取消
        </button>
      </view>
    </view>

    <button
      v-else
      class="data-section__button data-section__button--primary"
      disabled
      :loading="true"
    >
      正在处理
    </button>
  </view>
</template>

<style scoped>
.data-section {
  padding: 32rpx;
  border: 2rpx solid #e1e5ec;
  border-radius: 22rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(28, 42, 68, 0.05);
}

.data-section__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}

.data-section__eyebrow,
.data-section__title,
.data-section__status-label,
.data-section__status-value,
.data-section__last-file,
.export-file__name,
.export-file__meta,
.export-confirmation__title {
  display: block;
}

.data-section__eyebrow {
  color: #31549e;
  font-size: 22rpx;
  font-weight: 600;
}

.data-section__title {
  margin-top: 8rpx;
  color: #172033;
  font-size: 31rpx;
  font-weight: 700;
}

.data-section__status {
  flex-shrink: 0;
  text-align: right;
}

.data-section__status-label {
  color: #838b98;
  font-size: 21rpx;
}

.data-section__status-value {
  margin-top: 8rpx;
  color: #465064;
  font-size: 22rpx;
}

.data-section__last-file {
  margin-top: 12rpx;
  overflow: hidden;
  color: #7a8290;
  font-size: 21rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.export-file {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: 26rpx;
  padding: 22rpx;
  border-radius: 16rpx;
  background: #f3f6fc;
}

.export-file__icon {
  display: flex;
  width: 68rpx;
  height: 68rpx;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  background: #3159b5;
  color: #ffffff;
  font-size: 18rpx;
  font-weight: 700;
}

.export-file__copy {
  min-width: 0;
}

.export-file__name {
  overflow: hidden;
  color: #283247;
  font-size: 24rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.export-file__meta {
  margin-top: 8rpx;
  color: #778093;
  font-size: 21rpx;
}

.data-section__message {
  margin-top: 24rpx;
  padding: 18rpx 20rpx;
  border-radius: 14rpx;
  background: #f2f4f7;
  color: #606a7c;
  font-size: 23rpx;
  line-height: 1.55;
}

.data-section__message--completed {
  background: #eaf6f1;
  color: #237865;
}

.data-section__message--failed {
  background: #fff0ef;
  color: #a93c3c;
}

.data-section__message--awaiting-confirmation {
  background: #fff8e8;
  color: #76551e;
}

.data-section__button {
  display: flex;
  width: 100%;
  min-height: 88rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  margin-top: 22rpx;
  border: 2rpx solid #3156a9;
  border-radius: 16rpx;
  background: #ffffff;
  color: #294da8;
  font-size: 27rpx;
  font-weight: 600;
}

.data-section__button--primary {
  border-color: transparent;
  background: #3159b5;
  color: #ffffff;
}

.data-section__button--compact {
  min-height: 76rpx;
  margin-top: 0;
  font-size: 24rpx;
}

.data-section__button[disabled] {
  opacity: 0.62;
}

.export-confirmation {
  margin-top: 22rpx;
}

.export-confirmation__title {
  color: #5b4722;
  font-size: 23rpx;
}

.export-confirmation__actions {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}
</style>
