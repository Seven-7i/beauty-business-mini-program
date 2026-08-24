<script setup lang="ts">
import UpCodeInput from "uview-plus/components/u-code-input/u-code-input.vue";

const props = defineProps<{
  submitting: boolean;
  errorMessage: string;
}>();

const moduleCode = defineModel<string>({ required: true });

const emit = defineEmits<{
  (event: "submit"): void;
  (event: "restore"): void;
}>();
</script>

<template>
  <view class="activation-form">
    <view class="activation-form__heading">
      <text class="activation-form__eyebrow">欢迎使用</text>
      <text class="activation-form__title">输入模块码，开启工作台</text>
      <text class="activation-form__description">
        模块开启后，数据会安全地保存在你的手机里。
      </text>
    </view>

    <view class="activation-form__field">
      <text class="activation-form__label">模块码</text>
      <view class="activation-form__code-input">
        <UpCodeInput
          v-model="moduleCode"
          :maxlength="6"
          :size="44"
          :space="8"
          :font-size="22"
          mode="box"
          bold
          color="#172033"
          border-color="#9aa7bd"
        />
      </view>
      <text v-if="props.errorMessage" class="activation-form__error">
        {{ props.errorMessage }}
      </text>
    </view>

    <button
      class="activation-form__submit"
      :loading="props.submitting"
      :disabled="props.submitting || moduleCode.length !== 6"
      @click="emit('submit')"
    >
      解锁模块
    </button>

    <button class="activation-form__restore" @click="emit('restore')">
      从备份恢复
    </button>

    <view class="activation-form__privacy">
      <view class="activation-form__lock">
        <view class="activation-form__lock-loop" />
        <view class="activation-form__lock-body" />
      </view>
      <text>无需登录，你的数据只保存在本机</text>
    </view>
  </view>
</template>

<style scoped>
.activation-form {
  display: flex;
  min-height: calc(100vh - 88rpx);
  box-sizing: border-box;
  flex-direction: column;
  padding: 78rpx 48rpx calc(44rpx + env(safe-area-inset-bottom));
}

.activation-form__heading {
  display: flex;
  flex-direction: column;
}

.activation-form__eyebrow {
  color: #173a70;
  font-size: 28rpx;
  font-weight: 600;
  letter-spacing: 2rpx;
}

.activation-form__title {
  margin-top: 34rpx;
  color: #111827;
  font-size: 48rpx;
  font-weight: 700;
  line-height: 1.34;
}

.activation-form__description {
  margin-top: 20rpx;
  color: #687183;
  font-size: 27rpx;
  line-height: 1.7;
}

.activation-form__field {
  margin-top: 76rpx;
}

.activation-form__label {
  display: block;
  margin-bottom: 18rpx;
  color: #596273;
  font-size: 27rpx;
}

.activation-form__code-input {
  display: flex;
  width: 100%;
  justify-content: center;
}

.activation-form__error {
  display: block;
  margin-top: 14rpx;
  color: #c43d3d;
  font-size: 25rpx;
}

.activation-form__submit,
.activation-form__restore {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 104rpx;
  border-radius: 18rpx;
  font-size: 31rpx;
  font-weight: 600;
}

.activation-form__submit {
  margin-top: 38rpx;
  background: linear-gradient(135deg, #3562c9, #243f9f);
  box-shadow: 0 14rpx 30rpx rgba(37, 64, 159, 0.2);
  color: #ffffff;
}

.activation-form__submit[disabled] {
  background: #aebbd7;
  color: rgba(255, 255, 255, 0.9);
}

.activation-form__restore {
  margin-top: 20rpx;
  border: 2rpx solid #3155ad;
  background: transparent;
  color: #294da8;
}

.activation-form__privacy {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  margin-top: auto;
  padding-top: 72rpx;
  color: #727987;
  font-size: 24rpx;
}

.activation-form__lock {
  position: relative;
  width: 28rpx;
  height: 32rpx;
}

.activation-form__lock-loop {
  position: absolute;
  top: 0;
  left: 6rpx;
  width: 16rpx;
  height: 18rpx;
  box-sizing: border-box;
  border: 3rpx solid #737b87;
  border-bottom: 0;
  border-radius: 10rpx 10rpx 0 0;
}

.activation-form__lock-body {
  position: absolute;
  bottom: 0;
  width: 28rpx;
  height: 20rpx;
  border-radius: 4rpx;
  background: #737b87;
}
</style>
