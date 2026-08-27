<script setup lang="ts">
import AppIcon from "@/features/shared/components/AppIcon.vue";
import type { BackupRestoreCandidateView } from "../types";
import {
  formatFileSize,
  formatLocalDateTime,
} from "@/utils/date-time-display";

const props = defineProps<{
  candidate: Readonly<BackupRestoreCandidateView>;
}>();
</script>

<template>
  <view class="restore-candidate">
    <view class="restore-candidate__topline">
      <view class="restore-candidate__icon">
        <AppIcon name="file-restore" :size="27" color="#3D4A5D" />
      </view>
      <view class="restore-candidate__identity">
        <text class="restore-candidate__name">{{ props.candidate.fileName }}</text>
        <text class="restore-candidate__size">
          {{ formatFileSize(props.candidate.sizeBytes) }}
        </text>
      </view>
    </view>

    <view class="restore-candidate__metadata">
      <view class="restore-candidate__row">
        <text>恢复范围</text>
        <text>{{ props.candidate.scopeLabel }}</text>
      </view>
      <view class="restore-candidate__row">
        <text>生成时间</text>
        <text>{{ formatLocalDateTime(props.candidate.createdAt) }}</text>
      </view>
      <view class="restore-candidate__row">
        <text>应用版本</text>
        <text>v{{ props.candidate.appVersion }}</text>
      </view>
    </view>

    <view class="restore-candidate__summary">
      <view class="restore-candidate__summary-item">
        <text>顾客</text>
        <text>{{ props.candidate.summary.customerCount }}</text>
      </view>
      <view class="restore-candidate__summary-item">
        <text>项目</text>
        <text>{{ props.candidate.summary.projectCount }}</text>
      </view>
      <view class="restore-candidate__summary-item">
        <text>库存物品</text>
        <text>{{ props.candidate.summary.inventoryItemCount }}</text>
      </view>
      <view class="restore-candidate__summary-item">
        <text>预约</text>
        <text>{{ props.candidate.summary.appointmentCount }}</text>
      </view>
      <view class="restore-candidate__summary-item">
        <text>库存变动</text>
        <text>{{ props.candidate.summary.inventoryMovementCount }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.restore-candidate {
  margin-top: 26rpx;
  padding: 24rpx;
  border: 2rpx solid rgba(61, 74, 93, 0.1);
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.24);
}

.restore-candidate__topline {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.restore-candidate__icon {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  background: rgba(61, 74, 93, 0.09);
  line-height: 0;
}

.restore-candidate__identity {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.restore-candidate__name {
  overflow: hidden;
  color: #30322d;
  font-size: 24rpx;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.restore-candidate__size {
  margin-top: 7rpx;
  color: #7b7d77;
  font-size: 21rpx;
}

.restore-candidate__metadata,
.restore-candidate__summary {
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 2rpx solid rgba(92, 88, 80, 0.1);
}

.restore-candidate__row,
.restore-candidate__summary-item {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  color: #696c66;
  font-size: 22rpx;
}

.restore-candidate__row + .restore-candidate__row {
  margin-top: 12rpx;
}

.restore-candidate__row text:last-child {
  color: #3f433d;
  text-align: right;
  overflow-wrap: anywhere;
}

.restore-candidate__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx 28rpx;
}
</style>
