<script setup lang="ts">
import { computed } from "vue";
import type {
  CapabilityResult,
  CapabilityStatus,
} from "../types";

const props = defineProps<{
  checks: readonly CapabilityResult[];
  runningAutomatedChecks: boolean;
  runningManualCheck: boolean;
}>();

const emit = defineEmits<{
  (event: "run-automated"): void;
  (event: "check-capacity-rollback"): void;
  (event: "check-share"): void;
  (event: "confirm-share-sent"): void;
  (event: "confirm-share-cancelled"): void;
  (event: "check-choose"): void;
}>();

const statusLabels: Record<CapabilityStatus, string> = {
  idle: "待检查",
  running: "检查中",
  "awaiting-confirmation": "待确认",
  passed: "已通过",
  cancelled: "已取消",
  failed: "未通过",
};

const shareAwaitingConfirmation = computed(() =>
  props.checks.some(
    (item) => item.id === "share" && item.status === "awaiting-confirmation",
  ),
);

function statusLabel(status: CapabilityStatus): string {
  return statusLabels[status];
}

function isRunning(id: CapabilityResult["id"]): boolean {
  return props.checks.some((item) => item.id === id && item.status === "running");
}
</script>

<template>
  <view class="capability-panel">
    <view class="capability-panel__intro">
      <text class="capability-panel__eyebrow">阶段 0 · 真机能力验证</text>
      <text class="capability-panel__title">基础能力检查</text>
      <text class="capability-panel__description">
        自动检查不会改动业务数据。微信转发和聊天文件选择需要在真机上手动触发。
      </text>
    </view>

    <view class="capability-panel__list">
      <view
        v-for="check in props.checks"
        :key="check.id"
        class="capability-card"
      >
        <view class="capability-card__heading">
          <text class="capability-card__label">{{ check.label }}</text>
          <text
            class="capability-card__status"
            :class="`capability-card__status--${check.status}`"
          >
            {{ statusLabel(check.status) }}
          </text>
        </view>
        <text class="capability-card__detail">{{ check.detail }}</text>
      </view>
    </view>

    <button
      class="capability-panel__button capability-panel__button--primary"
      :loading="props.runningAutomatedChecks"
      :disabled="props.runningAutomatedChecks || props.runningManualCheck"
      @click="emit('run-automated')"
    >
      重新运行自动检查
    </button>

    <view class="capability-panel__manual-actions">
      <button
        class="capability-panel__button"
        :loading="isRunning('capacity-rollback')"
        :disabled="props.runningAutomatedChecks || props.runningManualCheck || isRunning('capacity-rollback')"
        @click="emit('check-capacity-rollback')"
      >
        运行接近 7MB 容量检查
      </button>
      <button
        class="capability-panel__button"
        :loading="isRunning('share')"
        :disabled="props.runningAutomatedChecks || props.runningManualCheck || isRunning('share')"
        @click="emit('check-share')"
      >
        1. 转发测试 JSON 到聊天
      </button>
      <view
        v-if="shareAwaitingConfirmation"
        class="capability-panel__share-confirmation"
      >
        <text class="capability-panel__share-confirmation-copy">
          请按微信面板中的实际操作确认结果
        </text>
        <view class="capability-panel__share-confirmation-actions">
          <button
            class="capability-panel__button capability-panel__button--compact"
            @click="emit('confirm-share-sent')"
          >
            确认已发送
          </button>
          <button
            class="capability-panel__button capability-panel__button--compact capability-panel__button--quiet"
            @click="emit('confirm-share-cancelled')"
          >
            确认已取消
          </button>
        </view>
      </view>
      <button
        class="capability-panel__button"
        :loading="isRunning('choose')"
        :disabled="props.runningAutomatedChecks || props.runningManualCheck"
        @click="emit('check-choose')"
      >
        2. 从刚才的聊天选择 JSON
      </button>
    </view>

    <view class="capability-panel__notice">
      <text class="capability-panel__notice-title">验证说明</text>
      <text class="capability-panel__notice-copy">
        容量检查只使用 bm:stage0 开头的隔离 key，达到约 7MB 后立即清理，不会删除业务数据。文件检查需先把测试 JSON 发送到一个聊天并确认成功，再返回小程序选择同一个聊天；若该聊天中没有 JSON 文件，微信的文件列表会显示为空。选择文件后只读取并解析 JSON，不执行恢复，也不会覆盖本机数据。
      </text>
    </view>
  </view>
</template>

<style scoped>
.capability-panel {
  min-height: calc(100vh - 88rpx);
  box-sizing: border-box;
  padding: 44rpx 30rpx calc(48rpx + env(safe-area-inset-bottom));
}

.capability-panel__intro {
  display: flex;
  flex-direction: column;
  padding: 0 12rpx;
}

.capability-panel__eyebrow {
  color: #31549e;
  font-size: 23rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
}

.capability-panel__title {
  margin-top: 18rpx;
  color: #172033;
  font-size: 44rpx;
  font-weight: 700;
}

.capability-panel__description {
  margin-top: 16rpx;
  color: #687183;
  font-size: 26rpx;
  line-height: 1.7;
}

.capability-panel__list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 36rpx;
}

.capability-card {
  padding: 28rpx 30rpx;
  border: 2rpx solid #e1e5ec;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8rpx 24rpx rgba(28, 42, 68, 0.05);
}

.capability-card__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.capability-card__label {
  color: #202a3c;
  font-size: 28rpx;
  font-weight: 600;
}

.capability-card__status {
  flex-shrink: 0;
  padding: 7rpx 14rpx;
  border-radius: 999rpx;
  background: #eef1f5;
  color: #6f7888;
  font-size: 21rpx;
}

.capability-card__status--running {
  background: #eef3ff;
  color: #3159b5;
}

.capability-card__status--awaiting-confirmation {
  background: #fff5dc;
  color: #9a6512;
}

.capability-card__status--passed {
  background: #e8f6f1;
  color: #16826f;
}

.capability-card__status--cancelled {
  background: #f1f3f7;
  color: #626d80;
}

.capability-card__status--failed {
  background: #fff0ef;
  color: #bd3f3f;
}

.capability-card__detail {
  display: block;
  margin-top: 12rpx;
  color: #727b8b;
  font-size: 24rpx;
  line-height: 1.55;
  word-break: break-all;
}

.capability-panel__button {
  display: flex;
  width: 100%;
  min-height: 88rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  margin-top: 18rpx;
  border: 2rpx solid #3156a9;
  border-radius: 17rpx;
  background: #ffffff;
  color: #294da8;
  font-size: 27rpx;
  font-weight: 600;
}

.capability-panel__button--primary {
  margin-top: 34rpx;
  border-color: transparent;
  background: linear-gradient(135deg, #3562c9, #243f9f);
  box-shadow: 0 12rpx 26rpx rgba(37, 64, 159, 0.16);
  color: #ffffff;
}

.capability-panel__button[disabled] {
  opacity: 0.62;
}

.capability-panel__manual-actions {
  margin-top: 8rpx;
}

.capability-panel__share-confirmation {
  margin-top: 16rpx;
  padding: 22rpx;
  border: 2rpx solid #ecd69d;
  border-radius: 17rpx;
  background: #fffaf0;
}

.capability-panel__share-confirmation-copy {
  display: block;
  color: #76551e;
  font-size: 23rpx;
  line-height: 1.55;
}

.capability-panel__share-confirmation-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}

.capability-panel__button--compact {
  min-height: 72rpx;
  margin-top: 0;
  font-size: 24rpx;
}

.capability-panel__button--quiet {
  border-color: #aeb5c1;
  color: #5e6879;
}

.capability-panel__notice {
  display: flex;
  flex-direction: column;
  margin-top: 34rpx;
  padding: 26rpx 28rpx;
  border-radius: 18rpx;
  background: #f1f3f7;
}

.capability-panel__notice-title {
  color: #3c475b;
  font-size: 25rpx;
  font-weight: 600;
}

.capability-panel__notice-copy {
  margin-top: 10rpx;
  color: #6f7888;
  font-size: 23rpx;
  line-height: 1.65;
}
</style>
