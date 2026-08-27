<script setup lang="ts">
import MyCenterMenu from "@/features/my-center/components/MyCenterMenu.vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";
import StorageCapacityCard from "@/features/storage-capacity/components/StorageCapacityCard.vue";
import type { MyCenterOverview } from "@/services/my-center-service";

const props = defineProps<{
  overview?: Readonly<MyCenterOverview>;
  loading: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{
  (event: "backup-restore"): void;
  (event: "manage-modules"): void;
  (event: "usage-guide"): void;
  (event: "cleanup-history"): void;
  (event: "retry"): void;
}>();
</script>

<template>
  <view class="my-center">
    <view class="my-center__atmosphere my-center__atmosphere--rose" aria-hidden="true" />
    <view class="my-center__atmosphere my-center__atmosphere--sand" aria-hidden="true" />
    <view class="my-center__atmosphere my-center__atmosphere--slate" aria-hidden="true" />

    <view class="my-center__content">
      <view class="my-center__heading">
        <text class="my-center__eyebrow">本机空间</text>
        <text class="my-center__title">我的</text>
        <text class="my-center__description">设置与经营数据，仅保存在当前设备</text>

        <view class="my-center__orbit" aria-hidden="true">
          <view class="my-center__orbit-ring my-center__orbit-ring--outer" />
          <view class="my-center__orbit-ring my-center__orbit-ring--inner" />
          <view class="my-center__orbit-core" />
        </view>
      </view>

      <StorageCapacityCard
        :capacity="props.overview?.storageCapacity"
        :loading="props.loading"
        @backup="emit('backup-restore')"
        @cleanup="emit('cleanup-history')"
      />

      <RecoverableErrorNotice
        v-if="props.errorMessage"
        :message="props.errorMessage"
        retryable
        :retrying="props.loading"
        @retry="emit('retry')"
      />

      <MyCenterMenu
        :last-exported-at="props.overview?.lastExportedAt"
        :unlocked-module-count="props.overview?.unlockedModules.length ?? 0"
        :loading="props.loading"
        @backup-restore="emit('backup-restore')"
        @manage-modules="emit('manage-modules')"
        @usage-guide="emit('usage-guide')"
      />
    </view>
  </view>
</template>

<style scoped>
.my-center {
  position: relative;
  min-height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  background: #f3f1ec;
  color: #242620;
}

.my-center__atmosphere {
  position: absolute;
  border-radius: 50%;
  filter: blur(92rpx);
  pointer-events: none;
}

.my-center__atmosphere--rose {
  top: 170rpx;
  right: -180rpx;
  width: 430rpx;
  height: 430rpx;
  background: rgba(183, 131, 140, 0.22);
}

.my-center__atmosphere--sand {
  bottom: 170rpx;
  left: -190rpx;
  width: 520rpx;
  height: 520rpx;
  background: rgba(188, 158, 121, 0.26);
}

.my-center__atmosphere--slate {
  top: 670rpx;
  right: 80rpx;
  width: 350rpx;
  height: 350rpx;
  background: rgba(61, 74, 93, 0.1);
}

.my-center__content {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  padding: 64rpx 46rpx calc(190rpx + env(safe-area-inset-bottom));
}

.my-center__heading {
  position: relative;
  display: flex;
  min-height: 224rpx;
  flex-direction: column;
}

.my-center__eyebrow {
  color: #696c67;
  font-size: 25rpx;
  font-weight: 500;
  letter-spacing: 3rpx;
}

.my-center__title {
  margin-top: 24rpx;
  color: #242620;
  font-size: 62rpx;
  font-weight: 650;
  letter-spacing: -2rpx;
  line-height: 1.12;
}

.my-center__description {
  max-width: 500rpx;
  margin-top: 22rpx;
  color: #6f716c;
  font-size: 24rpx;
  line-height: 1.55;
}

.my-center__orbit {
  position: absolute;
  top: 2rpx;
  right: 4rpx;
  width: 152rpx;
  height: 152rpx;
  opacity: 0.66;
}

.my-center__orbit-ring,
.my-center__orbit-core {
  position: absolute;
  top: 50%;
  left: 50%;
  box-sizing: border-box;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.my-center__orbit-ring {
  border: 2rpx solid rgba(61, 74, 93, 0.22);
}

.my-center__orbit-ring--outer {
  width: 100%;
  height: 100%;
}

.my-center__orbit-ring--inner {
  width: 64%;
  height: 64%;
  border-style: dashed;
}

.my-center__orbit-core {
  width: 22%;
  height: 22%;
  border: 2rpx solid rgba(255, 255, 255, 0.66);
  background: rgba(188, 164, 127, 0.6);
  box-shadow: 0 10rpx 20rpx rgba(112, 91, 65, 0.16);
}

@media (max-width: 360px) {
  .my-center__content {
    padding-right: 36rpx;
    padding-left: 36rpx;
  }

  .my-center__heading {
    min-height: 210rpx;
  }

  .my-center__title {
    font-size: 58rpx;
  }

  .my-center__orbit {
    right: -18rpx;
    width: 130rpx;
    height: 130rpx;
    opacity: 0.5;
  }
}
</style>
