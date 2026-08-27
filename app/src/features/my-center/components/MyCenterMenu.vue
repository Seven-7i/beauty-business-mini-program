<script setup lang="ts">
import AppIcon from "@/features/shared/components/AppIcon.vue";
import { formatLocalDateTime } from "@/utils/date-time-display";

const props = defineProps<{
  lastExportedAt?: string;
  unlockedModuleCount: number;
  loading: boolean;
}>();

const emit = defineEmits<{
  (event: "backup-restore"): void;
  (event: "manage-modules"): void;
  (event: "usage-guide"): void;
}>();
</script>

<template>
  <view class="my-menu">
    <view class="my-menu__heading">
      <view class="my-menu__mark" />
      <text class="my-menu__title">数据与管理</text>
    </view>

    <view class="my-menu__panel">
      <button
        class="my-menu__row"
        :disabled="props.loading"
        hover-class="my-menu__row--pressed"
        @click="emit('backup-restore')"
      >
        <view class="my-menu__icon my-menu__icon--backup">
          <AppIcon name="backup" :size="23" color="#76565C" />
        </view>
        <view class="my-menu__copy">
          <text class="my-menu__row-title">数据备份与恢复</text>
          <text class="my-menu__row-meta">
            最近导出：{{ formatLocalDateTime(props.lastExportedAt) }}
          </text>
        </view>
        <AppIcon name="chevron-right" :size="20" color="#777973" />
      </button>

      <view class="my-menu__divider" />

      <button
        class="my-menu__row"
        :disabled="props.loading"
        hover-class="my-menu__row--pressed"
        @click="emit('manage-modules')"
      >
        <view class="my-menu__icon my-menu__icon--modules">
          <AppIcon name="modules" :size="23" color="#3D4A5D" />
        </view>
        <view class="my-menu__copy">
          <text class="my-menu__row-title">模块管理</text>
          <text class="my-menu__row-meta">已解锁 {{ props.unlockedModuleCount }} 个模块</text>
        </view>
        <AppIcon name="chevron-right" :size="20" color="#777973" />
      </button>

      <view class="my-menu__divider" />

      <button
        class="my-menu__row"
        hover-class="my-menu__row--pressed"
        @click="emit('usage-guide')"
      >
        <view class="my-menu__icon my-menu__icon--guide">
          <AppIcon name="info" :size="23" color="#6D685B" />
        </view>
        <view class="my-menu__copy">
          <text class="my-menu__row-title">使用说明</text>
          <text class="my-menu__row-meta">本地数据与安全提示</text>
        </view>
        <AppIcon name="chevron-right" :size="20" color="#777973" />
      </button>
    </view>
  </view>
</template>

<style scoped>
.my-menu {
  margin-top: 42rpx;
}

.my-menu__heading {
  display: flex;
  min-height: 68rpx;
  align-items: center;
  gap: 16rpx;
}

.my-menu__mark {
  width: 7rpx;
  height: 28rpx;
  border-radius: 4rpx;
  background: #bca47f;
}

.my-menu__title {
  color: #242620;
  font-size: 29rpx;
  font-weight: 650;
}

.my-menu__panel {
  margin-top: 8rpx;
  overflow: hidden;
  border: 2rpx solid rgba(255, 255, 255, 0.78);
  border-radius: 32rpx;
  background: rgba(251, 250, 247, 0.58);
  box-shadow:
    0 24rpx 52rpx rgba(75, 63, 51, 0.12),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.86);
  -webkit-backdrop-filter: blur(30rpx) saturate(1.14);
  backdrop-filter: blur(30rpx) saturate(1.14);
}

.my-menu__row {
  display: flex;
  width: 100%;
  min-height: 126rpx;
  box-sizing: border-box;
  align-items: center;
  gap: 22rpx;
  padding: 24rpx 28rpx;
  background: transparent;
  color: #242620;
  text-align: left;
  transition: opacity 160ms ease, transform 160ms ease;
}

.my-menu__row--pressed {
  opacity: 0.7;
  transform: scale(0.99);
}

.my-menu__row[disabled] {
  opacity: 0.58;
}

.my-menu__icon {
  display: flex;
  width: 62rpx;
  height: 62rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 2rpx solid rgba(255, 255, 255, 0.64);
  border-radius: 18rpx;
  box-shadow: inset 0 2rpx 0 rgba(255, 255, 255, 0.5);
  line-height: 0;
}

.my-menu__icon--backup {
  background: rgba(183, 131, 140, 0.14);
}

.my-menu__icon--modules {
  background: rgba(61, 74, 93, 0.1);
}

.my-menu__icon--guide {
  background: rgba(188, 164, 127, 0.16);
}

.my-menu__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.my-menu__row-title,
.my-menu__row-meta {
  display: block;
  overflow-wrap: anywhere;
}

.my-menu__row-title {
  color: #30312c;
  font-size: 26rpx;
  font-weight: 620;
  line-height: 1.3;
}

.my-menu__row-meta {
  margin-top: 8rpx;
  color: #7d7e78;
  font-size: 21rpx;
  line-height: 1.45;
}

.my-menu__divider {
  height: 2rpx;
  margin-left: 112rpx;
  background: rgba(92, 88, 80, 0.1);
}

@media (max-width: 360px) {
  .my-menu__row {
    gap: 18rpx;
    padding-right: 22rpx;
    padding-left: 22rpx;
  }

  .my-menu__icon {
    width: 56rpx;
    height: 56rpx;
  }

  .my-menu__divider {
    margin-left: 96rpx;
  }
}
</style>
