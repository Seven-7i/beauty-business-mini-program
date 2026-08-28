<script setup lang="ts">
import AppIcon from "@/features/shared/components/AppIcon.vue";

const props = defineProps<{
  disabled: boolean;
}>();

const emit = defineEmits<{
  (event: "request", scope: "system" | "beauty"): void;
}>();

function requestExport(scope: "system" | "beauty"): void {
  if (props.disabled) {
    return;
  }
  emit("request", scope);
}
</script>

<template>
  <view class="scope-actions">
    <button
      class="scope-actions__row"
      :disabled="props.disabled"
      hover-class="scope-actions__row--pressed"
      @click="requestExport('system')"
    >
      <view class="scope-actions__icon">
        <AppIcon name="backup" :size="26" color="#3D4A5D" />
      </view>
      <view class="scope-actions__copy">
        <text class="scope-actions__title">完整系统备份</text>
        <text class="scope-actions__meta">设置、模块授权和全部业务数据</text>
      </view>
      <AppIcon name="chevron-right" :size="20" color="#777973" />
    </button>

    <view class="scope-actions__divider" />

    <button
      class="scope-actions__row"
      :disabled="props.disabled"
      hover-class="scope-actions__row--pressed"
      @click="requestExport('beauty')"
    >
      <view class="scope-actions__icon">
        <AppIcon name="modules" :size="25" color="#3D4A5D" />
      </view>
      <view class="scope-actions__copy">
        <text class="scope-actions__title">选择模块导出</text>
        <text class="scope-actions__meta">只导出所选模块的业务数据</text>
      </view>
      <AppIcon name="chevron-right" :size="20" color="#777973" />
    </button>
  </view>
</template>

<style scoped>
.scope-actions {
  overflow: hidden;
  border: 2rpx solid rgba(255, 255, 255, 0.82);
  border-radius: 34rpx;
  background: rgba(251, 250, 247, 0.62);
  box-shadow:
    0 26rpx 58rpx rgba(75, 63, 51, 0.12),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.9);
  -webkit-backdrop-filter: blur(32rpx) saturate(1.14);
  backdrop-filter: blur(32rpx) saturate(1.14);
}

.scope-actions__row {
  display: flex;
  width: 100%;
  min-height: 132rpx;
  box-sizing: border-box;
  align-items: center;
  gap: 22rpx;
  padding: 24rpx 28rpx;
  background: transparent;
  color: #242620;
  text-align: left;
  transition: background 160ms ease, opacity 160ms ease, transform 160ms ease;
}

.scope-actions__row--pressed {
  opacity: 0.72;
  transform: scale(0.99);
}

.scope-actions__row[disabled] {
  opacity: 0.58;
}

.scope-actions__icon {
  display: flex;
  width: 66rpx;
  height: 66rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.scope-actions__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.scope-actions__title,
.scope-actions__meta {
  display: block;
  overflow-wrap: anywhere;
}

.scope-actions__title {
  color: #2f312c;
  font-size: 27rpx;
  font-weight: 630;
  line-height: 1.3;
}

.scope-actions__meta {
  margin-top: 8rpx;
  color: #7a7c76;
  font-size: 21rpx;
  line-height: 1.45;
}

.scope-actions__divider {
  height: 2rpx;
  margin-left: 116rpx;
  background: rgba(92, 88, 80, 0.1);
}

@media (max-width: 360px) {
  .scope-actions__row {
    gap: 18rpx;
    padding-right: 22rpx;
    padding-left: 22rpx;
  }

  .scope-actions__icon {
    width: 58rpx;
    height: 58rpx;
  }

}
</style>
