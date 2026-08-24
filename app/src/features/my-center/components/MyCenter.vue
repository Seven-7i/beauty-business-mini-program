<script setup lang="ts">
import type { MyCenterOverview } from "@/services/my-center-service";
import { formatLocalDateTime } from "@/utils/date-time-display";
import StorageCapacityCard from "@/features/storage-capacity/components/StorageCapacityCard.vue";

const props = defineProps<{
  overview?: Readonly<MyCenterOverview>;
  loading: boolean;
  errorMessage: string;
}>();

defineEmits<{
  (event: "backup-restore"): void;
  (event: "manage-modules"): void;
  (event: "usage-guide"): void;
  (event: "cleanup-history"): void;
}>();
</script>

<template>
  <view class="my-center">
    <view class="my-center__heading">
      <text class="my-center__eyebrow">本机设置</text>
      <text class="my-center__title">我的</text>
      <text class="my-center__description">无需账号，设置和经营数据仅保存在当前设备。</text>
    </view>

    <StorageCapacityCard
      :capacity="overview?.storageCapacity"
      :loading="loading"
      @backup="$emit('backup-restore')"
      @cleanup="$emit('cleanup-history')"
    />
    <text v-if="errorMessage" class="my-center__error">{{ errorMessage }}</text>

    <view class="my-center__menu">
      <button class="my-center__row" :disabled="loading" @click="$emit('backup-restore')">
        <view>
          <text class="my-center__row-title">数据备份与恢复</text>
          <text class="my-center__row-meta">
            最近导出：{{ formatLocalDateTime(overview?.lastExportedAt) }}
          </text>
        </view>
        <text class="my-center__arrow">›</text>
      </button>
      <button class="my-center__row" :disabled="loading" @click="$emit('manage-modules')">
        <view>
          <text class="my-center__row-title">模块管理</text>
          <text class="my-center__row-meta">
            已解锁 {{ overview?.unlockedModules.length ?? 0 }} 个模块
          </text>
        </view>
        <text class="my-center__arrow">›</text>
      </button>
      <button class="my-center__row" @click="$emit('usage-guide')">
        <view>
          <text class="my-center__row-title">使用说明</text>
          <text class="my-center__row-meta">本地数据、备份与安全提示</text>
        </view>
        <text class="my-center__arrow">›</text>
      </button>
    </view>
  </view>
</template>

<style scoped>
.my-center {
  min-height: calc(100vh - 190rpx);
  box-sizing: border-box;
  padding: 48rpx 30rpx 150rpx;
}

.my-center__heading {
  display: flex;
  flex-direction: column;
  padding: 0 12rpx;
}

.my-center__eyebrow { color: #31549e; font-size: 23rpx; font-weight: 600; }
.my-center__title { margin-top: 14rpx; color: #172033; font-size: 43rpx; font-weight: 700; }
.my-center__description { margin-top: 12rpx; color: #737c8c; font-size: 24rpx; line-height: 1.6; }

.my-center__row-title,
.my-center__row-meta { display: block; }
.my-center__error { display: block; margin-top: 16rpx; color: #a93c3c; font-size: 22rpx; }

.my-center__menu {
  margin-top: 28rpx;
  overflow: hidden;
  border: 2rpx solid #dde2e9;
  border-radius: 22rpx;
  background: #ffffff;
}

.my-center__row {
  display: flex;
  width: 100%;
  min-height: 112rpx;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 28rpx;
  background: #ffffff;
  text-align: left;
}

.my-center__row + .my-center__row { border-top: 2rpx solid #edf0f4; }
.my-center__row-title { color: #283247; font-size: 26rpx; font-weight: 600; }
.my-center__row-meta { margin-top: 7rpx; color: #848b98; font-size: 21rpx; }
.my-center__arrow { color: #737d8d; font-size: 48rpx; font-weight: 300; }
</style>
