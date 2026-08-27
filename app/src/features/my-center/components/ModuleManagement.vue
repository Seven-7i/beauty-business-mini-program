<script setup lang="ts">
import type { BusinessModuleId } from "@/domain/business-module";
import ModuleCodeInput from "@/features/shared/components/ModuleCodeInput.vue";

defineProps<{
  unlockedModules: readonly BusinessModuleId[];
  submitting: boolean;
  errorMessage: string;
}>();

const moduleCode = defineModel<string>({ required: true });

defineEmits<{
  (event: "back"): void;
  (event: "submit"): void;
}>();
</script>

<template>
  <view class="module-management">
    <button class="module-management__back" @click="$emit('back')">‹ 返回我的</button>
    <text class="module-management__eyebrow">本机授权</text>
    <text class="module-management__title">模块管理</text>

    <view class="module-management__module">
      <view class="module-management__icon">
        <view v-for="index in 4" :key="index" />
      </view>
      <view>
        <text class="module-management__name">美容</text>
        <text class="module-management__status">
          {{ unlockedModules.includes("beauty") ? "已解锁" : "未解锁" }}
        </text>
      </view>
    </view>

    <view class="module-management__add">
      <text class="module-management__add-title">添加模块</text>
      <text class="module-management__add-copy">输入 6 位模块授权码。第一版只允许增加，不提供移除入口。</text>
      <view class="module-management__input">
        <ModuleCodeInput
          v-model="moduleCode"
          :maxlength="6"
          :disabled="submitting"
          aria-label="请输入六位模块授权码"
        />
      </view>
      <text v-if="errorMessage" class="module-management__error">{{ errorMessage }}</text>
      <button
        class="module-management__submit"
        :loading="submitting"
        :disabled="submitting || moduleCode.length !== 6"
        @click="$emit('submit')"
      >
        开启模块
      </button>
    </view>
  </view>
</template>

<style scoped>
.module-management { min-height: 100vh; box-sizing: border-box; padding: 38rpx 30rpx 70rpx; }
.module-management__back { width: auto; background: transparent; color: #31549e; font-size: 24rpx; }
.module-management__eyebrow, .module-management__title, .module-management__name, .module-management__status, .module-management__add-title, .module-management__add-copy, .module-management__error { display: block; }
.module-management__eyebrow { margin-top: 34rpx; color: #31549e; font-size: 23rpx; font-weight: 600; }
.module-management__title { margin-top: 12rpx; color: #172033; font-size: 43rpx; font-weight: 700; }
.module-management__module { display: flex; align-items: center; gap: 22rpx; margin-top: 34rpx; padding: 28rpx; border: 2rpx solid #dce1e9; border-radius: 20rpx; background: #ffffff; }
.module-management__icon { display: grid; width: 72rpx; height: 72rpx; grid-template-columns: 1fr 1fr; gap: 7rpx; padding: 15rpx; box-sizing: border-box; border-radius: 17rpx; background: #3159b5; }
.module-management__icon view { border-radius: 4rpx; background: #ffffff; }
.module-management__name { color: #202a3b; font-size: 29rpx; font-weight: 650; }
.module-management__status { margin-top: 6rpx; color: #287461; font-size: 22rpx; }
.module-management__add { margin-top: 28rpx; padding: 30rpx; border: 2rpx solid #dce1e9; border-radius: 20rpx; background: #ffffff; }
.module-management__add-title { color: #202a3b; font-size: 29rpx; font-weight: 650; }
.module-management__add-copy { margin-top: 10rpx; color: #747d8c; font-size: 22rpx; line-height: 1.55; }
.module-management__input { display: flex; justify-content: center; margin-top: 28rpx; }
.module-management__error { margin-top: 14rpx; color: #b43d3d; font-size: 23rpx; }
.module-management__submit { height: 92rpx; margin-top: 26rpx; border-radius: 16rpx; background: #3159b5; color: #ffffff; font-size: 28rpx; font-weight: 600; }
.module-management__submit[disabled] { background: #aebbd7; }
</style>
