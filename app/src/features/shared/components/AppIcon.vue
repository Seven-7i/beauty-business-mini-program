<script setup lang="ts">
import { computed } from "vue";

export type AppIconName =
  | "account"
  | "backup"
  | "chevron-right"
  | "file-restore"
  | "home"
  | "history"
  | "info"
  | "modules"
  | "shield"
  | "storage";

const props = withDefaults(
  defineProps<{
    name: AppIconName;
    size?: number;
    color?: string;
  }>(),
  {
    size: 24,
    color: "currentColor",
  },
);

const iconStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  color: props.color,
}));
</script>

<template>
  <view class="app-icon" :style="iconStyle" aria-hidden="true">
    <view v-if="name === 'home'" class="app-icon__canvas app-icon__home">
      <view class="app-icon__roof app-icon__roof--left" />
      <view class="app-icon__roof app-icon__roof--right" />
      <view class="app-icon__home-body">
        <view class="app-icon__door" />
      </view>
    </view>

    <view v-else-if="name === 'account'" class="app-icon__canvas app-icon__account">
      <view class="app-icon__head" />
      <view class="app-icon__shoulders" />
    </view>

    <view v-else-if="name === 'storage'" class="app-icon__canvas app-icon__storage">
      <view class="app-icon__storage-top" />
      <view class="app-icon__storage-line app-icon__storage-line--first" />
      <view class="app-icon__storage-line app-icon__storage-line--second" />
    </view>

    <view v-else-if="name === 'backup'" class="app-icon__canvas app-icon__backup">
      <view class="app-icon__backup-lid" />
      <view class="app-icon__backup-body" />
      <view class="app-icon__backup-slot" />
    </view>

    <view v-else-if="name === 'history'" class="app-icon__canvas app-icon__history">
      <view class="app-icon__history-orbit" />
      <view class="app-icon__history-tail" />
      <view class="app-icon__history-face">
        <view class="app-icon__history-hand app-icon__history-hand--hour" />
        <view class="app-icon__history-hand app-icon__history-hand--minute" />
      </view>
      <view class="app-icon__history-arrow" />
    </view>

    <view v-else-if="name === 'file-restore'" class="app-icon__canvas app-icon__file-restore">
      <view class="app-icon__file-body">
        <view class="app-icon__file-fold" />
      </view>
      <view class="app-icon__restore-arc" />
      <view class="app-icon__restore-arrow" />
    </view>

    <view v-else-if="name === 'shield'" class="app-icon__canvas app-icon__shield">
      <view class="app-icon__shield-edge app-icon__shield-edge--top-left" />
      <view class="app-icon__shield-edge app-icon__shield-edge--top-right" />
      <view class="app-icon__shield-edge app-icon__shield-edge--right" />
      <view class="app-icon__shield-edge app-icon__shield-edge--bottom-right" />
      <view class="app-icon__shield-edge app-icon__shield-edge--bottom-left" />
      <view class="app-icon__shield-edge app-icon__shield-edge--left" />
      <view class="app-icon__shield-mark" />
      <view class="app-icon__shield-dot" />
    </view>

    <view v-else-if="name === 'modules'" class="app-icon__canvas app-icon__modules">
      <view v-for="index in 4" :key="index" class="app-icon__module-tile" />
    </view>

    <view v-else-if="name === 'info'" class="app-icon__canvas app-icon__info">
      <view class="app-icon__info-dot" />
      <view class="app-icon__info-stem" />
    </view>

    <view v-else class="app-icon__canvas app-icon__chevron">
      <view class="app-icon__chevron-shape" />
    </view>
  </view>
</template>

<style scoped>
.app-icon {
  position: relative;
  display: block;
  flex: none;
  color: inherit;
  line-height: 0;
}

.app-icon__canvas {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.app-icon__home,
.app-icon__account,
.app-icon__storage,
.app-icon__backup,
.app-icon__history,
.app-icon__file-restore,
.app-icon__modules,
.app-icon__info {
  width: 100%;
  height: 100%;
}

.app-icon__roof {
  position: absolute;
  top: 28%;
  width: 48%;
  height: 2rpx;
  border-radius: 2rpx;
  background: currentColor;
}

.app-icon__roof--left {
  left: 9%;
  transform: rotate(-42deg);
}

.app-icon__roof--right {
  right: 9%;
  transform: rotate(42deg);
}

.app-icon__home-body {
  position: absolute;
  right: 20%;
  bottom: 8%;
  left: 20%;
  height: 48%;
  box-sizing: border-box;
  border-right: 2rpx solid currentColor;
  border-bottom: 2rpx solid currentColor;
  border-left: 2rpx solid currentColor;
  border-radius: 0 0 5rpx 5rpx;
}

.app-icon__door {
  position: absolute;
  bottom: -2rpx;
  left: 50%;
  width: 28%;
  height: 48%;
  box-sizing: border-box;
  border: 2rpx solid currentColor;
  border-bottom: 0;
  border-radius: 3rpx 3rpx 0 0;
  transform: translateX(-50%);
}

.app-icon__head {
  position: absolute;
  top: 4%;
  left: 50%;
  width: 34%;
  height: 34%;
  box-sizing: border-box;
  border: 2rpx solid currentColor;
  border-radius: 50%;
  transform: translateX(-50%);
}

.app-icon__shoulders {
  position: absolute;
  bottom: 5%;
  left: 50%;
  width: 72%;
  height: 46%;
  box-sizing: border-box;
  border: 2rpx solid currentColor;
  border-bottom: 0;
  border-radius: 50% 50% 0 0;
  transform: translateX(-50%);
}

.app-icon__storage {
  width: 78%;
  height: 80%;
  box-sizing: border-box;
  border-right: 2rpx solid currentColor;
  border-bottom: 2rpx solid currentColor;
  border-left: 2rpx solid currentColor;
  border-radius: 0 0 50% 50% / 0 0 18% 18%;
}

.app-icon__storage-top {
  position: absolute;
  top: -2rpx;
  left: -2rpx;
  width: 100%;
  height: 24%;
  box-sizing: border-box;
  border: 2rpx solid currentColor;
  border-radius: 50%;
}

.app-icon__storage-line {
  position: absolute;
  right: -2rpx;
  left: -2rpx;
  height: 22%;
  box-sizing: border-box;
  border-bottom: 2rpx solid currentColor;
  border-radius: 0 0 50% 50%;
}

.app-icon__storage-line--first {
  top: 27%;
}

.app-icon__storage-line--second {
  top: 56%;
}

.app-icon__backup-lid {
  position: absolute;
  top: 10%;
  right: 8%;
  left: 8%;
  height: 24%;
  box-sizing: border-box;
  border: 2rpx solid currentColor;
  border-radius: 5rpx 5rpx 3rpx 3rpx;
}

.app-icon__backup-body {
  position: absolute;
  top: 31%;
  right: 14%;
  bottom: 8%;
  left: 14%;
  box-sizing: border-box;
  border: 2rpx solid currentColor;
  border-radius: 3rpx 3rpx 7rpx 7rpx;
}

.app-icon__backup-slot {
  position: absolute;
  top: 55%;
  left: 50%;
  width: 25%;
  height: 2rpx;
  border-radius: 2rpx;
  background: currentColor;
  transform: translateX(-50%);
}

.app-icon__history-orbit {
  position: absolute;
  top: 6%;
  left: 6%;
  width: 82%;
  height: 82%;
  box-sizing: border-box;
  border: 2rpx solid currentColor;
  border-bottom-color: transparent;
  border-radius: 50%;
  transform: rotate(-18deg);
}

.app-icon__history-tail {
  position: absolute;
  right: 7%;
  bottom: 4%;
  width: 48%;
  height: 45%;
  box-sizing: border-box;
  border-right: 2rpx dashed currentColor;
  border-bottom: 2rpx dashed currentColor;
  border-radius: 0 0 50% 0;
}

.app-icon__history-face {
  position: absolute;
  top: 24%;
  left: 24%;
  width: 52%;
  height: 52%;
  box-sizing: border-box;
  border: 2rpx solid currentColor;
  border-radius: 50%;
}

.app-icon__history-hand {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 2rpx;
  background: currentColor;
  transform-origin: left center;
}

.app-icon__history-hand--hour {
  width: 27%;
  height: 2rpx;
  transform: rotate(44deg);
}

.app-icon__history-hand--minute {
  width: 2rpx;
  height: 31%;
  transform: translateY(-100%);
}

.app-icon__history-arrow {
  position: absolute;
  top: 42%;
  right: 2%;
  width: 16%;
  height: 16%;
  box-sizing: border-box;
  border-right: 2rpx solid currentColor;
  border-bottom: 2rpx solid currentColor;
  transform: rotate(42deg);
}

.app-icon__file-body {
  position: absolute;
  top: 3%;
  left: 5%;
  width: 62%;
  height: 86%;
  box-sizing: border-box;
  border: 2rpx solid currentColor;
  border-radius: 4rpx 10rpx 7rpx 7rpx;
}

.app-icon__file-fold {
  position: absolute;
  top: -2rpx;
  right: -2rpx;
  width: 28%;
  height: 28%;
  box-sizing: border-box;
  border-bottom: 2rpx solid currentColor;
  border-left: 2rpx solid currentColor;
  border-radius: 0 8rpx 0 4rpx;
}

.app-icon__restore-arc {
  position: absolute;
  right: 0;
  bottom: 1%;
  width: 56%;
  height: 56%;
  box-sizing: border-box;
  border: 2rpx solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  transform: rotate(-18deg);
}

.app-icon__restore-arrow {
  position: absolute;
  right: 42%;
  bottom: 30%;
  width: 17%;
  height: 17%;
  box-sizing: border-box;
  border-bottom: 2rpx solid currentColor;
  border-left: 2rpx solid currentColor;
  transform: rotate(40deg);
}

.app-icon__shield {
  width: 100%;
  height: 100%;
}

.app-icon__shield-edge {
  position: absolute;
  height: 2rpx;
  border-radius: 2rpx;
  background: currentColor;
  transform-origin: left center;
}

.app-icon__shield-edge--top-left {
  top: 18%;
  left: 16%;
  width: 37%;
  transform: rotate(-19deg);
}

.app-icon__shield-edge--top-right {
  top: 6%;
  left: 50%;
  width: 37%;
  transform: rotate(19deg);
}

.app-icon__shield-edge--right {
  top: 18%;
  left: 84%;
  width: 43%;
  transform: rotate(94deg);
}

.app-icon__shield-edge--bottom-right {
  top: 60%;
  left: 81%;
  width: 46%;
  transform: rotate(134deg);
}

.app-icon__shield-edge--bottom-left {
  top: 60%;
  left: 19%;
  width: 46%;
  transform: rotate(46deg);
}

.app-icon__shield-edge--left {
  top: 18%;
  left: 16%;
  width: 43%;
  transform: rotate(86deg);
}

.app-icon__shield-mark {
  position: absolute;
  top: 31%;
  left: 50%;
  width: 2rpx;
  height: 29%;
  border-radius: 2rpx;
  background: currentColor;
  transform: translateX(-50%);
}

.app-icon__shield-dot {
  position: absolute;
  top: 69%;
  left: 50%;
  width: 8%;
  height: 8%;
  border-radius: 50%;
  background: currentColor;
  transform: translateX(-50%);
}

.app-icon__modules {
  display: grid;
  width: 76%;
  height: 76%;
  grid-template-columns: repeat(2, 1fr);
  gap: 12%;
}

.app-icon__module-tile {
  box-sizing: border-box;
  border: 2rpx solid currentColor;
  border-radius: 4rpx;
}

.app-icon__info {
  box-sizing: border-box;
  border: 2rpx solid currentColor;
  border-radius: 50%;
}

.app-icon__info-dot {
  position: absolute;
  top: 22%;
  left: 50%;
  width: 9%;
  height: 9%;
  border-radius: 50%;
  background: currentColor;
  transform: translateX(-50%);
}

.app-icon__info-stem {
  position: absolute;
  top: 43%;
  left: 50%;
  width: 2rpx;
  height: 34%;
  border-radius: 2rpx;
  background: currentColor;
  transform: translateX(-50%);
}

.app-icon__chevron {
  width: 100%;
  height: 100%;
}

.app-icon__chevron-shape {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 34%;
  height: 34%;
  box-sizing: border-box;
  border-top: 2rpx solid currentColor;
  border-right: 2rpx solid currentColor;
  transform: translate(-62%, -50%) rotate(45deg);
}
</style>
