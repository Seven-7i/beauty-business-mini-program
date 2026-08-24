<script setup lang="ts">
import { onMounted } from "vue";
import type { HistoryCleanupService } from "@/services/history-cleanup-service";
import { formatLocalDateTime } from "@/utils/date-time-display";
import { useHistoryCleanup } from "../composables/useHistoryCleanup";

const props = defineProps<{ service: HistoryCleanupService }>();
const {
  cutoffDate,
  records,
  total,
  loading,
  deletingId,
  deleting,
  hasMore,
  errorMessage,
  refresh,
  loadMore,
  deleteRecord,
} = useHistoryCleanup(props.service);

function selectCutoffDate(event: { detail: { value: string } }): void {
  cutoffDate.value = event.detail.value;
  void refresh();
}

function confirmDelete(record: {
  appointmentId: string;
  status: "completed" | "cancelled";
  expectedUpdatedAt: string;
}): void {
  uni.showModal({
    title: "删除这条预约历史？",
    content:
      record.status === "completed"
        ? "删除后不补回已经实际消耗的库存，相关库存变动记录仍会保留。此操作无法撤销。"
        : "删除后该预约及取消说明无法恢复，不会改变库存。",
    confirmText: "确认删除",
    confirmColor: "#9A4A47",
    success(result) {
      if (!result.confirm) {
        return;
      }
      void deleteRecord(record).then((deleted) => {
        if (deleted) {
          uni.showToast({ title: "预约历史已删除", icon: "success" });
        }
      });
    },
  });
}

onMounted(refresh);
</script>

<template>
  <view class="history-cleanup">
    <view class="history-cleanup__intro">
      <text class="history-cleanup__eyebrow">本机存储 · 手动清理</text>
      <text class="history-cleanup__title">预约历史</text>
      <text class="history-cleanup__description">
        这里只显示已完成和已取消预约。请先导出完整备份，再逐条确认删除；系统不会自动清理。
      </text>
    </view>

    <view class="history-cleanup__filter">
      <text class="history-cleanup__label">显示此日期及以前的记录</text>
      <picker
        mode="date"
        :value="cutoffDate"
        :disabled="loading || deleting"
        @change="selectCutoffDate"
      >
        <view
          class="history-cleanup__date"
          role="button"
          aria-label="选择预约历史截止日期"
        >
          <text>{{ cutoffDate }}</text>
          <text class="history-cleanup__date-arrow">›</text>
        </view>
      </picker>
      <button
        class="history-cleanup__refresh"
        :disabled="loading || deleting"
        @click="refresh"
      >
        {{ loading ? "正在读取" : "按日期筛选" }}
      </button>
    </view>

    <view v-if="errorMessage" class="history-cleanup__error" role="alert">
      {{ errorMessage }}
    </view>
    <view v-else-if="loading" class="history-cleanup__empty">
      正在读取本机预约历史
    </view>
    <view v-else-if="!records.length" class="history-cleanup__empty">
      此日期范围内没有可清理的预约历史。
    </view>
    <view v-else class="history-cleanup__list">
      <text class="history-cleanup__count">共 {{ total }} 条，当前显示 {{ records.length }} 条</text>
      <view
        v-for="record in records"
        :key="record.appointmentId"
        class="history-record"
      >
        <view class="history-record__heading">
          <view class="history-record__identity">
            <text class="history-record__customer">{{ record.customerNickname }}</text>
            <text class="history-record__status">
              {{ record.status === "completed" ? "已完成" : "已取消" }}
            </text>
          </view>
          <text class="history-record__time">{{ formatLocalDateTime(record.occurredAt) }}</text>
        </view>
        <text class="history-record__projects">
          {{ record.projectNames.join("、") }}
        </text>
        <text class="history-record__address">
          {{ record.addressText }}
        </text>
        <button
          class="history-record__delete"
          :disabled="deleting"
          @click="confirmDelete(record)"
        >
          {{ deletingId === record.appointmentId ? "正在删除" : "删除这条历史" }}
        </button>
      </view>
      <button
        v-if="hasMore"
        class="history-cleanup__more"
        :disabled="loading || deleting"
        @click="loadMore"
      >
        {{ loading ? "正在读取" : "再显示 20 条" }}
      </button>
    </view>
  </view>
</template>

<style scoped>
.history-cleanup {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 38rpx 28rpx calc(56rpx + env(safe-area-inset-bottom));
  background: #f8f9fb;
}

.history-cleanup__intro {
  display: flex;
  padding: 0 6rpx;
  flex-direction: column;
}

.history-cleanup__eyebrow {
  color: #31549e;
  font-size: 22rpx;
  font-weight: 600;
}

.history-cleanup__title {
  margin-top: 12rpx;
  color: #1a2538;
  font-size: 42rpx;
  font-weight: 700;
}

.history-cleanup__description {
  margin-top: 12rpx;
  color: #6e798d;
  font-size: 23rpx;
  line-height: 1.65;
}

.history-cleanup__filter {
  margin-top: 28rpx;
  padding: 24rpx;
  border: 2rpx solid #dde3eb;
  border-radius: 18rpx;
  background: #ffffff;
}

.history-cleanup__label,
.history-cleanup__count,
.history-record__customer,
.history-record__projects,
.history-record__address {
  display: block;
}

.history-cleanup__label {
  color: #39465b;
  font-size: 23rpx;
  font-weight: 600;
}

.history-cleanup__date {
  display: flex;
  height: 78rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
  padding: 0 20rpx;
  border: 2rpx solid #ccd5e1;
  border-radius: 12rpx;
  color: #263248;
  font-size: 25rpx;
}

.history-cleanup__date-arrow {
  color: #738095;
  font-size: 38rpx;
}

.history-cleanup__refresh {
  height: 76rpx;
  margin-top: 16rpx;
  border-radius: 12rpx;
  background: #3159b5;
  color: #ffffff;
  font-size: 23rpx;
  line-height: 76rpx;
}

.history-cleanup__error,
.history-cleanup__empty {
  margin-top: 22rpx;
  padding: 24rpx;
  border-radius: 14rpx;
  font-size: 22rpx;
  line-height: 1.55;
  text-align: center;
}

.history-cleanup__error {
  border: 2rpx solid #e0b3b0;
  background: #fff5f4;
  color: #92433f;
}

.history-cleanup__empty {
  border: 2rpx dashed #d5dce5;
  color: #748094;
}

.history-cleanup__list {
  margin-top: 24rpx;
}

.history-cleanup__count {
  padding: 0 6rpx 4rpx;
  color: #687489;
  font-size: 21rpx;
}

.history-record {
  margin-top: 14rpx;
  padding: 24rpx;
  border: 2rpx solid #dee4eb;
  border-radius: 17rpx;
  background: #ffffff;
}

.history-record__heading,
.history-record__identity {
  display: flex;
  align-items: center;
}

.history-record__heading {
  justify-content: space-between;
  gap: 16rpx;
}

.history-record__identity {
  min-width: 0;
  gap: 10rpx;
}

.history-record__customer {
  color: #263248;
  font-size: 26rpx;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.history-record__status {
  flex: none;
  padding: 5rpx 9rpx;
  border-radius: 8rpx;
  background: #e9edf2;
  color: #657083;
  font-size: 18rpx;
}

.history-record__time {
  flex: none;
  color: #52617a;
  font-size: 20rpx;
}

.history-record__projects,
.history-record__address {
  margin-top: 12rpx;
  color: #566278;
  font-size: 22rpx;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.history-record__address {
  color: #7a8495;
}

.history-record__delete {
  height: 70rpx;
  margin-top: 18rpx;
  border: 2rpx solid #dfc0bd;
  border-radius: 11rpx;
  background: #ffffff;
  color: #984742;
  font-size: 21rpx;
  line-height: 66rpx;
}

.history-cleanup__more {
  height: 76rpx;
  margin-top: 18rpx;
  border: 2rpx solid #ccd5e1;
  border-radius: 12rpx;
  background: #ffffff;
  color: #3d4c65;
  font-size: 22rpx;
  line-height: 72rpx;
}
</style>
