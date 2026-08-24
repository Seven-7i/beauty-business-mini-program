<script setup lang="ts">
import { computed } from "vue";
import type { BackupRestoreViewState } from "../types";
import {
  formatFileSize,
  formatLocalDateTime,
} from "@/utils/date-time-display";

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
  <view class="restore-section">
    <view class="restore-section__heading">
      <text class="restore-section__eyebrow">恢复</text>
      <text class="restore-section__title">从备份恢复</text>
      <text class="restore-section__description">
        选择文件后先进行只读校验，不会立即修改本机数据。
      </text>
    </view>

    <view v-if="props.state.candidate" class="restore-file">
      <view class="restore-file__topline">
        <view class="restore-file__icon">JSON</view>
        <view class="restore-file__identity">
          <text class="restore-file__name">
            {{ props.state.candidate.fileName }}
          </text>
          <text class="restore-file__size">
            {{ formatFileSize(props.state.candidate.sizeBytes) }}
          </text>
        </view>
      </view>
      <view class="restore-file__metadata">
        <view class="restore-file__row">
          <text>恢复范围</text>
          <text>{{ props.state.candidate.scopeLabel }}</text>
        </view>
        <view class="restore-file__row">
          <text>生成时间</text>
          <text>{{ formatLocalDateTime(props.state.candidate.createdAt) }}</text>
        </view>
        <view class="restore-file__row">
          <text>应用版本</text>
          <text>v{{ props.state.candidate.appVersion }}</text>
        </view>
      </view>
      <view class="restore-summary">
        <view class="restore-summary__item">
          <text>顾客</text>
          <text>{{ props.state.candidate.summary.customerCount }}</text>
        </view>
        <view class="restore-summary__item">
          <text>项目</text>
          <text>{{ props.state.candidate.summary.projectCount }}</text>
        </view>
        <view class="restore-summary__item">
          <text>库存物品</text>
          <text>{{ props.state.candidate.summary.inventoryItemCount }}</text>
        </view>
        <view class="restore-summary__item">
          <text>预约</text>
          <text>{{ props.state.candidate.summary.appointmentCount }}</text>
        </view>
        <view class="restore-summary__item">
          <text>库存变动</text>
          <text>{{ props.state.candidate.summary.inventoryMovementCount }}</text>
        </view>
      </view>
    </view>

    <view
      v-if="props.state.candidate?.currentHasBusinessData && props.state.status === 'ready'"
      class="restore-warning"
    >
      <text class="restore-warning__title">
        {{
          props.state.candidate.scopeKind === "system"
            ? "恢复将覆盖当前完整系统数据"
            : `恢复将覆盖当前${props.state.candidate.scopeLabel}数据`
        }}
      </text>
      <text class="restore-warning__copy">
        {{
          props.state.candidate.scopeKind === "system"
            ? "不会合并两份数据。你可以先导出当前系统数据，也可以直接确认继续。"
            : "不会合并两份模块数据，其他模块、个人设置和授权状态不会改变。"
        }}
      </text>
    </view>

    <view
      class="restore-section__message"
      :class="`restore-section__message--${props.state.status}`"
    >
      <text>{{ props.state.detail }}</text>
    </view>

    <button
      v-if="canSelect"
      class="restore-section__button"
      :disabled="props.busy"
      @click="emit('select')"
    >
      选择微信聊天中的备份
    </button>

    <view v-else-if="props.state.status === 'ready'" class="restore-actions">
      <button
        v-if="props.state.candidate?.currentHasBusinessData"
        class="restore-section__button"
        :disabled="props.busy || props.state.currentDataExportStatus !== 'idle'"
        @click="emit('prepare-current-export')"
      >
        {{ currentExportButtonText }}
      </button>
      <text
        v-if="props.state.candidate?.currentHasBusinessData"
        class="restore-actions__hint"
      >
        {{
          props.state.currentDataExportStatus === "completed"
            ? "已完成保护，可以继续覆盖恢复。"
          : "也可以跳过导出，直接覆盖当前数据。"
        }}
      </text>
      <button
        class="restore-section__button restore-section__button--danger"
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
      class="restore-section__button restore-section__button--primary"
      @click="emit('return-home')"
    >
      重新进入应用
    </button>

    <button
      v-else-if="props.state.status === 'interrupted'"
      class="restore-section__button restore-section__button--danger"
      @click="emit('return-home')"
    >
      重新进入并继续恢复原数据
    </button>

    <button
      v-else
      class="restore-section__button restore-section__button--primary"
      disabled
      :loading="true"
    >
      正在处理
    </button>
  </view>
</template>

<style scoped>
.restore-section {
  padding: 32rpx;
  border: 2rpx solid #e1e5ec;
  border-radius: 22rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(28, 42, 68, 0.05);
}

.restore-section__heading,
.restore-file__identity {
  display: flex;
  flex-direction: column;
}

.restore-section__eyebrow {
  color: #31549e;
  font-size: 22rpx;
  font-weight: 600;
}

.restore-section__title {
  margin-top: 8rpx;
  color: #172033;
  font-size: 31rpx;
  font-weight: 700;
}

.restore-section__description {
  margin-top: 12rpx;
  color: #717a8a;
  font-size: 23rpx;
  line-height: 1.55;
}

.restore-file {
  margin-top: 26rpx;
  padding: 24rpx;
  border: 2rpx solid #dfe4ec;
  border-radius: 17rpx;
  background: #fbfcfe;
}

.restore-file__topline {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.restore-file__icon {
  display: flex;
  width: 66rpx;
  height: 66rpx;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  background: #3159b5;
  color: #ffffff;
  font-size: 18rpx;
  font-weight: 700;
}

.restore-file__identity {
  min-width: 0;
}

.restore-file__name {
  overflow: hidden;
  color: #283247;
  font-size: 24rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.restore-file__size {
  margin-top: 8rpx;
  color: #7a8290;
  font-size: 21rpx;
}

.restore-file__metadata {
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 2rpx solid #edf0f4;
}

.restore-file__row,
.restore-summary__item {
  display: flex;
  justify-content: space-between;
  color: #667083;
  font-size: 22rpx;
}

.restore-file__row + .restore-file__row {
  margin-top: 12rpx;
}

.restore-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx 28rpx;
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 2rpx solid #edf0f4;
}

.restore-warning {
  margin-top: 22rpx;
  padding: 22rpx;
  border: 2rpx solid #eed89e;
  border-radius: 15rpx;
  background: #fff9ea;
}

.restore-warning__title,
.restore-warning__copy {
  display: block;
}

.restore-warning__title {
  color: #855d13;
  font-size: 24rpx;
  font-weight: 600;
}

.restore-warning__copy {
  margin-top: 8rpx;
  color: #7c6841;
  font-size: 22rpx;
  line-height: 1.55;
}

.restore-section__message {
  margin-top: 22rpx;
  padding: 18rpx 20rpx;
  border-radius: 14rpx;
  background: #f2f4f7;
  color: #606a7c;
  font-size: 23rpx;
  line-height: 1.55;
}

.restore-section__message--completed {
  background: #eaf6f1;
  color: #237865;
}

.restore-section__message--failed {
  background: #fff0ef;
  color: #a93c3c;
}

.restore-section__message--interrupted {
  background: #fff0ef;
  color: #a93c3c;
}

.restore-actions {
  margin-top: 4rpx;
}

.restore-actions__hint {
  display: block;
  margin-top: 14rpx;
  color: #747d8d;
  font-size: 21rpx;
  line-height: 1.5;
  text-align: center;
}

.restore-section__button {
  display: flex;
  width: 100%;
  min-height: 88rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  margin-top: 18rpx;
  border: 2rpx solid #3156a9;
  border-radius: 16rpx;
  background: #ffffff;
  color: #294da8;
  font-size: 27rpx;
  font-weight: 600;
}

.restore-section__button--primary {
  border-color: transparent;
  background: #3159b5;
  color: #ffffff;
}

.restore-section__button--danger {
  border-color: transparent;
  background: #a94442;
  color: #ffffff;
}

.restore-section__button[disabled] {
  opacity: 0.62;
}
</style>
