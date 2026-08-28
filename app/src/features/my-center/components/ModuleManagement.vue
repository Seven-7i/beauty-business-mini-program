<script setup lang="ts">
import type { BusinessModuleId } from "@/domain/business-module";
import ModuleAuthorizationForm from "@/features/my-center/components/ModuleAuthorizationForm.vue";
import UnlockedModulesCard from "@/features/my-center/components/UnlockedModulesCard.vue";
import RecoverableErrorNotice from "@/features/shared/components/RecoverableErrorNotice.vue";

const props = defineProps<{
  unlockedModules: readonly BusinessModuleId[];
  loading: boolean;
  hasLoaded: boolean;
  readError: string;
  submitting: boolean;
  errorMessage: string;
}>();

const moduleCode = defineModel<string>({ required: true });

const emit = defineEmits<{
  (event: "retry"): void;
  (event: "submit"): void;
}>();
</script>

<template>
  <view class="module-management">
    <view class="module-management__atmosphere module-management__atmosphere--rose" aria-hidden="true" />
    <view class="module-management__atmosphere module-management__atmosphere--sand" aria-hidden="true" />
    <view class="module-management__atmosphere module-management__atmosphere--slate" aria-hidden="true" />

    <view class="module-management__content">
      <view class="module-management__intro">
        <text class="module-management__eyebrow">本机授权</text>
        <text class="module-management__title">管理业务模块</text>
        <text class="module-management__description">模块仅在当前设备开启</text>
      </view>

      <view class="module-management__section">
        <view class="module-management__section-heading">
          <view class="module-management__section-mark" aria-hidden="true" />
          <text class="module-management__section-title">已解锁模块</text>
        </view>

        <RecoverableErrorNotice
          v-if="props.readError"
          :message="props.readError"
          retryable
          :retrying="props.loading"
          @retry="emit('retry')"
        />
        <UnlockedModulesCard
          v-if="!props.readError || props.hasLoaded"
          :unlocked-modules="props.unlockedModules"
          :loading="props.loading"
        />
      </view>

      <view class="module-management__section module-management__section--add">
        <view class="module-management__section-heading">
          <view class="module-management__section-mark" aria-hidden="true" />
          <text class="module-management__section-title">添加模块</text>
        </view>

        <ModuleAuthorizationForm
          v-model="moduleCode"
          :submitting="props.submitting"
          :error-message="props.errorMessage"
          @submit="emit('submit')"
        />
      </view>
    </view>
  </view>
</template>

<style scoped>
.module-management {
  position: relative;
  min-height: calc(100vh - 88rpx);
  overflow: hidden;
  background: #f3f1ec;
  color: #242620;
}

.module-management__atmosphere {
  position: absolute;
  border-radius: 50%;
  filter: blur(96rpx);
  pointer-events: none;
}

.module-management__atmosphere--rose {
  top: 70rpx;
  left: -220rpx;
  width: 520rpx;
  height: 520rpx;
  background: rgba(183, 131, 140, 0.22);
}

.module-management__atmosphere--sand {
  top: 820rpx;
  right: -230rpx;
  width: 570rpx;
  height: 570rpx;
  background: rgba(188, 158, 121, 0.24);
}

.module-management__atmosphere--slate {
  bottom: -120rpx;
  left: 40rpx;
  width: 430rpx;
  height: 430rpx;
  background: rgba(61, 74, 93, 0.08);
}

.module-management__content {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  padding: 54rpx 46rpx calc(64rpx + env(safe-area-inset-bottom));
}

.module-management__intro {
  display: flex;
  flex-direction: column;
}

.module-management__eyebrow {
  color: #696c67;
  font-size: 25rpx;
  font-weight: 500;
  letter-spacing: 3rpx;
}

.module-management__title {
  margin-top: 24rpx;
  color: #242620;
  font-size: 54rpx;
  font-weight: 660;
  letter-spacing: -2rpx;
  line-height: 1.14;
}

.module-management__description {
  margin-top: 20rpx;
  color: #6f716c;
  font-size: 24rpx;
  line-height: 1.55;
}

.module-management__section {
  margin-top: 58rpx;
}

.module-management__section--add {
  margin-top: 46rpx;
}

.module-management__section-heading {
  display: flex;
  min-height: 62rpx;
  align-items: center;
  gap: 16rpx;
}

.module-management__section-mark {
  width: 7rpx;
  height: 28rpx;
  border-radius: 4rpx;
  background: #bca47f;
}

.module-management__section-title {
  color: #242620;
  font-size: 30rpx;
  font-weight: 650;
  line-height: 1.25;
}

@media (max-width: 360px) {
  .module-management__content {
    padding-right: 34rpx;
    padding-left: 34rpx;
  }

  .module-management__title {
    font-size: 49rpx;
  }

  .module-management__section {
    margin-top: 48rpx;
  }
}
</style>
