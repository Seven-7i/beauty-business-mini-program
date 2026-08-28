<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "@/features/shared/components/AppIcon.vue";
import BackupScopeActions from "./BackupScopeActions.vue";
import type { BackupExportViewState } from "../types";

const props = defineProps<{
  state: Readonly<BackupExportViewState>;
  lastExportFileName?: string;
  busy: boolean;
  exportScope: "system" | "beauty";
}>();

const emit = defineEmits<{
  (event: "request", scope: "system" | "beauty"): void;
  (event: "share"): void;
  (event: "confirm-sent"): void;
  (event: "confirm-cancelled"): void;
}>();

const canPrepare = computed(() =>
  ["idle", "completed", "cancelled", "failed"].includes(props.state.status),
);

const scopeLabel = computed(() =>
  props.exportScope === "system" ? "完整系统备份" : "美容模块备份",
);
</script>

<template>
  <view class="system-export">
    <view class="system-export__heading">
      <view class="system-export__mark" />
      <text class="system-export__title">导出备份</text>
    </view>

    <BackupScopeActions
      v-if="canPrepare"
      :disabled="props.busy"
      @request="emit('request', $event)"
    />

    <view v-else class="system-export__process">
      <view class="system-export__process-head">
        <view class="system-export__icon">
          <AppIcon name="backup" :size="26" color="#3D4A5D" />
        </view>
        <view class="system-export__process-copy">
          <text class="system-export__process-title">{{ scopeLabel }}</text>
          <text v-if="props.state.fileName" class="system-export__file-name">
            {{ props.state.fileName }}
          </text>
          <text v-else-if="props.lastExportFileName" class="system-export__file-name">
            {{ props.lastExportFileName }}
          </text>
        </view>
      </view>

      <view
        class="system-export__message"
        :class="`system-export__message--${props.state.status}`"
        role="status"
      >
        <text>{{ props.state.detail }}</text>
      </view>

      <button
        v-if="props.state.status === 'ready'"
        class="system-export__button system-export__button--primary"
        :disabled="props.busy"
        hover-class="system-export__button--pressed"
        @click="emit('share')"
      >
        打开微信转发
      </button>

      <view
        v-else-if="props.state.status === 'awaiting-confirmation'"
        class="system-export__confirmation"
      >
        <text class="system-export__confirmation-title">请核对聊天中的实际结果</text>
        <view class="system-export__confirmation-actions">
          <button
            class="system-export__button system-export__button--primary"
            :disabled="props.busy"
            @click="emit('confirm-sent')"
          >
            确认已发送
          </button>
          <button
            class="system-export__button"
            :disabled="props.busy"
            @click="emit('confirm-cancelled')"
          >
            确认已取消
          </button>
        </view>
      </view>

      <button
        v-else-if="props.state.status === 'finalizing-sent'"
        class="system-export__button system-export__button--primary"
        :disabled="props.busy"
        @click="emit('confirm-sent')"
      >
        继续完成导出记录
      </button>

      <button
        v-else
        class="system-export__button system-export__button--primary"
        disabled
        :loading="true"
      >
        正在处理
      </button>
    </view>
  </view>
</template>

<style scoped>
.system-export {
  margin-top: 42rpx;
}

.system-export__heading {
  display: flex;
  min-height: 68rpx;
  align-items: center;
  gap: 16rpx;
}

.system-export__mark {
  width: 7rpx;
  height: 28rpx;
  border-radius: 4rpx;
  background: #bca47f;
}

.system-export__title {
  color: #242620;
  font-size: 29rpx;
  font-weight: 650;
}

.system-export__process {
  padding: 30rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.82);
  border-radius: 34rpx;
  background: rgba(251, 250, 247, 0.62);
  box-shadow:
    0 26rpx 58rpx rgba(75, 63, 51, 0.12),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.9);
  -webkit-backdrop-filter: blur(32rpx) saturate(1.14);
  backdrop-filter: blur(32rpx) saturate(1.14);
}

.system-export__process-head {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.system-export__icon {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.system-export__process-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.system-export__process-title {
  color: #30322d;
  font-size: 27rpx;
  font-weight: 630;
}

.system-export__file-name {
  margin-top: 8rpx;
  overflow: hidden;
  color: #7a7c76;
  font-size: 21rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-export__message {
  margin-top: 24rpx;
  padding: 18rpx 20rpx;
  border-radius: 18rpx;
  background: rgba(61, 74, 93, 0.07);
  color: #666a64;
  font-size: 22rpx;
  line-height: 1.55;
}

.system-export__message--awaiting-confirmation {
  background: rgba(188, 164, 127, 0.16);
  color: #715c3c;
}

.system-export__button {
  display: flex;
  width: 100%;
  min-height: 84rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  margin-top: 20rpx;
  border: 2rpx solid rgba(61, 74, 93, 0.36);
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.22);
  color: #3d4a5d;
  font-size: 25rpx;
  font-weight: 620;
  transition: opacity 160ms ease, transform 160ms ease;
}

.system-export__button--primary {
  border-color: transparent;
  background: #ae6971;
  color: #fffaf7;
  box-shadow: 0 12rpx 24rpx rgba(143, 75, 84, 0.16);
}

.system-export__button--pressed {
  opacity: 0.76;
  transform: scale(0.99);
}

.system-export__button[disabled] {
  opacity: 0.58;
}

.system-export__confirmation {
  margin-top: 22rpx;
}

.system-export__confirmation-title {
  display: block;
  color: #62543f;
  font-size: 22rpx;
}

.system-export__confirmation-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}
</style>
