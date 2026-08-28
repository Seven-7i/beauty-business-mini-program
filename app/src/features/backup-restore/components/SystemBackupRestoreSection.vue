<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "@/features/shared/components/AppIcon.vue";
import BackupRestoreCandidate from "./BackupRestoreCandidate.vue";
import type { BackupRestoreViewState } from "../types";

const props = defineProps<{
  state: Readonly<BackupRestoreViewState>;
  busy: boolean;
}>();

const emit = defineEmits<{
  (event: "select"): void;
  (event: "prepare-current-export"): void;
  (event: "proceed"): void;
  (event: "return-home"): void;
}>();

const canSelect = computed(() =>
  ["idle", "cancelled", "failed"].includes(props.state.status),
);

const currentExportButtonText = computed(() => {
  if (props.state.currentDataExportStatus === "in-progress") {
    return "请完成上方转发并确认";
  }
  if (props.state.currentDataExportStatus === "completed") {
    return "当前数据已确认导出";
  }
  return "先导出当前数据";
});
</script>

<template>
  <view class="system-restore">
    <view class="system-restore__heading">
      <view class="system-restore__mark" />
      <text class="system-restore__section-title">恢复数据</text>
    </view>

    <view class="system-restore__card">
      <view class="system-restore__lead">
        <view class="system-restore__icon">
          <AppIcon name="file-restore" :size="30" color="#3D4A5D" />
        </view>
        <view class="system-restore__copy">
          <text class="system-restore__title">从备份文件恢复</text>
          <text class="system-restore__description">校验文件后再确认覆盖范围</text>
        </view>
      </view>

      <BackupRestoreCandidate
        v-if="props.state.candidate"
        :candidate="props.state.candidate"
      />

      <view
        v-if="props.state.candidate?.currentHasBusinessData && props.state.status === 'ready'"
        class="system-restore__warning"
        role="alert"
      >
        <text class="system-restore__warning-title">
          {{
            props.state.candidate.scopeKind === "system"
              ? "恢复将覆盖当前完整系统数据"
              : `恢复将覆盖当前${props.state.candidate.scopeLabel}数据`
          }}
        </text>
        <text class="system-restore__warning-copy">
          {{
            props.state.candidate.scopeKind === "system"
              ? "不会合并两份数据。你可以先导出当前系统数据，也可以直接确认继续。"
              : "不会合并模块数据，其他模块、个人设置和授权状态不会改变。"
          }}
        </text>
      </view>

      <view
        v-if="!canSelect || props.state.status !== 'idle'"
        class="system-restore__message"
        :class="`system-restore__message--${props.state.status}`"
        role="status"
      >
        <text>{{ props.state.detail }}</text>
      </view>

      <button
        v-if="canSelect"
        class="system-restore__button"
        :disabled="props.busy"
        hover-class="system-restore__button--pressed"
        @click="emit('select')"
      >
        选择备份文件
      </button>

      <view v-else-if="props.state.status === 'ready'" class="system-restore__actions">
        <button
          v-if="props.state.candidate?.currentHasBusinessData"
          class="system-restore__button"
          :disabled="props.busy || props.state.currentDataExportStatus !== 'idle'"
          @click="emit('prepare-current-export')"
        >
          {{ currentExportButtonText }}
        </button>
        <text
          v-if="props.state.candidate?.currentHasBusinessData"
          class="system-restore__hint"
        >
          {{
            props.state.currentDataExportStatus === "completed"
              ? "已完成保护，可以继续覆盖恢复。"
              : "也可以跳过导出，直接覆盖当前数据。"
          }}
        </text>
        <button
          class="system-restore__button system-restore__button--danger"
          :disabled="props.busy"
          @click="emit('proceed')"
        >
          {{
            props.state.candidate?.currentHasBusinessData
              ? "我已了解，继续恢复"
              : "确认恢复"
          }}
        </button>
      </view>

      <button
        v-else-if="props.state.status === 'completed'"
        class="system-restore__button system-restore__button--primary"
        @click="emit('return-home')"
      >
        重新进入应用
      </button>

      <button
        v-else-if="props.state.status === 'interrupted'"
        class="system-restore__button system-restore__button--danger"
        @click="emit('return-home')"
      >
        重新进入并继续恢复原数据
      </button>

      <button
        v-else
        class="system-restore__button system-restore__button--primary"
        disabled
        :loading="true"
      >
        正在处理
      </button>
    </view>
  </view>
</template>

<style scoped>
.system-restore {
  margin-top: 42rpx;
}

.system-restore__heading {
  display: flex;
  min-height: 68rpx;
  align-items: center;
  gap: 16rpx;
}

.system-restore__mark {
  width: 7rpx;
  height: 28rpx;
  border-radius: 4rpx;
  background: #bca47f;
}

.system-restore__section-title {
  color: #242620;
  font-size: 29rpx;
  font-weight: 650;
}

.system-restore__card {
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

.system-restore__lead {
  display: flex;
  align-items: center;
  gap: 22rpx;
}

.system-restore__icon {
  display: flex;
  width: 76rpx;
  height: 76rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.system-restore__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.system-restore__title {
  color: #30322d;
  font-size: 27rpx;
  font-weight: 630;
}

.system-restore__description {
  margin-top: 8rpx;
  color: #7a7c76;
  font-size: 21rpx;
  line-height: 1.45;
}

.system-restore__warning,
.system-restore__message {
  margin-top: 22rpx;
  padding: 20rpx 22rpx;
  border-radius: 20rpx;
}

.system-restore__warning {
  border: 2rpx solid rgba(183, 131, 140, 0.24);
  background: rgba(255, 244, 242, 0.48);
}

.system-restore__warning-title,
.system-restore__warning-copy {
  display: block;
}

.system-restore__warning-title {
  color: #77464b;
  font-size: 23rpx;
  font-weight: 630;
}

.system-restore__warning-copy {
  margin-top: 8rpx;
  color: #80676a;
  font-size: 21rpx;
  line-height: 1.55;
}

.system-restore__message {
  background: rgba(61, 74, 93, 0.07);
  color: #666a64;
  font-size: 22rpx;
  line-height: 1.55;
}

.system-restore__message--failed,
.system-restore__message--interrupted {
  background: rgba(183, 92, 96, 0.1);
  color: #8a4d53;
}

.system-restore__button {
  display: flex;
  width: 100%;
  min-height: 84rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  margin-top: 22rpx;
  border: 2rpx solid rgba(61, 74, 93, 0.56);
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.18);
  color: #3d4a5d;
  font-size: 25rpx;
  font-weight: 620;
  transition: opacity 160ms ease, transform 160ms ease;
}

.system-restore__button--primary {
  border-color: transparent;
  background: #3d4a5d;
  color: #f8f6f1;
}

.system-restore__button--danger {
  border-color: transparent;
  background: #9a565d;
  color: #fffaf7;
}

.system-restore__button--pressed {
  opacity: 0.72;
  transform: scale(0.99);
}

.system-restore__button[disabled] {
  opacity: 0.58;
}

.system-restore__hint {
  display: block;
  margin-top: 14rpx;
  color: #777974;
  font-size: 21rpx;
  line-height: 1.5;
  text-align: center;
}
</style>
