<script setup lang="ts">
import AppIcon from "@/features/shared/components/AppIcon.vue";
import ModuleCodeInput from "@/features/shared/components/ModuleCodeInput.vue";

const props = defineProps<{
  submitting: boolean;
  errorMessage: string;
}>();

const moduleCode = defineModel<string>({ required: true });

const emit = defineEmits<{
  (event: "submit"): void;
}>();
</script>

<template>
  <view class="authorization-form">
    <view class="authorization-form__panel">
      <text class="authorization-form__label">输入 6 位模块授权码</text>
      <view class="authorization-form__input">
        <ModuleCodeInput
          v-model="moduleCode"
          :maxlength="6"
          :disabled="props.submitting"
          aria-label="请输入六位模块授权码"
        />
      </view>
      <text v-if="props.errorMessage" class="authorization-form__error" role="alert">
        {{ props.errorMessage }}
      </text>
      <button
        class="authorization-form__submit"
        :loading="props.submitting"
        :disabled="props.submitting || moduleCode.length !== 6"
        hover-class="authorization-form__submit--pressed"
        @click="emit('submit')"
      >
        {{ props.submitting ? "正在开启" : "开启模块" }}
      </button>
    </view>

    <view class="authorization-form__notice">
      <view class="authorization-form__notice-icon">
        <AppIcon name="shield" :size="24" color="#6D685B" />
      </view>
      <text class="authorization-form__notice-copy">
        第一版只允许增加模块，不提供移除入口
      </text>
    </view>
  </view>
</template>

<style scoped>
.authorization-form {
  margin-top: 10rpx;
}

.authorization-form__panel {
  padding: 38rpx 36rpx 36rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.82);
  border-radius: 34rpx;
  background: rgba(251, 250, 247, 0.6);
  box-shadow:
    0 26rpx 58rpx rgba(75, 63, 51, 0.12),
    inset 0 2rpx 0 rgba(255, 255, 255, 0.9);
  -webkit-backdrop-filter: blur(32rpx) saturate(1.14);
  backdrop-filter: blur(32rpx) saturate(1.14);
}

.authorization-form__label {
  display: block;
  color: #5f625d;
  font-size: 24rpx;
  line-height: 1.45;
}

.authorization-form__input {
  display: flex;
  justify-content: center;
  margin-top: 28rpx;
}

.authorization-form__error {
  display: block;
  margin-top: 16rpx;
  color: #98443f;
  font-size: 22rpx;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.authorization-form__submit {
  display: flex;
  width: 100%;
  min-height: 94rpx;
  align-items: center;
  justify-content: center;
  margin-top: 32rpx;
  border-radius: 18rpx;
  background: #3d4a5d;
  box-shadow: 0 16rpx 30rpx rgba(61, 74, 93, 0.16);
  color: #f9f7f2;
  font-size: 28rpx;
  font-weight: 620;
  line-height: 1.2;
  transition: opacity 160ms ease, transform 160ms ease;
}

.authorization-form__submit--pressed {
  opacity: 0.82;
  transform: scale(0.99);
}

.authorization-form__submit[disabled] {
  background: #9da3aa;
  box-shadow: none;
  color: rgba(255, 255, 255, 0.88);
}

.authorization-form__notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  margin-top: 34rpx;
  padding: 0 10rpx;
}

.authorization-form__notice-icon {
  display: flex;
  width: 50rpx;
  height: 50rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.authorization-form__notice-copy {
  color: #74736d;
  font-size: 21rpx;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

@media (max-width: 360px) {
  .authorization-form__panel {
    padding-right: 26rpx;
    padding-left: 26rpx;
  }

  .authorization-form__notice {
    align-items: flex-start;
  }
}
</style>
